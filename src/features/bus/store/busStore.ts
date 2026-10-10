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
  /**
   * 導航判定使用者已上車：不再追「開往上車站的車」，改查這台車（`plate`）到下車站的時間。
   * `plate` 為 null＝上車時沒鎖到車牌，沒有可對應的即時資料，不再發請求。
   */
  boarded?: { plate: string | null };
}

/** 導航用的即時分鐘數：等車時是規劃班次到上車站，已上車時是使用者那台車到下車站；查不到為 null。 */
export interface LegArrival {
  stop: 'board' | 'alight';
  eta: number | null;
}

interface BusState {
  activeBusLeg: ActiveBusLeg | null;
  liveBusPositions: LiveBus[];
  legArrival: LegArrival | null;
  setActiveBusLeg: (active: ActiveBusLeg | null) => void;
  setLiveBusPositions: (buses: LiveBus[]) => void;
  setLegArrival: (arrival: LegArrival | null) => void;
  /** 只標記目前這段（`key` 相同）；leg 已換掉的晚到判定不得套到新的 leg。 */
  markBoarded: (key: string, plate: string | null) => void;
}

export const useBusStore = create<BusState>()((set) => ({
  activeBusLeg: null,
  liveBusPositions: [],
  legArrival: null,
  // 換成另一段 leg（key 不同）時，上一段的車輛與分鐘數立刻作廢，不等 watcher 清理。
  setActiveBusLeg: (activeBusLeg) =>
    set((state) =>
      activeBusLeg && state.activeBusLeg?.key === activeBusLeg.key
        ? { activeBusLeg }
        : { activeBusLeg, liveBusPositions: [], legArrival: null },
    ),
  setLiveBusPositions: (liveBusPositions) => set({ liveBusPositions }),
  setLegArrival: (legArrival) => set({ legArrival }),
  markBoarded: (key, plate) =>
    set((state) =>
      state.activeBusLeg?.key === key && !state.activeBusLeg.boarded
        ? { activeBusLeg: { ...state.activeBusLeg, boarded: { plate } } }
        : state,
    ),
}));

/**
 * 對齊 Web 的組成（`routeIndex:legIndex:routeName:direction:departureStop`），再加上 `routeId`：
 * 重新規劃後選中的永遠是 index 0，只看位置會把新路線的 leg 當成舊的，繼續追上一組路線的車。
 */
export function busLegKey(route: AccessibleRoute, routeIndex: number, legIndex: number, leg: BusLeg): string {
  return [route.routeToken, route.routeId, routeIndex, legIndex, leg.subRouteName ?? leg.routeName, leg.direction, leg.departureStop].join(':');
}
