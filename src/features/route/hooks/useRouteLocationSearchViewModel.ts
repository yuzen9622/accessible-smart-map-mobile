import { useEffect, useRef, useState } from 'react';

import { useUserLocationStore } from '@/features/map';
import {
  placeDisplayName,
  placeKey,
  resolveAutocompleteItem,
  resolveVenuePlace,
  venuePlaceSubtitle,
  useAutocomplete,
  useSavedPlacesStore,
  type AutocompleteItem,
  type PlaceDetail,
  type VenuePlaceDetail,
} from '@/features/place';
import { useAppTranslation } from '@/shared/i18n';
import { logger } from '@/shared/logger';

import { useRouteSessionStore } from '../store/routeSessionStore';
import type { PlanField } from './useRoutePlanViewModel';

export interface RouteLocationRow {
  key: string;
  title: string;
  subtitle: string | null;
  onPress: () => void;
}

export function useRouteLocationSearchViewModel(field: PlanField, onClose: () => void) {
  const { t } = useAppTranslation();
  const position = useUserLocationStore((state) => state.position);
  const history = useSavedPlacesStore((state) => state.searchHistory);
  const [query, setQuery] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const closed = useRef(false);
  const autocomplete = useAutocomplete(query, position ?? undefined);
  const hasQuery = query.trim().length > 0;

  useEffect(() => () => pending.current?.abort(), []);

  const close = () => {
    if (closed.current) return;
    closed.current = true;
    pending.current?.abort();
    onClose();
  };

  const commit = (entry: PlaceDetail) => {
    if (closed.current) return;
    useSavedPlacesStore.getState().addSearchHistory(entry);
    const store = useRouteSessionStore.getState();
    const name = placeDisplayName(entry);
    if (entry.kind === 'venue-place') store.setVenueEndpoint(field, entry);
    else if (field === 'origin') store.setOrigin(entry.position, name);
    else store.setDestination(entry.position, name);
    close();
  };

  const chooseVenue = async (entry: VenuePlaceDetail) => {
    if (closed.current || (pending.current && !pending.current.signal.aborted)) return;
    const controller = new AbortController();
    pending.current = controller;
    setResolving(true); setResolveError(null);
    try {
      const current = await resolveVenuePlace(entry, controller.signal);
      if (controller.signal.aborted) return;
      if (!current) { setResolveError('此地點資料已更新，請重新搜尋。'); return; }
      commit(current);
    } catch {
      if (!controller.signal.aborted) setResolveError(t('nativeRouteLocationResolveError'));
    } finally {
      if (pending.current === controller && !controller.signal.aborted) { pending.current = null; setResolving(false); }
    }
  };

  const chooseSuggestion = async (item: AutocompleteItem) => {
    if (closed.current || (pending.current && !pending.current.signal.aborted)) return;
    const controller = new AbortController();
    pending.current = controller;
    setResolving(true);
    setResolveError(null);
    try {
      const resolved = await resolveAutocompleteItem(item, autocomplete.sessionToken, controller.signal);
      if (controller.signal.aborted) return;
      if (!resolved) {
        setResolveError(t(field === 'origin' ? 'selectOriginFromSuggestions' : 'selectDestinationFromSuggestions'));
        return;
      }
      commit({ kind: 'coordinate', address: resolved.name, position: { lat: resolved.lat, lng: resolved.lng } });
    } catch (error) {
      if (controller.signal.aborted) return;
      logger.warn('[route] resolve endpoint failed', error);
      setResolveError(t('nativeRouteLocationResolveError'));
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setResolving(false);
      }
    }
  };

  const rows: RouteLocationRow[] = hasQuery
    ? [...(autocomplete.venueSuggestions ?? []).map((entry) => ({
        key: placeKey(entry), title: entry.name, subtitle: venuePlaceSubtitle(entry),
        onPress: () => void chooseVenue(entry),
      })), ...autocomplete.suggestions.map((item) => ({
        key: item.id,
        title: item.primaryText,
        subtitle: item.secondaryText,
        onPress: () => void chooseSuggestion(item),
      }))]
    : history.map((entry) => ({
        key: placeKey(entry),
        title: placeDisplayName(entry),
        subtitle: entry.kind === 'place' ? entry.place.fullAddress : entry.kind === 'venue-place' ? venuePlaceSubtitle(entry) : null,
        onPress: () => { if (!resolving) { if (entry.kind === 'venue-place') void chooseVenue(entry); else commit(entry); } },
      }));

  return {
    query,
    onQueryChange: (text: string) => { pending.current?.abort(); pending.current = null; setResolving(false); setResolveError(null); setQuery(text); },
    onClose: close,
    onDismiss: () => { closed.current = true; pending.current?.abort(); },
    rows,
    hasQuery,
    loading: hasQuery && autocomplete.loading,
    resolving,
    error: resolveError ?? (hasQuery && autocomplete.error ? t('nativeNetworkError') : null),
    onRetry: () => { setResolveError(null); autocomplete.retry(); },
    onUseMyLocation: field === 'origin' ? () => {
      if (closed.current || resolving) return;
      useRouteSessionStore.getState().setOrigin(null);
      close();
    } : null,
    labels: {
      title: t(field === 'origin' ? 'nativeRouteSearchOrigin' : 'nativeRouteSearchDestination'),
      placeholder: t('nativeRouteLocationPlaceholder'),
      close: t('close'),
      clear: t('nativeRouteClearSearch'),
      history: t('recentSearches'),
      suggestions: t('nativeRouteSearchSuggestions'),
      empty: t(hasQuery ? 'nativeRouteLocationNoResults' : 'nativeRouteNoSearchHistory'),
      searching: t('nativeSearching'),
      resolving: t('loading'),
      retry: t('retry'),
      useMyLocation: t('useMyLocationAsOrigin'),
    },
  };
}

export type RouteLocationSearchModel = ReturnType<typeof useRouteLocationSearchViewModel>;
