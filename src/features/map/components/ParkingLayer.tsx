import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { useMemo } from 'react';

import { parkingItemLngLat } from '../domain/parking';
import { useParkingStore } from '../store/parkingStore';
import { FACILITY, WHITE } from '@/shared/theme';

const PARKING_COLOR = FACILITY.parking.line;

/**
 * 附近無障礙停車（中性灰 P）：設計上主角是無障礙設施與路線，停車點縮小、放大到 zoom 15 才出現。資料由 useNearbyParking 依位置更新。
 * `collection` 用 `useMemo` 鎖在 `items` 沒變就不重建：`GeoJSONSource` 收到新的 `data` 參照就會整個
 * 重新索引／重新 cluster，拖曳地圖時若剛好有無關的 re-render（例如其他 store 更新）重建了這個物件，
 * 點位會跟著原生重新計算的結果瞬間跳位（使用者回饋：拖曳地圖時 marker 位置跳躍／瞬移）。
 */
export default function ParkingLayer() {
  const items = useParkingStore((state) => state.items);
  const collection = useMemo((): FeatureCollection<Point, { id: string }> => {
    const features: Feature<Point, { id: string }>[] = [];
    for (const item of items ?? []) {
      const position = parkingItemLngLat(item);
      if (!position) continue;
      features.push({
        type: 'Feature',
        id: item._id,
        geometry: { type: 'Point', coordinates: [position.lng, position.lat] },
        properties: { id: item._id },
      });
    }
    return { type: 'FeatureCollection', features };
  }, [items]);

  if (!items || items.length === 0) return null;

  return (
    <GeoJSONSource id="parking" data={collection}>
      <Layer
        id="parking-points"
        type="circle"
        minzoom={15}
        paint={{
          'circle-color': PARKING_COLOR,
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': WHITE,
        }}
      />
      <Layer
        id="parking-label"
        type="symbol"
        minzoom={15}
        layout={{ 'text-field': 'P', 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-allow-overlap': true }}
        paint={{ 'text-color': WHITE }}
      />
    </GeoJSONSource>
  );
}
