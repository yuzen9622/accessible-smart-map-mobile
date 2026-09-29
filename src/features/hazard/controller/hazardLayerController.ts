import { create } from 'zustand';

import { useUserLocationStore } from '@/features/map';
import { hasMovedBeyond, type LatLng } from '@/shared/geo';

import { getNearbyHazardReports } from '../api/hazardApi';
import type { HazardReport } from '../domain/types';

/**
 * 附近通報（地圖圖層與詳情共用）。對齊 Web `HazardWrapper.tsx`（commit f82cda8）以使用者位置查 1000 m 內的通報；
 * 差異：Web 每次位置更新都重查，原生改為移動 ≥ 100 m 才重查（同 ParkingLayer 的 `hasMovedBeyond` 門檻），
 * 投過票的 id 同樣只存在本次執行（Web `votedIds`）。
 */

const RADIUS_M = 1000;

interface HazardLayerState {
  reports: HazardReport[];
  votedIds: string[];
}

export const useHazardLayerStore = create<HazardLayerState>(() => ({ reports: [], votedIds: [] }));

let lastQueried: LatLng | null = null;
let inflight: AbortController | null = null;

export async function refreshNearbyHazards(force = false): Promise<void> {
  const position = useUserLocationStore.getState().position;
  if (!position) return;
  if (!force && !hasMovedBeyond(lastQueried, position)) return;
  lastQueried = position;
  inflight?.abort();
  const controller = new AbortController();
  inflight = controller;
  try {
    const reports = await getNearbyHazardReports(position.lat, position.lng, RADIUS_M, controller.signal);
    if (!controller.signal.aborted) useHazardLayerStore.setState({ reports });
  } catch {
    // 圖層資料是輔助資訊：失敗保留上一次的結果
  }
}

export function updateReport(report: HazardReport): void {
  useHazardLayerStore.setState((s) => ({ reports: s.reports.map((r) => (r._id === report._id ? report : r)) }));
}

export function markVoted(id: string): void {
  useHazardLayerStore.setState((s) => (s.votedIds.includes(id) ? s : { votedIds: [...s.votedIds, id] }));
}
