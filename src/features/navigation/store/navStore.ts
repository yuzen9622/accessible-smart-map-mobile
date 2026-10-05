import { create } from 'zustand';

import type { NavInstruction } from '@/features/route/domain';
import type { LatLng } from '@/shared/geo';

import type {
  EtaSource,
  HeadingSource,
  NavAdvisory,
  NavRerouteReason,
  NavStepMode,
  NavViewMode,
  NavigationSource,
  RerouteStatus,
} from '../domain/types';
import type { TransitGuide } from '../domain/transitRide';

/**
 * 移植自 Web `src/stores/useNavStore.ts`（commit 5eadc71），action 語意逐條保留。
 *
 * 差異：
 * - 新增 `isNavigating`（Web 放在 god store `useMapStore`；本 App 導航狀態由 navigation feature 擁有）。
 * - 拿掉 `compassPermission`／`setCompassPermission`：那是 iOS Safari `DeviceOrientationEvent` 的權限，
 *   原生用 `LocationPort.watchHeading`，隨定位權限一起授予。
 * - 型別改由 `domain/types.ts` 提供；改為具名匯出（本 repo 慣例）。
 */

export type { EtaSource, HeadingSource, NavAdvisory, NavRerouteReason, NavStepMode, NavViewMode, NavigationSource, RerouteStatus };

export interface NavProgressUpdate {
  remainingM?: number | null;
  remainingDurationSec?: number | null;
  estimatedArrivalAt?: number | null;
  etaSource?: EtaSource;
  distanceToNextM?: number | null;
}

/**
 * High-frequency turn-by-turn runtime state, kept OUT of useMapStore on
 * purpose: useMapStore is destructured wholesale by ClientMap and friends, so
 * writing heading/step there every GPS/compass tick would re-render the whole
 * map. Consumers here subscribe with selectors (useNavStore(s => s.field)).
 */
interface NavState {
  /** 導航進行中（Web `useMapStore.isNavigating`）。 */
  isNavigating: boolean;
  /** Which state machine owns step advancement for the active navigation. */
  navigationSource: NavigationSource;
  navigationId: string | null;
  routeVersion: number;
  instructions: NavInstruction[];
  warnings: string[];
  currentStepIndex: number;
  /** 實際導航（定位推進步驟）或預覽（手動切換步驟）；由 controller 依定位自動判斷。 */
  stepMode: NavStepMode;
  distanceToNextM: number | null;
  /** Combined heading shown by the marker / used to rotate the map. */
  userHeading: number | null;
  /** Raw course-over-ground from the geolocation watch (fallback source). */
  gpsHeading: number | null;
  headingSource: HeadingSource;
  isOffRoute: boolean;
  rerouteStatus: RerouteStatus;
  rerouteError: string | null;
  rerouteRetryable: boolean;
  /** 目前尚未關閉的主動警報，最新在前，上限 ADVISORY_MAX 則。 */
  advisories: NavAdvisory[];
  /** 最近一次改道的原因，供 HUD 顯示明確說明。 */
  lastRerouteReason: NavRerouteReason | null;
  arrived: boolean;
  /** True after the user drags the map mid-navigation; camera-follow pauses. */
  followPaused: boolean;
  /** Meters left along the whole route (written by the engine). */
  remainingM: number | null;
  /** Seconds left along the whole route. */
  remainingDurationSec: number | null;
  /** Estimated arrival timestamp in epoch milliseconds. */
  estimatedArrivalAt: number | null;
  /** Whether the ETA came from the server or local engine. */
  etaSource: EtaSource;
  /** Timestamp of the most recent ETA write in epoch milliseconds. */
  etaUpdatedAt: number | null;
  /** Total route length in meters (set when instructions load). */
  routeTotalM: number | null;
  /** TTS announcements on step changes. */
  voiceEnabled: boolean;
  /** Step-list panel visibility while the nav HUD owns the screen. */
  stepListOpen: boolean;
  /** 2D or 3D view mode during navigation. */
  viewMode: NavViewMode;
  /** The upcoming step coordinate for preview camera moves. */
  stepCoord: LatLng | null;
  /** 公車段的等車／搭乘導引（`domain/transitRide.ts`）；目前步驟不在公車段時為 null。 */
  transitGuide: TransitGuide | null;
}

