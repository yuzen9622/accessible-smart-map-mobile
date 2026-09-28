import { useEffect, useState } from 'react';

import type { LatLng } from '@/shared/geo';

import { searchBusRoutes, searchBusStops } from '../api/transit';
import type { BusSearchResult, BusStopSearchResult } from '../types/transit';

export type BusSearchMode = 'route' | 'stop';

export type BusSearchState =
  | { mode: 'route'; results: BusSearchResult[]; loading: boolean; error: BusSearchError | null }
  | { mode: 'stop'; results: BusStopSearchResult[]; loading: boolean; error: BusSearchError | null };

type StoredState = BusSearchState & { query: string };

const DEBOUNCE_MS = 400;
/**
 * 錯誤一律以代碼回報，UI 依代碼顯示 i18n 文案（不顯示後端或 fetch 的原文；成功信封的 message 是 "success"）。
 * - `NO_DATA`：回應形狀不對；`TIMEOUT`：10 秒逾時；`NETWORK`：其他失敗。
 */
export type BusSearchError = 'NO_DATA' | 'TIMEOUT' | 'NETWORK';
export const BUS_SEARCH_NO_DATA: BusSearchError = 'NO_DATA';

function errorCode(err: unknown): BusSearchError {
  return err instanceof Error && err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
}

function emptyState(mode: BusSearchMode, loading: boolean, error: BusSearchError | null): BusSearchState {
  return mode === 'route' ? { mode, results: [], loading, error } : { mode, results: [], loading, error };
}

function stored(query: string, state: BusSearchState): StoredState {
  return { ...state, query };
}

/**
 * 公車路線／站牌搜尋（對齊 Web `useBusSearch`，commit 5eadc71：400 ms debounce、換關鍵字丟掉舊結果）。
 * 差異：舊請求改以 AbortController 真的取消（Web 只用 `active` 旗標忽略結果）；結果依 mode 分型別，
 * 不再是兩種結果混在同一個陣列。
 */
export function useBusSearch(keyword: string, mode: BusSearchMode, location?: LatLng | null): BusSearchState {
  const trimmed = keyword.trim();
  // 初始 query 設為空字串：一掛上就有關鍵字時，第一個 render 即顯示載入中（對齊 Web 在 effect 裡先 setLoading(true)）。
  const [state, setState] = useState<StoredState>(() => stored('', emptyState(mode, false, null)));
  // 位置取到小數第 3 位（約 100 m）：定位每秒微幅更新時不必重新搜尋，排序用的「附近」也不受影響。
  const lat = location ? Math.round(location.lat * 1000) / 1000 : undefined;
  const lng = location ? Math.round(location.lng * 1000) / 1000 : undefined;

  useEffect(() => {
    const controller = new AbortController();
    const near = lat !== undefined && lng !== undefined ? { lat, lng } : null;

    const handler = setTimeout(
      async () => {
        if (!trimmed) {
          setState(stored(trimmed, emptyState(mode, false, null)));
          return;
        }
        try {
          if (mode === 'route') {
            const res = await searchBusRoutes(trimmed, near, controller.signal);
            if (controller.signal.aborted) return;
            setState({ query: trimmed, mode, results: res.data?.routes ?? [], loading: false, error: res.data ? null : BUS_SEARCH_NO_DATA });
          } else {
            const res = await searchBusStops(trimmed, near, controller.signal);
            if (controller.signal.aborted) return;
            setState({ query: trimmed, mode, results: res.data?.stops ?? [], loading: false, error: res.data ? null : BUS_SEARCH_NO_DATA });
          }
        } catch (err) {
          if (controller.signal.aborted) return;
          setState(stored(trimmed, emptyState(mode, false, errorCode(err))));
        }
      },
      trimmed ? DEBOUNCE_MS : 0,
    );

    return () => {
      controller.abort();
      clearTimeout(handler);
    };
  }, [trimmed, mode, lat, lng]);

  // 關鍵字或模式剛變、結果還沒回來：立刻清掉舊結果並顯示載入中（對齊 Web 在 debounce 前就清空）。
  if (state.query !== trimmed || state.mode !== mode) return emptyState(mode, trimmed.length > 0, null);
  const { query: _query, ...visible } = state;
  return visible;
}
