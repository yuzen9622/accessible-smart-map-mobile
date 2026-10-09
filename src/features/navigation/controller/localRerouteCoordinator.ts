import { useUserLocationStore } from '@/features/map';
import { getRouteSessionSnapshot, rerouteAccessibleRoute, markRouteTokenInvalid } from '@/features/route';
import type {
  AccessibleRouteRerouteData,
  AccessibleRouteRerouteRequest,
  RerouteReason,
} from '@/features/route/domain';
import { ApiError, type ApiResponse } from '@/shared/api';
import type { LatLng } from '@/shared/geo';
import i18n from '@/shared/i18n';

import { createClientRequestId } from '../domain/requestId';
import type { NavigationSource } from '../domain/types';
import { useNavStore } from '../store/navStore';
import { applyRouteReplacement, normalizeRerouteReplacement } from './rerouteCoordinator';

/**
 * 移植自 Web `src/lib/navigation/localRerouteCoordinator.ts`（commit 5eadc71），三條生命週期
 * （導航 session、請求優先序 MANUAL > AUTO、自動重算冷卻與 episode）逐行保留（SDD §6.4 `REROUTE_COOLDOWN_MS`）。
 *
 * 差異：預設相依改讀本 App 的 store（isNavigating 在 navStore、選中路線經 route 公開 API、
 * 使用者位置在 map 的 userLocationStore）；`crypto.randomUUID` 在 Hermes 不保證存在，改用
 * `createClientRequestId`。錯誤文案沿用 Web 的中文硬字串（Web 亦未 i18n，列為待辦）。
 */

export const REROUTE_COOLDOWN_MS = 30_000;

export type ReroutePriority = 'AUTO' | 'MANUAL';

export interface LocalRerouteContext {
  navigationSource: NavigationSource;
  isNavigating: boolean;
  navigationId: string | null;
  routeToken: string | null;
  routeVersion: number;
  position: LatLng | null;
}

interface ActiveRerouteRequest {
  type: ReroutePriority;
  reason: RerouteReason;
  requestId: string;
  generation: number;
  abortController: AbortController;
}

export interface LocalRerouteCoordinatorDeps {
  readContext?: () => LocalRerouteContext;
  post?: (
    request: AccessibleRouteRerouteRequest,
    signal?: AbortSignal,
  ) => Promise<ApiResponse<AccessibleRouteRerouteData>>;
  apply?: (data: AccessibleRouteRerouteData) => boolean;
  setPending?: () => void;
  setError?: (message: string) => void;
  now?: () => number;
  createRequestId?: () => string;
}

function defaultReadContext(): LocalRerouteContext {
  const nav = useNavStore.getState();
  const route = getRouteSessionSnapshot().navigationRoute?.route;
  const routeNavigationId = route?.navigationId ?? null;
  const routeVersion = route?.routeVersion ?? 0;
  const hasMatchingRuntimeIdentity =
    nav.isNavigating &&
    routeNavigationId !== null &&
    nav.navigationId === routeNavigationId &&
    nav.routeVersion === routeVersion;

  return {
    navigationSource: nav.navigationSource,
    isNavigating: nav.isNavigating,
    navigationId: hasMatchingRuntimeIdentity ? routeNavigationId : null,
    routeToken: typeof route?.routeToken === 'string' && route.routeToken.length > 0 ? route.routeToken : null,
    routeVersion: hasMatchingRuntimeIdentity ? routeVersion : 0,
    position: useUserLocationStore.getState().position,
  };
}

/**
 * Single Authoritative Local Reroute Coordinator.
 *
 * Distinct state-machine lifecycles:
 * 1. Navigation Session Lifecycle (startSession / stopSession)
 * 2. Request Lifecycle (inFlight, AbortController, Priority: MANUAL > AUTO)
 * 3. Automatic Cooldown & Episode Tracking
 */
export class LocalRerouteCoordinator {
  // 1. Session Lifecycle
  private session: {
    id: string | null;
    generation: number;
    active: boolean;
  } | null = null;
  private sessionGenCounter = 0;

  // 2. Request Lifecycle
  private activeRequest: ActiveRerouteRequest | null = null;
  private requestGenCounter = 0;

  // 3. Automatic Cooldown & Episode Tracking
  private lastAutoRerouteAt = Number.NEGATIVE_INFINITY;
  private autoEpisodeActive = false;
  private currentEpisodeRequestId: string | null = null;

