import { GeoJSONSource, Images, Layer, type GeoJSONSourceRef } from '@maplibre/maplibre-react-native';
import { router, usePathname } from 'expo-router';
import { useMemo, useRef } from 'react';

import { mapCamera } from '../controller/mapCamera';
import { toFacilityCollection } from '../domain/facilities';
import { isPlaceDetailPath } from '../domain/sheetInset';
import { FACILITY_CLUSTER_COLOR, FACILITY_COLORS } from '../domain/facilityStyle';
import { useFacilityPills } from '../hooks/useFacilityPills';
import { useFacilityStore } from '../store/facilityStore';
import { logger } from '@/shared/logger';
import { WHITE } from '@/shared/theme';

/** Lucide 白色圖示（elevator＝arrow-up-down、ramp＝accessibility、toilet＝toilet），疊在類別色圓底上。 */
const FACILITY_ICONS = {
  'facility-elevator': require('../../../../assets/map-icons/elevator.png'),
  'facility-ramp': require('../../../../assets/map-icons/ramp.png'),
  'facility-toilet': require('../../../../assets/map-icons/toilet.png'),
};

/**
 * 無障礙設施圖層：原生 GeoJSONSource cluster（ADR-04）。
 * GeoJSONSource 每次 render 都會 JSON.stringify(data)，所以用 `useMemo` 把 collection 鎖在
 * facilities／selected／pillIds 真的變動時才重建，不要單純交給 React Compiler 自動 memo：
 * `data` 參照一換，原生就會整個重新索引／重新 cluster，拖曳地圖時若剛好有無關的 re-render
 * （例如 GPS 位置更新、首頁 pill 清單重算）重建了這個物件，點位會跟著瞬間跳位
 * （使用者回饋：拖曳地圖時 marker 位置跳躍／瞬移）。
 */
export default function FacilityLayer() {
  const facilities = useFacilityStore((state) => state.facilities);
  const selected = useFacilityStore((state) => state.selected);
  const sourceRef = useRef<GeoJSONSourceRef>(null);
  const pathname = usePathname();
  // 首頁已用距離 pill 標出的最近設施，不再畫圓點（見 FacilityPills）
  const pills = useFacilityPills();
  // 用排序後的 id 字串當 key：pill 陣列每次 render 都是新參照，但「哪些 id 在內」沒變時這組字串不變。
  const pillIdsKey = pills.map((pill) => pill.id).sort().join(',');
  const collection = useMemo(() => {
    const pillIds = new Set(pillIdsKey ? pillIdsKey.split(',') : []);
    return toFacilityCollection(
      pillIds.size > 0 ? facilities?.filter((facility) => !pillIds.has(facility.id)) ?? [] : (facilities ?? []),
      new Set(selected),
    );
  }, [facilities, selected, pillIdsKey]);

  if (!facilities || selected.length === 0) return null;

  const handleClusterPress = async (clusterId: number, center: [number, number]) => {
    try {
      const zoom = await sourceRef.current?.getClusterExpansionZoom(clusterId);
      if (zoom !== undefined) mapCamera.easeTo(center, zoom);
    } catch (error) {
      logger.warn('[facility] cluster expansion failed', error);
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
            'circle-stroke-color': WHITE,
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
          paint={{ 'text-color': WHITE }}
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
            'circle-stroke-color': WHITE,
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
