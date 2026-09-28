import { create } from 'zustand';

import type { AccessibleRoute, BusLeg } from '@/features/route/domain';

import type { LiveBus } from '../types/transit';

/**
 * 移植自 Web `useMapStore` 的 `activeBusLeg`／`liveBusPositions`（`src/stores/map/createTransitSlice.ts`，
 * commit 5eadc71），拆成 bus feature 自有 store（ADR-14）。
 *
 * `activeBusLeg` 是使用者**展開**的那一段公車 leg；只有它存在時才輪詢即時車輛（Web 的決策：
 * 選了路線不啟動任何請求，直到使用者要看特定一段）。Web 在換路線時由 route slice 順手清掉這兩個欄位；
 * 本 App 改由 bus feature 自己觀察路線選擇（`useLiveBusTracking`），route 不寫別人的 store。
 */
export interface ActiveBusLeg {
  /** 重啟輪詢的唯一依據（見 {@link busLegKey}）；同一段 leg 物件重建但內容相同不會重啟。 */
  key: string;
  leg: BusLeg;
  /** 這段 leg 所屬的路線物件；選中的路線換成別的物件（重新規劃、重算）時追蹤要清掉。 */
  route: AccessibleRoute;
}

interface BusState {
  activeBusLeg: ActiveBusLeg | null;
  liveBusPositions: LiveBus[];
  setActiveBusLeg: (active: ActiveBusLeg | null) => void;
  setLiveBusPositions: (buses: LiveBus[]) => void;
}

export const useBusStore = create<BusState>()((set) => ({
  activeBusLeg: null,
  liveBusPositions: [],
  setActiveBusLeg: (activeBusLeg) => set(activeBusLeg ? { activeBusLeg } : { activeBusLeg: null, liveBusPositions: [] }),
  setLiveBusPositions: (liveBusPositions) => set({ liveBusPositions }),
}));

/**
 * 對齊 Web 的組成（`routeIndex:legIndex:routeName:direction:departureStop`），再加上 `routeId`：
 * 重新規劃後選中的永遠是 index 0，只看位置會把新路線的 leg 當成舊的，繼續追上一組路線的車。
 */
export function busLegKey(route: AccessibleRoute, routeIndex: number, legIndex: number, leg: BusLeg): string {
  return [route.routeId, routeIndex, legIndex, leg.subRouteName ?? leg.routeName, leg.direction, leg.departureStop].join(':');
}
