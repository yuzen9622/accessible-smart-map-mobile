import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection, Point } from 'geojson';

import { useAiResultStore } from '../store/aiResultStore';

const PLACE_COLOR = '#7B3FE4';
const FACILITY_COLOR = '#0065C8';

type MarkerProps = { id: string; title: string; place: boolean };

/**
 * AI 工具結果的地圖點（SDD §4.4 `AIResultLayer`，對應 Web `AIResultWrapper`＋aiResultMarkers）：
 * 紫色＝一般地點（findGooglePlaces），藍色＝無障礙設施；附標題。資料由 `actionExecutor` 寫入。
 */
export default function AIResultLayer() {
  const markers = useAiResultStore((state) => state.markers);
  if (markers.length === 0) return null;

  const features: Feature<Point, MarkerProps>[] = markers.map((marker) => ({
    type: 'Feature',
    id: marker.id,
    geometry: { type: 'Point', coordinates: [marker.position.lng, marker.position.lat] },
    properties: { id: marker.id, title: marker.title, place: marker.kind === 'place' },
  }));
  const collection: FeatureCollection<Point, MarkerProps> = { type: 'FeatureCollection', features };

  return (
    <GeoJSONSource id="ai-results" data={collection}>
      <Layer
        id="ai-results-points"
        type="circle"
        paint={{
          'circle-color': ['case', ['get', 'place'], PLACE_COLOR, FACILITY_COLOR],
          'circle-radius': 9,
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#FFFFFF',
        }}
      />
      <Layer
        id="ai-results-label"
        type="symbol"
        minzoom={14}
        layout={{
          'text-field': ['get', 'title'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-max-width': 10,
        }}
        paint={{ 'text-color': '#1C1C1E', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 }}
      />
    </GeoJSONSource>
  );
}
