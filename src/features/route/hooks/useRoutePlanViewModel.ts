import { router } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import {
  PINNED_FACILITY_CATEGORIES,
  sheetController,
  useUserLocationStore,
  type PinnedFacilityCategory,
} from '@/features/map';
import { useOnboardingStore } from '@/features/onboarding';
import { resolveVenuePlace } from '@/features/place/hooks/venuePlaceCatalog';
import { getAppLanguage, useAppTranslation } from '@/shared/i18n';
import type { VenueRoute } from '@/shared/venue';

import { computeRoute, selectRouteAt } from '../controller/routeSessionPort';
import { ROUTE_FAILURE_I18N } from '../domain/routeRequest';
import { planRequestKey } from '../domain/routeSession';
import {
  ROUTE_MODES,
  ROUTE_MODE_LABEL_KEY,
  TRAVEL_MODES,
  effectiveTravelMode,
  hasGatedTravelModes,
  isTravelModeAllowed,
} from '../domain/travelModes';
import { useRouteSessionStore } from '../store/routeSessionStore';
import type { AccessibleRoute, RouteMode, TravelMode, VenueHandoff } from '../types/route';

export type PlanField = 'origin' | 'destination';

const FACILITY_CATEGORY_LABEL_KEY: Record<PinnedFacilityCategory, string> = {
  elevator: 'elevator',
  toilet: 'toilet',
  ramp: 'a11yFeatureRamp',
};

export interface PlanOption<T extends string> {
  value: T;
  label: string;
  selected: boolean;
  disabled: boolean;
  /** 停用時念出原因（Web `travelModeUnavailableFor`）。 */
  accessibilityLabel: string;
  onSelect: () => void;
}

export interface RoutePlanModel {
  originLabel: string;
  originIsMyLocation: boolean;
  destinationLabel: string | null;
  venueHandoff?: VenueHandoff | null;
  indoorRoute?: VenueRoute | null;
  isIndoorJourney?: boolean;
  swapDisabled?: boolean;
  travelModes: PlanOption<TravelMode>[];
  routeModes: PlanOption<RouteMode>[];
  /** 沿途無障礙設施篩選（使用者回饋 2026-10-15：圖示太多太亂，可以自己選要看哪些類別）。 */
  facilityFilters: PlanOption<PinnedFacilityCategory>[];
  onSelectRouteMode: (mode: RouteMode) => void;
  gatedHint: string | null;
  canStart: boolean;
  loading: boolean;
  /**
   * 對應目前條件的路線結果（Apple 地圖的路線卡：選好起訖點就直接列出路線，不必再按「開始規劃」）。
   * 條件改了、結果還沒回來時為 null。
   */
  results: { routes: AccessibleRoute[]; selectedIndex: number | null } | null;
  onSelectRoute: (index: number) => void;
  onOpenRouteDetail: (index: number) => void;
  error: string | null;
  onEdit: (field: PlanField) => void;
  /** 起點改回「目前位置」；跟終點一樣有清除按鈕（使用者回饋 2026-10-23，參考設計圖二：以前只有
   * 終點能清除，起點只能進編輯模式點「使用我的位置」，兩邊操作不一致）。 */
  onClearOrigin: () => void;
  onClearDestination: () => void;
  onSwap: () => void;
  onStart: () => void;
  labels: {
    title: string;
    origin: string;
    destination: string;
    myLocation: string;
    swap: string;
    edit: string;
    clear: string;
    cancel: string;
    useMyLocation: string;
    searchPlaceholder: string;
    travelMode: string;
    a11yMode: string;
    start: string;
    replan: string;
    loading: string;
    chooseDestination: string;
    startNav: string;
    routeOptions: string;
    close: string;
    facilityFilterTitle: string;
  };
}

export interface RoutePlanParams {
  destLat?: string;
  destLng?: string;
  destName?: string;
  venueId?: string;
  venuePlaceId?: string;
  venueField?: 'origin' | 'destination';
}