interface NavAction {
  setIsNavigating: (isNavigating: boolean) => void;
  setNavigationSource: (source: NavigationSource) => void;
  setNavigationIdentity: (
    navigationId: string | null,
    routeVersion: number,
  ) => void;
  /**
   * 換上一整組指令並重置進度。`currentStepIndex` 預設 0；語音交接時帶入接手的那一步，
   * 讓指令與步驟一次寫入（分兩次寫會先播第 0 步再播接手的那一步）。
   */
  setInstructions: (
    instructions: NavInstruction[],
    warnings?: string[],
    currentStepIndex?: number,
  ) => void;
  setCurrentStepIndex: (index: number) => void;
  setStepMode: (mode: NavStepMode) => void;
  /**
   * 使用者手動切換步驟（上一步／下一步、點步驟清單）。只在預覽、本機導航時生效；
   * 實際導航中步驟只由定位推進，這裡直接忽略，UI 不可能把 HUD 帶離使用者的實際位置。
   */
  selectPreviewStep: (index: number) => void;
  applyVoiceStep: (
    index: number,
    instruction: string,
    remainingM: number | null,
  ) => void;
  setDistanceToNextM: (m: number | null) => void;
  setUserHeading: (deg: number | null, source: HeadingSource) => void;
  setGpsHeading: (deg: number | null) => void;
  setIsOffRoute: (v: boolean) => void;
  setReroutePending: () => void;
  setRerouteIdle: () => void;
  setRerouteError: (message: string, retryable?: boolean) => void;
  pushAdvisories: (advisories: NavAdvisory[]) => void;
  dismissAdvisory: (advisoryId: string) => void;
  clearAdvisories: () => void;
  setLastRerouteReason: (reason: NavRerouteReason | null) => void;
  setArrived: (v: boolean) => void;
  setFollowPaused: (v: boolean) => void;
  setRemainingM: (m: number | null) => void;
  setProgress: (update: NavProgressUpdate) => void;
  setRouteTotalM: (m: number | null) => void;
  setVoiceEnabled: (v: boolean) => void;
  setStepListOpen: (v: boolean) => void;
  setViewMode: (v: NavViewMode) => void;
  setStepCoord: (c: LatLng | null) => void;
  setTransitGuide: (guide: TransitGuide | null) => void;
  reset: () => void;
}

type NavStore = NavState & NavAction;

const ADVISORY_MAX = 3;

const initialState: NavState = {
  isNavigating: false,
  navigationSource: 'local',
  navigationId: null,
  routeVersion: 0,
  instructions: [],
  warnings: [],
  currentStepIndex: 0,
  stepMode: 'live',
  distanceToNextM: null,
  userHeading: null,
  gpsHeading: null,
  headingSource: null,
  isOffRoute: false,
  rerouteStatus: 'idle',
  rerouteError: null,
  rerouteRetryable: false,
  advisories: [],
  lastRerouteReason: null,
  arrived: false,
  followPaused: false,
  remainingM: null,
  remainingDurationSec: null,
  estimatedArrivalAt: null,
  etaSource: null,
  etaUpdatedAt: null,
  routeTotalM: null,
  voiceEnabled: false,
  stepListOpen: false,
  viewMode: '3d',
  stepCoord: null,
  transitGuide: null,
};

