// bus 的純邏輯公開出口（與 `@/features/route/domain` 同一規則：不得 import react-native／expo）。
export {
  CURRENT_STOP_RADIUS_M,
  buildStopRows,
  equalStopName,
  fallbackStopRows,
  normalizeStopName,
  parseStatusLabel,
  pickDirection,
  resolveCurrentStopSeq,
  resolveEtaLabel,
  resolveLegDirection,
  resolveLegRide,
  resolveLegStops,
  sliceLegStops,
  type BusLegStopRow,
  type EtaLabel,
  type EtaLabelKind,
  type EtaTone,
  type LegRideRef,
  type StopRowKind,
  type StopRowState,
} from './busLegStops';
export {
  BUS_TWEEN_DURATION_MS,
  buildBusTweens,
  busFrame,
  easeOutCubic,
  type AnimatedBus,
  type BusTween,
  type DrawnPosition,
} from './busTween';
export {
  BUS_STATUS,
  type BusArrivalData,
  type BusArrivalItem,
  type BusSearchResult,
  type BusStopSearchResult,
  type LiveBus,
  type LiveBusPositionsData,
  type RouteDetailDirection,
  type RouteDetailStop,
  type StopArrival,
  type StopArrivalsData,
} from '../types/transit';
export { BUS_CITY_NAMES, busCityLabel, groupByCity, type BusCityGroup } from './busCities';
export { resolveStopBadge, type BusStopBadge, type BusStopBadgeKind, type BusStopBadgeTone } from './busStopBadge';
export {
  defaultDirection,
  resolveDirectionLabels,
  routePathOfDirection,
  stopsOfDirection,
  type DirectionLabels,
} from './busDirections';
export { firstParam, parseFiniteParam, parseRouteListParam } from './screenParams';
export {
  EMPTY_LIVE_BUSES,
  isAccessibleBus,
  liveBusCollection,
  selectDisplayBuses,
  type LiveBusProps,
} from './liveBusGeoJson';
export { resolveLiveEta, resolveWaitText, type LegText, type LiveEta, type LiveEtaTone } from './legBadges';
export {
  BUS_AT_STOP_RADIUS_M,
  isAccessibleArrival,
  matchStopInRoute,
  nextBusToStop,
  pickFeaturedArrival,
  placeBuses,
  routesWithoutArrivals,
  sortArrivals,
  stopsBounds,
  type ApproachingBus,
  type PlacedBus,
  type StopMatch,
} from './stopBoard';