function parseCoord(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * 路線規劃面板（`(sheet)/plan`）的 view-model，移植自 Web `RoutePlanContent.tsx`（commit 5eadc71）：
 * 起點預設「我的位置」、目的地 chip／搜尋、交換、交通方式與無障礙模式（含閘控）、開始規劃。
 *
 * 差異：Web 的中繼站（最多 5 個）暫不做，後端與 RouteSessionPort 已支援 `waypoints`，UI 留待之後；
 * Web 錯誤以 toast 呈現，這裡顯示在面板內並以 VoiceOver 播報（iOS 沒有系統 toast）。
 */
export function useRoutePlanViewModel(params: RoutePlanParams): RoutePlanModel {
  const { t } = useAppTranslation();
  const origin = useRouteSessionStore((s) => s.origin);
  const originName = useRouteSessionStore((s) => s.originName);
  const originVenuePlace = useRouteSessionStore((s) => s.originVenuePlace);
  const destination = useRouteSessionStore((s) => s.destination);
  const destinationName = useRouteSessionStore((s) => s.destinationName);
  const destinationVenuePlace = useRouteSessionStore((s) => s.destinationVenuePlace);
  const venueArrival = useRouteSessionStore((s) => s.venueArrival);
  const venueLeg = useRouteSessionStore((s) => s.venueLeg);
  const indoorRoute = useRouteSessionStore((s) => s.indoorRoute);
  const isLoading = useRouteSessionStore((s) => s.isLoading);
  const lastFailure = useRouteSessionStore((s) => s.lastFailure);
  const storedTravelMode = useRouteSessionStore((s) => s.travelMode);
  const storedRouteMode = useRouteSessionStore((s) => s.routeMode);
  const facilityFilter = useRouteSessionStore((s) => s.facilityFilter);
  const profileRouteMode = useOnboardingStore((s) => s.profile.routeMode);
  const aiPlan = useRouteSessionStore((s) => s.plan);
  const planningPreferences = useRouteSessionStore((s) => s.planningPreferences);
  const defaultAvoidStairs = useOnboardingStore((s) => s.profile.avoidStairs);
  const defaultRequireElevator = useOnboardingStore((s) => s.profile.requireElevator);
  const profileAvoidStairs = planningPreferences?.avoidStairs ?? defaultAvoidStairs;
  const profileRequireElevator = planningPreferences?.requireElevator ?? defaultRequireElevator;
  const position = useUserLocationStore((s) => s.position);
  const computeRoutes = useRouteSessionStore((s) => s.computeRoutes);
  const computedFor = useRouteSessionStore((s) => s.computedFor);
  const selectedIndex = useRouteSessionStore((s) => s.selectRoute?.index ?? null);

  const [inputError, setInputError] = useState<string | null>(null);
  const [venueParamResult, setVenueParamResult] = useState<{ key: string; failed: boolean } | null>(null);
  const { venueId, venuePlaceId } = params;
  const venueField = params.venueField === 'origin' ? 'origin' : 'destination';
  const venueParamKey = venueId && venuePlaceId ? JSON.stringify([venueId, venuePlaceId, venueField]) : null;
  const resolvingVenueParam = venueParamKey !== null && venueParamResult?.key !== venueParamKey;
  const failedVenueParam = venueParamKey !== null && venueParamResult?.key === venueParamKey && venueParamResult.failed;
  const reportVenueResolveFailure = useEffectEvent((kind: 'stale-venue' | 'failed') => {
    const failure = ROUTE_FAILURE_I18N[kind];
    setInputError(t(failure.key, { defaultValue: failure.fallback }));
  });

  useEffect(() => {
    if (!venueId || !venuePlaceId || !venueParamKey) return;
    const controller = new AbortController();
    const store = useRouteSessionStore.getState();
    if (venueField === 'origin') store.setOrigin(null);
    else store.setDestination(null);
    if (store.isLoading && useRouteSessionStore.getState().requestSeq === store.requestSeq) {
      useRouteSessionStore.setState({ requestSeq: store.requestSeq + 1, isLoading: false });
    }
    const initial = useRouteSessionStore.getState();
    const identityField = venueField === 'origin' ? 'originVenuePlace' : 'destinationVenuePlace';
    // A later user selection owns the field, even if this catalog read resolves afterwards.
    const unsubscribe = useRouteSessionStore.subscribe((next) => {
      if (next.requestSeq !== initial.requestSeq || next[venueField] !== initial[venueField] || next[identityField] !== initial[identityField]) {
        controller.abort();
        setVenueParamResult({ key: venueParamKey, failed: false });
        setInputError(null);
      }
    });
    void resolveVenuePlace({ venueId, placeId: venuePlaceId }, controller.signal).then((place) => {
      if (controller.signal.aborted) return;
      unsubscribe();
      if (place) {
        useRouteSessionStore.getState().setVenueEndpoint(venueField, place);
        setInputError(null);
      }
      else reportVenueResolveFailure('stale-venue');
      setVenueParamResult({ key: venueParamKey, failed: !place });
    }).catch(() => {
      if (controller.signal.aborted) return;
      reportVenueResolveFailure('failed');
      setVenueParamResult({ key: venueParamKey, failed: true });
    });
    return () => { unsubscribe(); controller.abort(); };
  }, [venueId, venuePlaceId, venueField, venueParamKey]);

  // 由地點詳情「規劃路線」帶入的目的地（只在參數改變時套用一次）。
  const destLat = parseCoord(params.destLat);
  const destLng = parseCoord(params.destLng);
  const destParamName = params.destName ?? '';
  useEffect(() => {
    if (destLat === null || destLng === null || venueParamKey) return;
    useRouteSessionStore.getState().setDestination({ lat: destLat, lng: destLng }, destParamName);
  }, [destLat, destLng, destParamName, venueParamKey]);

  const routeMode = storedRouteMode ?? profileRouteMode;
  const isIndoorJourney = Boolean(originVenuePlace && destinationVenuePlace && originVenuePlace.venueId === destinationVenuePlace.venueId);
  const travelMode = isIndoorJourney ? 'walk' : effectiveTravelMode(routeMode, storedTravelMode);
  const originIsMyLocation = origin === null && originVenuePlace === null;
  const hasOrigin = Boolean(originVenuePlace) || (originIsMyLocation ? position !== null : true);
  const hasDestination = destination !== null || destinationVenuePlace !== null;
  const canStart = hasOrigin && hasDestination && !isLoading && !resolvingVenueParam && !failedVenueParam;
  const requestInputs = {
    origin,
    originVenuePlace,
    destination,
    destinationVenuePlace,
    travelMode,
    routeMode,
    avoidStairs: profileAvoidStairs,
    requireElevator: profileRequireElevator,
    canonicalPreferences: planningPreferences,
  };
  // Geometry/conditions identity drives auto-planning. Locale alone must not create another operation.
  const requestKey = planRequestKey(requestInputs);
  const localizedRequestKey = planRequestKey({ ...requestInputs, language: getAppLanguage() });
  const aiRequestKey = aiPlan ? planRequestKey({ origin: aiPlan.origin, destination: aiPlan.destination,
    travelMode: aiPlan.effectivePreferences.travelMode, routeMode: aiPlan.effectivePreferences.mode,
    avoidStairs: aiPlan.effectivePreferences.avoidStairs, requireElevator: aiPlan.effectivePreferences.requireElevator,
    canonicalPreferences: aiPlan.effectivePreferences }) : null;
  // An already selected route remains visible in its original language as a fallback.
  // Store new results under their locale key, but do not discard geometry or replan just to translate.
  const matchesComputed = computedFor === requestKey || (['en', 'zh-TW'] as const).some((language) =>
    computedFor === planRequestKey({ ...requestInputs, language }));
  const resultsFresh = requestKey !== null && (matchesComputed || aiRequestKey === requestKey) && (computeRoutes !== null || indoorRoute !== null);
  // Only new plans reveal the map; metadata refreshes preserve the user's sheet height.
  const presentedPlan = useRef<typeof aiPlan | undefined>(undefined);
  useEffect(() => {
    if (!resultsFresh || presentedPlan.current === aiPlan) return;
    presentedPlan.current = aiPlan;
    void sheetController.select(1);
  }, [resultsFresh, aiPlan]);
  // 每組條件只自動算一次：失敗時停在錯誤訊息＋重試鈕，不會一直重打 API
  const autoAttempted = useRef<string | null>(null);
  const previousRequestKey = useRef(requestKey);

  /** 算路本身：只寫 route store（外部狀態），自動算路的 effect 也能安全呼叫。 */
  const runPlan = async (key: string | null) => {
    if (!hasDestination) return;
    const pending = computeRoute({
      ...(originVenuePlace ? { originVenuePlace } : { origin: originIsMyLocation ? (position ?? undefined) : origin ?? undefined }),
      ...(destinationVenuePlace ? { destinationVenuePlace } : destination ? { destination } : {}),
      mode: routeMode,
      travelMode,
      avoidStairs: profileAvoidStairs,
      requireElevator: profileRequireElevator,
      canonicalPreferences: planningPreferences ?? undefined,
    });
    const seq = useRouteSessionStore.getState().requestSeq;
    const result = await pending;
    if (useRouteSessionStore.getState().requestSeq !== seq) return;
    if (result.ok) {
      presentedPlan.current = null;
      useRouteSessionStore.setState({ computedFor: key });
      void sheetController.select(1);
      AccessibilityInfo.announceForAccessibility(t('nativeRoutesFound', { count: result.indoorRoute ? 1 : result.routes.length }));
      return;
    }
    if (result.failure !== 'superseded' && result.failure !== 'missing-input') {
      const failure = ROUTE_FAILURE_I18N[result.failure];
      AccessibilityInfo.announceForAccessibility(t(failure.key, { defaultValue: failure.fallback }));
    }
  };

  /** 手動「規劃路線」／重試：先檢查輸入並把原因顯示在面板上。 */
  const start = async () => {
    if (resolvingVenueParam || failedVenueParam) return;
    if (!hasDestination) {
      setInputError(t('chooseDestination'));
      return;
    }
    if (originIsMyLocation && !position) {
      setInputError(t('enableLocationOrEnterOrigin'));
      return;
    }
    setInputError(null);
    autoAttempted.current = requestKey;
    await runPlan(localizedRequestKey);
  };

  // 起訖點與模式齊全、而且和現有結果對不上時自動算路。
  const autoReady = !aiPlan && canStart && !resultsFresh;
  const autoPlan = useEffectEvent(() => void runPlan(localizedRequestKey));
  useEffect(() => {
    if (previousRequestKey.current !== requestKey) {
      previousRequestKey.current = requestKey;
      autoAttempted.current = null;
    }
    if (!autoReady || autoAttempted.current === requestKey) return;
    autoAttempted.current = requestKey;
    autoPlan();
  }, [autoReady, requestKey]);

  const failureText = lastFailure ? t(ROUTE_FAILURE_I18N[lastFailure].key, { defaultValue: ROUTE_FAILURE_I18N[lastFailure].fallback }) : null;
  const routeModeLabel = t(ROUTE_MODE_LABEL_KEY[routeMode]);

  return {
    originLabel: originIsMyLocation ? t('myLocation') : originName || t('origin'),
    originIsMyLocation,
    destinationLabel: hasDestination ? destinationName || t('destination') : null,
    venueHandoff: venueArrival && venueLeg ? { arrival: venueArrival, leg: venueLeg, destinationName } : null,
    indoorRoute: resultsFresh ? indoorRoute : null,
    isIndoorJourney,
    swapDisabled: false,
    travelModes: (isIndoorJourney ? [] : TRAVEL_MODES).map((mode) => {
      const allowed = isTravelModeAllowed(routeMode, mode);
      const label = t(mode);
      return {
        value: mode,
        label,
        selected: travelMode === mode,
        disabled: !allowed,
        accessibilityLabel: allowed ? label : t('travelModeUnavailableFor', { a11yMode: routeModeLabel, mode: label }),
        onSelect: () => {
          if (allowed) useRouteSessionStore.getState().setTravelMode(mode);
        },
      };
    }),
    routeModes: ROUTE_MODES.map((mode) => ({
      value: mode,
      label: t(ROUTE_MODE_LABEL_KEY[mode]),
      selected: routeMode === mode,
      disabled: false,
      accessibilityLabel: t(ROUTE_MODE_LABEL_KEY[mode]),
      onSelect: () => useRouteSessionStore.getState().setRouteMode(mode),
    })),
    onSelectRouteMode: (mode) => useRouteSessionStore.getState().setRouteMode(mode),
    facilityFilters: (isIndoorJourney ? [] : PINNED_FACILITY_CATEGORIES).map((category) => {
      const label = t(FACILITY_CATEGORY_LABEL_KEY[category]);
      return {
        value: category,
        label,
        selected: facilityFilter.includes(category),
        disabled: false,
        accessibilityLabel: label,
        onSelect: () => useRouteSessionStore.getState().toggleFacilityFilter(category),
      };
    }),
    gatedHint: !isIndoorJourney && hasGatedTravelModes(routeMode) ? t('travelModeGatedHint', { a11yMode: routeModeLabel }) : null,
    canStart,
    loading: isLoading || resolvingVenueParam,
    results: resultsFresh && computeRoutes ? { routes: computeRoutes, selectedIndex } : null,
    onSelectRoute: selectRouteAt,
    onOpenRouteDetail: (index) => {
      if (!indoorRoute) selectRouteAt(index);
      router.navigate({ pathname: '/routes/[index]', params: { index: indoorRoute ? '0' : String(index) } });
    },
    error: resolvingVenueParam ? null : inputError ?? failureText,
    onEdit: (field) => {
      setInputError(null);
      router.push({ pathname: '/route-location-search', params: { field } });
    },
    onClearOrigin: () => useRouteSessionStore.getState().setOrigin(null),
    onClearDestination: () => useRouteSessionStore.getState().setDestination(null),
    onSwap: () => useRouteSessionStore.getState().swapEndpoints(),
    onStart: () => void start(),
    labels: {
      title: t('planRoute'),
      origin: t('origin'),
      destination: t('destination'),
      myLocation: t('myLocation'),
      swap: t('nativeRouteSwap'),
      edit: t('edit'),
      clear: t('nativeRouteClearDestination'),
      cancel: t('cancel'),
      useMyLocation: t('useMyLocationAsOrigin'),
      searchPlaceholder: t('searchOrInputDest'),
      travelMode: t('nativeRouteTravelMode'),
      a11yMode: t('a11yModeLabel'),
      start: t('searchRoute'),
      replan: t('nativePlanAgain'),
      loading: t('nativeRouteLoadingRoutes'),
      chooseDestination: t('chooseDestination'),
      startNav: t('startNav'),
      routeOptions: t('nativeRouteSuggested'),
      close: t('close'),
      facilityFilterTitle: t('nativeRouteFacilityFilterTitle'),
    },
  };
}