export const useNavStore = create<NavStore>()((set) => ({
  ...initialState,
  setIsNavigating: (isNavigating) => set({ isNavigating }),
  setNavigationSource: (navigationSource) => set({ navigationSource }),
  setNavigationIdentity: (navigationId, routeVersion) =>
    set({ navigationId, routeVersion }),
  setInstructions: (instructions, warnings = [], currentStepIndex = 0) =>
    set({
      instructions,
      warnings,
      currentStepIndex,
      arrived: false,
      isOffRoute: false,
      rerouteStatus: 'idle',
      rerouteError: null,
      rerouteRetryable: false,
      advisories: [],
      lastRerouteReason: null,
      remainingDurationSec: null,
      estimatedArrivalAt: null,
      etaSource: null,
      etaUpdatedAt: null,
      transitGuide: null,
    }),
  setCurrentStepIndex: (currentStepIndex) => set({ currentStepIndex }),
  setStepMode: (stepMode) => set({ stepMode }),
  selectPreviewStep: (index) =>
    set((state) => {
      if (state.stepMode !== 'preview' || state.navigationSource !== 'local' || state.instructions.length === 0) return {};
      const currentStepIndex = Math.max(0, Math.min(index, state.instructions.length - 1));
      // 預覽沒有「目前位置到下一步」的距離：清掉，HUD 退回顯示該步的規劃距離。
      return currentStepIndex === state.currentStepIndex ? {} : { currentStepIndex, distanceToNextM: null };
    }),
  applyVoiceStep: (currentStepIndex, instruction, remainingM) =>
    set((state) => ({
      instructions: state.instructions.map((step, index) =>
        index === currentStepIndex ? { ...step, text: instruction } : step,
      ),
      currentStepIndex,
      distanceToNextM: remainingM,
      remainingM,
      isOffRoute: false,
    })),
  setDistanceToNextM: (distanceToNextM) => set({ distanceToNextM }),
  setUserHeading: (userHeading, headingSource) =>
    set({ userHeading, headingSource }),
  setGpsHeading: (gpsHeading) => set({ gpsHeading }),
  setIsOffRoute: (isOffRoute) => set({ isOffRoute }),
  setReroutePending: () =>
    set({
      rerouteStatus: 'pending',
      rerouteError: null,
      rerouteRetryable: false,
    }),
  setRerouteIdle: () =>
    set({
      rerouteStatus: 'idle',
      rerouteError: null,
      rerouteRetryable: false,
    }),
  setRerouteError: (rerouteError, rerouteRetryable = true) =>
    set({ rerouteStatus: 'error', rerouteError, rerouteRetryable }),
  pushAdvisories: (incoming) =>
    set((state) => {
      const byId = new Map(state.advisories.map((a) => [a.advisoryId, a]));
      for (const a of incoming) byId.set(a.advisoryId, a);
      return {
        advisories: [...byId.values()]
          .sort((l, r) => r.issuedAt.localeCompare(l.issuedAt))
          .slice(0, ADVISORY_MAX),
      };
    }),
  dismissAdvisory: (advisoryId) =>
    set((state) => ({
      advisories: state.advisories.filter((a) => a.advisoryId !== advisoryId),
    })),
  clearAdvisories: () => set({ advisories: [] }),
  setLastRerouteReason: (lastRerouteReason) => set({ lastRerouteReason }),
  setArrived: (arrived) =>
    set(() => ({
      arrived,
      ...(arrived
        ? {
            advisories: [],
            remainingM: 0,
            distanceToNextM: 0,
            remainingDurationSec: 0,
            estimatedArrivalAt: null,
            etaSource: null,
            etaUpdatedAt: null,
          }
        : {}),
    })),
  setFollowPaused: (followPaused) => set({ followPaused }),
  setRemainingM: (remainingM) => set({ remainingM }),
  setProgress: (update) =>
    set(() => {
      const progress: Partial<NavState> = {};
      if ('remainingM' in update && update.remainingM !== undefined)
        progress.remainingM = update.remainingM;
      if (
        'remainingDurationSec' in update &&
        update.remainingDurationSec !== undefined
      )
        progress.remainingDurationSec = update.remainingDurationSec;
      if (
        'estimatedArrivalAt' in update &&
        update.estimatedArrivalAt !== undefined
      )
        progress.estimatedArrivalAt = update.estimatedArrivalAt;
      if ('etaSource' in update && update.etaSource !== undefined)
        progress.etaSource = update.etaSource;
      if ('distanceToNextM' in update && update.distanceToNextM !== undefined)
        progress.distanceToNextM = update.distanceToNextM;
      if (
        ('remainingDurationSec' in update &&
          update.remainingDurationSec !== undefined) ||
        ('estimatedArrivalAt' in update &&
          update.estimatedArrivalAt !== undefined)
      ) {
        progress.etaUpdatedAt = Date.now();
      }
      return progress;
    }),
  setRouteTotalM: (routeTotalM) => set({ routeTotalM }),
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
  setStepListOpen: (stepListOpen) => set({ stepListOpen }),
  setViewMode: (viewMode) => set({ viewMode }),
  setStepCoord: (stepCoord) => set({ stepCoord }),
  setTransitGuide: (transitGuide) => set({ transitGuide }),
  // 對齊 Web：reset 不動導航開關（Web 的 isNavigating 在另一個 store），只有 stopNavigation 會關。
  reset: () => set((s) => ({ ...initialState, isNavigating: s.isNavigating })),
}));
