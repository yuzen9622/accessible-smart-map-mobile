import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useUserLocationStore } from '@/features/map';
import { useOnboardingStore } from '@/features/onboarding';
import { resolveAutocompleteItem, useAutocomplete, type AutocompleteItem } from '@/features/place';
import { useAppTranslation } from '@/shared/i18n';

import { computeRoute } from '../controller/routeSessionPort';
import { ROUTE_FAILURE_I18N } from '../domain/routeRequest';
import {
  ROUTE_MODES,
  ROUTE_MODE_LABEL_KEY,
  TRAVEL_MODES,
  effectiveTravelMode,
  hasGatedTravelModes,
  isTravelModeAllowed,
} from '../domain/travelModes';
import { useRouteSessionStore } from '../store/routeSessionStore';
import type { RouteMode, TravelMode } from '../types/route';

export type PlanField = 'origin' | 'destination';

export interface PlanSuggestion {
  key: string;
  title: string;
  subtitle: string | null;
  onPress: () => void;
}

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
  editing: PlanField | null;
  query: string;
  suggestions: PlanSuggestion[];
  suggestionsLoading: boolean;
  resolving: boolean;
  travelModes: PlanOption<TravelMode>[];
  routeModes: PlanOption<RouteMode>[];
  gatedHint: string | null;
  canStart: boolean;
  loading: boolean;
  error: string | null;
  onEdit: (field: PlanField) => void;
  onCancelEdit: () => void;
  onQueryChange: (query: string) => void;
  onUseMyLocation: () => void;
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
    loading: string;
    chooseDestination: string;
  };
}

export interface RoutePlanParams {
  destLat?: string;
  destLng?: string;
  destName?: string;
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
  const destination = useRouteSessionStore((s) => s.destination);
  const destinationName = useRouteSessionStore((s) => s.destinationName);
  const isLoading = useRouteSessionStore((s) => s.isLoading);
  const lastFailure = useRouteSessionStore((s) => s.lastFailure);
  const storedTravelMode = useRouteSessionStore((s) => s.travelMode);
  const storedRouteMode = useRouteSessionStore((s) => s.routeMode);
  const profileRouteMode = useOnboardingStore((s) => s.profile.routeMode);
  const profileAvoidStairs = useOnboardingStore((s) => s.profile.avoidStairs);
  const profileRequireElevator = useOnboardingStore((s) => s.profile.requireElevator);
  const position = useUserLocationStore((s) => s.position);

  const [editing, setEditing] = useState<PlanField | null>(null);
  const [query, setQuery] = useState('');
  const [resolving, setResolving] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const { suggestions, loading: suggestionsLoading, resetSession } = useAutocomplete(
    editing ? query : '',
    position ?? undefined,
  );

  // 由地點詳情「規劃路線」帶入的目的地（只在參數改變時套用一次）。
  const destLat = parseCoord(params.destLat);
  const destLng = parseCoord(params.destLng);
  const destParamName = params.destName ?? '';
  useEffect(() => {
    if (destLat === null || destLng === null) return;
    useRouteSessionStore.getState().setDestination({ lat: destLat, lng: destLng }, destParamName);
  }, [destLat, destLng, destParamName]);

  const routeMode = storedRouteMode ?? profileRouteMode;
  const travelMode = effectiveTravelMode(routeMode, storedTravelMode);
  const originIsMyLocation = origin === null;
  const hasOrigin = originIsMyLocation ? position !== null : true;
  const canStart = hasOrigin && destination !== null && !isLoading && !resolving;

  const closeEditor = () => {
    setEditing(null);
    setQuery('');
    resetSession();
  };

  const choose = async (item: AutocompleteItem) => {
    const field = editing;
    if (!field) return;
    setResolving(true);
    try {
      const resolved = await resolveAutocompleteItem(item);
      if (!resolved) {
        setInputError(t(field === 'origin' ? 'selectOriginFromSuggestions' : 'selectDestinationFromSuggestions'));
        return;
      }
      const store = useRouteSessionStore.getState();
      const point = { lat: resolved.lat, lng: resolved.lng };
      if (field === 'origin') store.setOrigin(point, resolved.name);
      else store.setDestination(point, resolved.name);
      setInputError(null);
      closeEditor();
    } catch (error) {
      console.warn('[route] resolve place failed', error);
      setInputError(t('nativeRouteErrorFailed'));
    } finally {
      setResolving(false);
    }
  };

  const start = async () => {
    if (!destination) {
      setInputError(t('chooseDestination'));
      return;
    }
    if (originIsMyLocation && !position) {
      setInputError(t('enableLocationOrEnterOrigin'));
      return;
    }
    setInputError(null);
    const result = await computeRoute({
      origin: originIsMyLocation ? (position ?? undefined) : origin,
      destination,
      mode: routeMode,
      travelMode,
      avoidStairs: profileAvoidStairs,
      requireElevator: profileRequireElevator,
    });
    if (result.ok) {
      AccessibilityInfo.announceForAccessibility(t('nativeRoutesFound', { count: result.routes.length }));
      router.push('/routes');
      return;
    }
    if (result.failure !== 'superseded' && result.failure !== 'missing-input') {
      AccessibilityInfo.announceForAccessibility(t(ROUTE_FAILURE_I18N[result.failure].key));
    }
  };

  const failureText = lastFailure ? t(ROUTE_FAILURE_I18N[lastFailure].key) : null;
  const routeModeLabel = t(ROUTE_MODE_LABEL_KEY[routeMode]);

  return {
    originLabel: originIsMyLocation ? t('myLocation') : originName || t('origin'),
    originIsMyLocation,
    destinationLabel: destination ? destinationName || t('destination') : null,
    editing,
    query,
    suggestions: editing
      ? suggestions.map((item) => ({
          key: item.id,
          title: item.primaryText,
          subtitle: item.secondaryText,
          onPress: () => void choose(item),
        }))
      : [],
    suggestionsLoading,
    resolving,
    travelModes: TRAVEL_MODES.map((mode) => {
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
    gatedHint: hasGatedTravelModes(routeMode) ? t('travelModeGatedHint', { a11yMode: routeModeLabel }) : null,
    canStart,
    loading: isLoading,
    error: inputError ?? failureText,
    onEdit: (field) => {
      setEditing(field);
      setQuery('');
      setInputError(null);
    },
    onCancelEdit: closeEditor,
    onQueryChange: setQuery,
    onUseMyLocation: () => {
      useRouteSessionStore.getState().setOrigin(null);
      closeEditor();
    },
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
      loading: t('loadingRoute'),
      chooseDestination: t('chooseDestination'),
    },
  };
}
