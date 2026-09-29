// bus feature 公開出口（面板畫面、地圖圖層、路線卡的公車 leg 站序）。
export { useBusStore, busLegKey, type ActiveBusLeg } from './store/busStore';
export { useLiveBusTracking } from './hooks/useLiveBusTracking';
export { useBusLegStopEtas } from './hooks/useBusLegStopEtas';
export { useBusSearch, type BusSearchError, type BusSearchMode, type BusSearchState } from './hooks/useBusSearch';
export { getNearbyBusStops } from './api/transit';
export type { BusLegEtaStatus, LegEtaSnapshot } from './controller/busWatchers';
export * from './domain';
export { default as BusPanelScreen } from './screens/BusPanelScreen';
export { default as BusRouteScreen } from './screens/BusRouteScreen';
export { default as BusStopScreen } from './screens/BusStopScreen';
export { default as BusStopLayer } from './components/BusStopLayer';
export { default as LiveBusLayer } from './components/LiveBusLayer';
export { default as BusLegStops, type BusLegStopsProps } from './components/BusLegStops';
export { useBusPanelStore, type PanelStop } from './store/busPanelStore';
