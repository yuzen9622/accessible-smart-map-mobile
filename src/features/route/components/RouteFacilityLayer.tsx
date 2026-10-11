import { GeoJSONSource, Images, Layer } from '@maplibre/maplibre-react-native';

import {
  FACILITY_COLORS,
  PINNED_FACILITY_CATEGORIES,
  toFacilityCollection,
  useFacilityStore,
  type Facility,
} from '@/features/map';

import { filterPointsAlongRoute } from '../domain/geo';
import type { LngLatTuple } from '../types/route';
import { useRouteSessionStore } from '../store/routeSessionStore';

/** 與 `features/map` 的 `FacilityLayer` 共用同一組圖示資源；路線沿途圖層獨立疊圖，
 * source id 不與首頁常駐圖層的 `facilities` 衝突。 */
const FACILITY_ICONS = {
  'facility-elevator': require('../../../../assets/map-icons/elevator.png'),
  'facility-ramp': require('../../../../assets/map-icons/ramp.png'),
  'facility-toilet': require('../../../../assets/map-icons/toilet.png'),
};

const ALONG_ROUTE_MAX_DISTANCE_M = 100;

/**
 * 路線沿途（規劃預覽／導航中）100 公尺內的無障礙設施圖層，與「使用者目前位置附近」的
 * `FacilityLayer` 邏輯分開（測試人員回饋 2026-10-11）：不受首頁「預設顯示設施」勾選限制，
 * 只要路線存在就顯示沿途全部類別的設施，幫助使用者在走之前先知道路上有哪些無障礙設施。
 */
export default function RouteFacilityLayer() {
  const route = useRouteSessionStore((s) => s.navigationRoute?.route ?? s.selectRoute?.route ?? null);
  const facilities = useFacilityStore((state) => state.facilities);

  if (!route || !facilities?.length) return null;

  const polyline: LngLatTuple[] = route.legs.flatMap((leg) => leg.polyline);
  const nearby: Facility[] = filterPointsAlongRoute(facilities, polyline, ALONG_ROUTE_MAX_DISTANCE_M);
  if (nearby.length === 0) return null;

  const collection = toFacilityCollection(nearby, new Set(PINNED_FACILITY_CATEGORIES));

  return (
    <>
      <Images images={FACILITY_ICONS} />
      <GeoJSONSource id="route-facilities" data={collection}>
        <Layer
          id="route-facility-points"
          type="circle"
          paint={{
            'circle-color': [
              'match',
              ['get', 'category'],
              'elevator',
              FACILITY_COLORS.elevator,
              'ramp',
              FACILITY_COLORS.ramp,
              FACILITY_COLORS.toilet,
            ],
            'circle-radius': 14,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF',
          }}
        />
        <Layer
          id="route-facility-icons"
          type="symbol"
          layout={{
            'icon-image': ['concat', 'facility-', ['get', 'category']],
            'icon-size': 0.24,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          }}
        />
      </GeoJSONSource>
    </>
  );
}
