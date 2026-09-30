import { GeoJSONSource, Images, Layer, type GeoJSONSourceRef } from '@maplibre/maplibre-react-native';
import { router, usePathname } from 'expo-router';
import { useRef } from 'react';

import { mapCamera } from '../controller/mapCamera';
import { toFacilityCollection } from '../domain/facilities';
import { isPlaceDetailPath } from '../domain/sheetInset';
import { FACILITY_CLUSTER_COLOR, FACILITY_COLORS } from '../domain/facilityStyle';
import { useFacilityPills } from '../hooks/useFacilityPills';
import { useFacilityStore } from '../store/facilityStore';

/** Lucide 白色圖示（elevator＝arrow-up-down、ramp＝accessibility、toilet＝toilet），疊在類別色圓底上。 */
const FACILITY_ICONS = {
  'facility-elevator': require('../../../../assets/map-icons/elevator.png'),
  'facility-ramp': require('../../../../assets/map-icons/ramp.png'),
  'facility-toilet': require('../../../../assets/map-icons/toilet.png'),
};

/**
 * 無障礙設施圖層：原生 GeoJSONSource cluster（ADR-04）。
 * GeoJSONSource 每次 render 都會 JSON.stringify(data)，所以 collection 只在設施或選取類別變動時重建
 * （React Compiler 依 facilities／selected 自動 memo）。
 */
export default function FacilityLayer() {
  const facilities = useFacilityStore((state) => state.facilities);
  const selected = useFacilityStore((state) => state.selected);
  const sourceRef = useRef<GeoJSONSourceRef>(null);
  const pathname = usePathname();
  // 首頁已用距離 pill 標出的最近設施，不再畫圓點（見 FacilityPills）
  const pillIds = new Set(useFacilityPills().map((pill) => pill.id));

  if (!facilities || selected.length === 0) return null;
  const collection = toFacilityCollection(
    pillIds.size > 0 ? facilities.filter((facility) => !pillIds.has(facility.id)) : facilities,
    new Set(selected),
  );

  const handleClusterPress = async (clusterId: number, center: [number, number]) => {
    try {
      const zoom = await sourceRef.current?.getClusterExpansionZoom(clusterId);
      if (zoom !== undefined) mapCamera.easeTo(center, zoom);
    } catch (error) {
      console.warn('[facility] cluster expansion failed', error);
    }
  };

  return (
    <>
    <Images images={FACILITY_ICONS} />
      <GeoJSONSource
        ref={sourceRef}
        id="facilities"
        data={collection}
        cluster
        clusterRadius={50}
        clusterMaxZoom={16}
        onPress={(event) => {
          const feature = event.nativeEvent.features[0];
          if (!feature || feature.geometry.type !== 'Point') return;
          event.stopPropagation();
          const [lng, lat] = feature.geometry.coordinates;
          const clusterId = feature.properties?.cluster_id;
          if (typeof clusterId === 'number' && typeof lng === 'number' && typeof lat === 'number') {
            void handleClusterPress(clusterId, [lng, lat]);
            return;
          }
          const id = feature.properties?.id;
          if (typeof id !== 'string') return;
          // 已經在看設施詳情時換成新的設施（像 Apple 地圖換卡片），不要一路疊頁面
          const target = { pathname: '/facility/[id]', params: { id } } as const;
          if (isPlaceDetailPath(pathname)) router.replace(target);
          else router.navigate(target);
        }}>
        <Layer
          id="facility-clusters"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': FACILITY_CLUSTER_COLOR,
            'circle-radius': ['step', ['get', 'point_count'], 16, 50, 22, 200, 28],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF',
          }}
        />
        <Layer
          id="facility-cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 13,
            'text-allow-overlap': true,
          }}
          paint={{ 'text-color': '#FFFFFF' }}
        />
        <Layer
          id="facility-points"
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
            'circle-stroke-color': '#FFFFFF',
          }}
        />
        <Layer
          id="facility-icons"
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
