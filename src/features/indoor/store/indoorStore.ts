import { create } from 'zustand';

import { ApiError } from '@/shared/api';
import { logger } from '@/shared/logger';

import { loadVenue, loadVenues } from '../api/venueApi';
import type { VenueDetail, VenueRoute, VenueSummary } from '../types/venue';

export type Resource<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };
export interface FloorSelection { buildingId: string | null; levelRef: string | null }
export type IndoorGuidance =
  | { status: 'idle' }
  | { status: 'guiding'; stepIndex: number; confirmed: FloorSelection }
  | { status: 'complete'; confirmed: FloorSelection };

/** 圖資、瀏覽樓層及手動步驟執行器；起訖與規劃結果由既有 route session 擁有。 */
export interface IndoorState {
  active: boolean;
  catalog: Resource<VenueSummary[]>;
  venue: Resource<VenueDetail>;
  selectedVenueId: string | null;
  floor: FloorSelection;
  selectedPlaceId: string | null;
  plan: Resource<VenueRoute>;
  guidance: IndoorGuidance;
  notice: string | null;
  loadCatalog: () => Promise<void>;
  selectVenue: (venueId: string) => Promise<void>;
  exitVenue: () => void;
  suspend: () => void;
  resume: () => void;
  selectFloor: (floor: FloorSelection) => void;
  selectPlace: (id: string) => void;
  clearRoute: () => void;
  startGuidance: () => void;
  confirmStep: () => void;
  endGuidance: () => void;
  adoptRoute: (route: VenueRoute, signal?: AbortSignal) => Promise<boolean>;
}

function messageFor(error: unknown): string {
  logger.warn('[indoor] request failed', error instanceof ApiError
    ? { code: error.code, reason: error.reason, message: error.message }
    : { message: error instanceof Error ? error.message : 'Unknown error' });
  return '無法載入建築地圖，請稍後重試。';
}

function initialFloor(detail: VenueDetail): FloorSelection {
  const building = detail.buildings[0];
  const level = building?.levels.find((item) => item.ref === '1F' || item.ref === '1') ?? building?.levels[0];
  return { buildingId: building?.id ?? null, levelRef: level?.ref ?? null };
}

export function createIndoorStore() {
  let catalogController: AbortController | null = null;
  let venueController: AbortController | null = null;
  let venueGeneration = 0;
  let adoptionGeneration = 0;

  return create<IndoorState>((set, get) => ({
    active: false, catalog: { status: 'idle' }, venue: { status: 'idle' },
    selectedVenueId: null, floor: { buildingId: null, levelRef: null }, selectedPlaceId: null,
    plan: { status: 'idle' }, guidance: { status: 'idle' }, notice: null,
    loadCatalog: async () => {
      catalogController?.abort();
      const controller = new AbortController();
      catalogController = controller;
      set({ catalog: { status: 'loading' } });
      try {
        const data = await loadVenues(controller.signal);
        if (catalogController !== controller || controller.signal.aborted) return;
        set({ catalog: { status: 'ready', data } });
      } catch (error) {
        if (catalogController !== controller || controller.signal.aborted) return;
        set({ catalog: { status: 'error', message: messageFor(error) } });
      }
    },
    selectVenue: async (venueId) => {
      venueController?.abort();
      const generation = ++venueGeneration;
      const controller = new AbortController();
      venueController = controller;
      set({ active: true, selectedVenueId: venueId, venue: { status: 'loading' },
        selectedPlaceId: null, plan: { status: 'idle' }, guidance: { status: 'idle' }, notice: null });
      try {
        const data = await loadVenue(venueId, controller.signal);
        if (generation !== venueGeneration || controller.signal.aborted) return;
        set({ venue: { status: 'ready', data }, floor: initialFloor(data) });
      } catch (error) {
        if (generation !== venueGeneration || controller.signal.aborted) return;
        set({ venue: { status: 'error', message: messageFor(error) } });
      }
    },
    exitVenue: () => {
      adoptionGeneration += 1;
      venueGeneration += 1;
      venueController?.abort();
      set({ active: false, selectedVenueId: null, venue: { status: 'idle' },
        selectedPlaceId: null, plan: { status: 'idle' }, guidance: { status: 'idle' }, notice: null });
    },
    suspend: () => { adoptionGeneration += 1; set({ active: false }); },
    resume: () => { if (get().venue.status === 'ready') set({ active: true }); },
    selectFloor: (floor) => {
      const venue = get().venue;
      if (venue.status !== 'ready') return;
      if (floor.buildingId === null && floor.levelRef === null) { set({ floor }); return; }
      if (venue.data.buildings.some((b) => b.id === floor.buildingId && b.levels.some((l) => l.ref === floor.levelRef))) set({ floor });
    },
    selectPlace: (id) => {
      const venue = get().venue;
      if (venue.status !== 'ready') return;
      const place = venue.data.places.find((p) => p.id === id);
      if (place) set({ selectedPlaceId: id, floor: { buildingId: place.buildingId, levelRef: place.levelRef } });
    },
    clearRoute: () => { adoptionGeneration += 1; set({ plan: { status: 'idle' }, guidance: { status: 'idle' }, notice: null }); },
    startGuidance: () => {
      const { plan } = get();
      if (plan.status !== 'ready' || plan.data.steps.length === 0) return;
      const confirmed = { buildingId: plan.data.path.buildingIds[0] ?? null, levelRef: plan.data.path.levelRefs[0] ?? null };
      set({ guidance: { status: 'guiding', stepIndex: 0, confirmed }, floor: confirmed });
    },
    confirmStep: () => {
      const { plan, guidance } = get();
      if (plan.status !== 'ready' || guidance.status !== 'guiding') return;
      const step = plan.data.steps[guidance.stepIndex];
      if (!step) return;
      const confirmed = { buildingId: plan.data.path.buildingIds[step.pathEnd] ?? null, levelRef: plan.data.path.levelRefs[step.pathEnd] ?? null };
      const next = guidance.stepIndex + 1;
      set({ guidance: next >= plan.data.steps.length ? { status: 'complete', confirmed } : { status: 'guiding', stepIndex: next, confirmed }, floor: confirmed });
    },
    endGuidance: () => set({ guidance: { status: 'idle' } }),
    adoptRoute: async (route, signal) => {
      if (signal?.aborted) return false;
      const adoption = ++adoptionGeneration;
      const generation = venueGeneration + 1;
      await get().selectVenue(route.venueId);
      if (generation !== venueGeneration || adoption !== adoptionGeneration || signal?.aborted) return false;
      const state = get();
      if (state.venue.status !== 'ready' || state.venue.data.venueId !== route.venueId) return false;
      if (state.venue.data.version !== route.venueVersion) { set({ notice: '建築資料已更新，請重新規劃路線。' }); return false; }
      if (![route.fromPlaceId, route.toPlaceId].every((id) => state.venue.status === 'ready' && state.venue.data.places.some((p) => p.id === id))) {
        set({ notice: '起訖地點已變更，請重新規劃路線。' }); return false;
      }
      set({ active: true, plan: { status: 'ready', data: route },
        floor: { buildingId: route.path.buildingIds[0] ?? null, levelRef: route.path.levelRefs[0] ?? null }, notice: null });
      return true;
    },
  }));
}

export const useIndoorStore = createIndoorStore();
