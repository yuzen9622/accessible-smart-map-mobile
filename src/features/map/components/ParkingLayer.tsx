import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection, Point } from 'geojson';

import { parkingItemLngLat } from '../domain/parking';
import { useParkingStore } from '../store/parkingStore';
import { FACILITY, WHITE } from '@/shared/theme';

const PARKING_COLOR = FACILITY.parking.line;

/** 附近無障礙停車（中性灰 P）：設計上主角是無障礙設施與路線，停車點縮小、放大到 zoom 15 才出現。資料由 useNearbyParking 依位置更新。 */
export default function ParkingLayer() {
  const items = useParkingStore((state) => state.items);
  if (!items || items.length === 0) return null;

  const features: Feature<Point, { id: string }>[] = [];
  for (const item of items) {
    const position = parkingItemLngLat(item);
    if (!position) continue;
    features.push({
      type: 'Feature',
      id: item._id,
      geometry: { type: 'Point', coordinates: [position.lng, position.lat] },
      properties: { id: item._id },
    });
  }
  const collection: FeatureCollection<Point, { id: string }> = { type: 'FeatureCollection', features };

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
