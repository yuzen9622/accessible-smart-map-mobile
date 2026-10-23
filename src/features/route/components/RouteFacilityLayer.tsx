import { GeoJSONSource, Images, Layer, type GeoJSONSourceRef } from '@maplibre/maplibre-react-native';
import { useRef } from 'react';

import {
  FACILITY_CLUSTER_COLOR,
  FACILITY_COLORS,
  mapCamera,
  toFacilityCollection,
  useFacilityStore,
  type Facility,
} from '@/features/map';
import { logger } from '@/shared/logger';

import { filterPointsAlongRoute } from '../domain/geo';
import type { LngLatTuple } from '../types/route';
import { useRouteSessionStore } from '../store/routeSessionStore';
import { WHITE } from '@/shared/theme';

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
 * 預設顯示沿途全部類別的設施，但使用者可以在規劃路線面板用 `facilityFilter` 篩選（使用者回饋
 * 2026-10-15：圖示太多太亂）。同樣用原生 GeoJSONSource cluster 聚合（跟 `FacilityLayer` 同一套，
 * ADR-04）：點數多時先顯示數量徽章，點一下放大到看得清個別圖示的程度。
 */
export default function RouteFacilityLayer() {
  const route = useRouteSessionStore((s) => s.navigationRoute?.route ?? s.selectRoute?.route ?? null);
  const facilityFilter = useRouteSessionStore((s) => s.facilityFilter);
  const facilities = useFacilityStore((state) => state.facilities);
  const sourceRef = useRef<GeoJSONSourceRef>(null);

  if (!route || !facilities?.length || facilityFilter.length === 0) return null;

  const polyline: LngLatTuple[] = route.legs.flatMap((leg) => leg.polyline);
  const nearby: Facility[] = filterPointsAlongRoute(facilities, polyline, ALONG_ROUTE_MAX_DISTANCE_M);
  if (nearby.length === 0) return null;

  const collection = toFacilityCollection(nearby, new Set(facilityFilter));

  const handleClusterPress = async (clusterId: number, center: [number, number]) => {
    try {
      const zoom = await sourceRef.current?.getClusterExpansionZoom(clusterId);
      if (zoom !== undefined) mapCamera.easeTo(center, zoom);
    } catch (error) {
      logger.warn('[route] facility cluster expansion failed', error);
    }
  };

  return (
    <>
      <Images images={FACILITY_ICONS} />
      <GeoJSONSource
        ref={sourceRef}
        id="route-facilities"
        data={collection}
        cluster
        // 沿途設施沒有首頁 `FacilityPills` 先篩掉最近的那幾個，車站、賣場旁常常同時有好幾個廁所／電梯
        // 擠在幾十公尺內；clusterRadius 比首頁圖層（50）大，讓這些點更容易先合併成一顆數字徽章，
        // 而不是縮圖未展開時一堆馬桶圖示疊在一起（使用者回饋：規劃路線的設施顯示太醜了好多馬桶）。
        clusterRadius={80}
        clusterMaxZoom={16}
        onPress={(event) => {
          const feature = event.nativeEvent.features[0];
          if (!feature || feature.geometry.type !== 'Point') return;
          event.stopPropagation();
          const [lng, lat] = feature.geometry.coordinates;
          const clusterId = feature.properties?.cluster_id;
          if (typeof clusterId === 'number' && typeof lng === 'number' && typeof lat === 'number') {
            void handleClusterPress(clusterId, [lng, lat]);
          }
        }}>
        <Layer
          id="route-facility-clusters"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': FACILITY_CLUSTER_COLOR,
            'circle-radius': ['step', ['get', 'point_count'], 16, 50, 22, 200, 28],
            'circle-stroke-width': 2,
            'circle-stroke-color': WHITE,
          }}
        />
        <Layer
          id="route-facility-cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 13,
            'text-allow-overlap': true,
          }}
          paint={{ 'text-color': WHITE }}
        />
        <Layer
          id="route-facility-points"
          type="circle"
          filter={['!', ['has', 'point_count']]}
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
            'circle-stroke-color': WHITE,
          }}
        />
        <Layer
          id="route-facility-icons"
          type="symbol"
          filter={['!', ['has', 'point_count']]}
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