  // Dependencies
  private readonly readContext: () => LocalRerouteContext;
  private readonly post: (
    request: AccessibleRouteRerouteRequest,
    signal?: AbortSignal,
  ) => Promise<ApiResponse<AccessibleRouteRerouteData>>;
  private readonly apply: (data: AccessibleRouteRerouteData) => boolean;
  private readonly setPending: () => void;
  private readonly setError: (message: string) => void;
  private readonly now: () => number;
  private readonly createRequestId: () => string;

  constructor(deps: LocalRerouteCoordinatorDeps = {}) {
    this.readContext = deps.readContext ?? defaultReadContext;
    this.post = deps.post ?? rerouteAccessibleRoute;
    this.apply =
      deps.apply ??
      ((data) => applyRouteReplacement(normalizeRerouteReplacement(data)));
    this.setPending =
      deps.setPending ?? (() => useNavStore.getState().setReroutePending());
    this.setError =
      deps.setError ??
      ((message) => useNavStore.getState().setRerouteError(message));
    this.now = deps.now ?? Date.now;
    this.createRequestId =
      deps.createRequestId ?? createClientRequestId;
  }

  /**
   * Called synchronously on domain startNavigation.
   * Starts a fresh session generation and clears any inherited auto cooldown.
   */
  startSession(navigationId: string | null): void {
    this.stopSession();
    this.session = {
      id: navigationId,
      generation: ++this.sessionGenCounter,
      active: true,
    };
    this.lastAutoRerouteAt = Number.NEGATIVE_INFINITY;
  }

  /**
   * Called synchronously on domain stopNavigation.
   * Immediately aborts pending HTTP requests and invalidates any late responses.
   */
  stopSession(): void {
    if (this.activeRequest) {
      this.activeRequest.abortController.abort();
      this.activeRequest = null;
    }
    if (this.session) {
      this.session.active = false;
      this.session = null;
    }
    this.requestGenCounter++;
    this.autoEpisodeActive = false;
    this.currentEpisodeRequestId = null;
    this.lastAutoRerouteAt = Number.NEGATIVE_INFINITY;
  }

  resetSessionState(): void {
    this.stopSession();
  }

  /**
   * Clears off-route state when the user returns to route.
   * Does NOT abort in-flight requests or reset session generation.
   */
  clearOffRoute(): void {
    this.autoEpisodeActive = false;
    this.currentEpisodeRequestId = null;
  }

  confirmOffRouteEpisode(position?: LatLng): Promise<boolean> {
    return this.triggerAutoReroute(position);
  }

  clearOffRouteEpisode(): void {
    this.clearOffRoute();
  }

  requestManualReroute(
    reason: RerouteReason = 'MANUAL',
    position?: LatLng,
  ): Promise<boolean> {
    return this.triggerManualReroute(reason, position);
  }

  /**
   * Automatic off-route trigger from GPS engine.
   * - Subject to 30s cooldown.
   * - Blocked if another request is in flight.
   */
  triggerAutoReroute(position?: LatLng): Promise<boolean> {
    const context = this.readContext();
    if (!this.isSessionActive() || context.navigationSource !== 'local') {
      return Promise.resolve(false);
    }

    // If any request is already in flight, AUTO is ignored / deduped
    if (this.activeRequest !== null) {
      return Promise.resolve(false);
    }

    if (!this.autoEpisodeActive) {
      this.autoEpisodeActive = true;
      this.currentEpisodeRequestId = this.createRequestId();
    }

    const now = this.now();
    if (now - this.lastAutoRerouteAt < REROUTE_COOLDOWN_MS) {
      return Promise.resolve(false);
    }
    this.lastAutoRerouteAt = now;

    const reqId = this.currentEpisodeRequestId ?? this.createRequestId();
    return this.sendRequest('AUTO', 'OFF_ROUTE', position, reqId);
  }

