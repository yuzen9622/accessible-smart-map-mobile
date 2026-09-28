import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection, Point } from 'geojson';

import { parkingItemLngLat } from '../domain/parking';
import { useParkingStore } from '../store/parkingStore';

const PARKING_COLOR = '#3949AB';

/** 附近無障礙停車（藍紫色 P）。資料由 useNearbyParking 依位置更新。 */
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
        minzoom={13}
        paint={{
          'circle-color': PARKING_COLOR,
          'circle-radius': 10,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        }}
      />
      <Layer
        id="parking-label"
        type="symbol"
        minzoom={13}
        layout={{ 'text-field': 'P', 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-allow-overlap': true }}
        paint={{ 'text-color': '#FFFFFF' }}
      />
    </GeoJSONSource>
  );
}
