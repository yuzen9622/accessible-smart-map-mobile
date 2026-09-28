// bus feature 公開出口。地圖圖層、公車面板等 UI 在 Mac 上實作時再加進來。
export { useBusStore, busLegKey, type ActiveBusLeg } from './store/busStore';
export { useLiveBusTracking } from './hooks/useLiveBusTracking';
export { useBusLegStopEtas } from './hooks/useBusLegStopEtas';
export { useBusSearch, type BusSearchError, type BusSearchMode, type BusSearchState } from './hooks/useBusSearch';
export { getNearbyBusStops } from './api/transit';
export type { BusLegEtaStatus, LegEtaSnapshot } from './controller/busWatchers';
export * from './domain';