  /**
   * Manual reroute trigger (e.g. from HUD "View alternative" or advisory).
   * - MANUAL > AUTO: Preempts and aborts any in-flight AUTO request.
   * - Bypasses auto cooldown.
   * - Dedupes if another MANUAL request is already in flight.
   */
  triggerManualReroute(
    reason: RerouteReason = 'MANUAL',
    position?: LatLng,
  ): Promise<boolean> {
    const context = this.readContext();
    if (!this.isSessionActive() || context.navigationSource !== 'local') {
      return Promise.resolve(false);
    }

    if (this.activeRequest !== null) {
      if (this.activeRequest.type === 'MANUAL') {
        // Another manual reroute is already in-flight -> dedupe
        return Promise.resolve(false);
      }
      if (this.activeRequest.type === 'AUTO') {
        // MANUAL > AUTO: abort active auto request immediately
        this.activeRequest.abortController.abort();
        this.activeRequest = null;
      }
    }

    const reqId = this.createRequestId();
    this.currentEpisodeRequestId = reqId;
    this.autoEpisodeActive = false;
    return this.sendRequest('MANUAL', reason, position, reqId);
  }

  /**
   * Manual retry on failure (e.g. from HUD "Retry" button).
   * Re-uses the existing episode requestId if available to enable backend idempotent replay.
   */
  retry(position?: LatLng): Promise<boolean> {
    const context = this.readContext();
    if (!this.isSessionActive() || context.navigationSource !== 'local') {
      return Promise.resolve(false);
    }
    if (this.activeRequest !== null) return Promise.resolve(false);

    const reqId = this.currentEpisodeRequestId ?? this.createRequestId();
    const reason: RerouteReason = useNavStore.getState().lastRerouteReason ?? 'MANUAL';
    return this.sendRequest('MANUAL', reason, position, reqId);
  }

  private isSessionActive(): boolean {
    if (this.session !== null) return this.session.active;
    // Fallback if session wasn't explicitly started yet but map isNavigating is true
    return this.readContext().isNavigating;
  }

  private async sendRequest(
    type: ReroutePriority,
    reason: RerouteReason,
    positionOverride: LatLng | undefined,
    requestId: string,
  ): Promise<boolean> {
    const context = this.readContext();
    const position = positionOverride ?? context.position;
    if (
      !context.navigationId ||
      !context.routeToken ||
      context.routeVersion < 1 ||
      !position
    ) {
      this.setError(i18n.t('nativeRerouteRetryLater'));
      return false;
    }

    const sessionGen = this.session?.generation ?? this.sessionGenCounter;
    const reqGen = ++this.requestGenCounter;
    const abortController = new AbortController();

    this.activeRequest = {
      type,
      reason,
      requestId,
      generation: reqGen,
      abortController,
    };

    this.setPending();

    try {
      const response = await this.post(
        {
          routeToken: context.routeToken,
          currentPosition: {
            latitude: position.lat,
            longitude: position.lng,
          },
          previousRouteVersion: context.routeVersion,
          reason,
          clientRequestId: requestId,
          language: i18n.language === 'en' ? 'en' : 'zh-TW',
        },
        abortController.signal,
      );

      if (!this.isValidResponse(sessionGen, reqGen, context)) {
        return false;
      }

      const succeeded = response.ok === true || response.success === true;
      if (!succeeded || !response.data) {
        this.setError(response.message || i18n.t('recalculateFailed'));
        return false;
      }

      const applied = this.apply(response.data);
      if (applied) {
        this.autoEpisodeActive = false;
        this.currentEpisodeRequestId = null;
      }
      return applied;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Aborted cleanly by stopSession or priority preemption.
        return false;
      }
      if (!this.isValidResponse(sessionGen, reqGen, context)) {
        return false;
      }
      if (error instanceof ApiError && error.reason === 'INVALID_ROUTE_TOKEN' && context.routeToken) {
        markRouteTokenInvalid(context.routeToken);
        useNavStore.setState({ instructionError: 'expired' });
      }
      this.setError(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : i18n.t('nativeNetworkError'),
      );
      return false;
    } finally {
      if (this.activeRequest?.generation === reqGen) {
        this.activeRequest = null;
      }
    }
  }

  private isValidResponse(
    expectedSessionGen: number,
    expectedReqGen: number,
    expectedContext: LocalRerouteContext,
  ): boolean {
    if (
      this.session &&
      (!this.session.active || this.session.generation !== expectedSessionGen)
    ) {
      return false;
    }
    if (this.requestGenCounter !== expectedReqGen) {
      return false;
    }
    const current = this.readContext();
    return (
      current.isNavigating &&
      current.navigationSource === 'local' &&
      current.navigationId === expectedContext.navigationId &&
      current.routeVersion === expectedContext.routeVersion &&
      current.routeToken === expectedContext.routeToken
    );
  }
}

export const localRerouteCoordinator = new LocalRerouteCoordinator();
