import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { FeatureCollection, Point } from 'geojson';

import { useSosTrackerStore } from '../controller/trackerController';

const SOS_RED = '#C62828';

/** 求助者位置（SDD §4.4 `SosTrackerLayer`）：外圈半透明光暈＋實心點，取代 Web 的 React pulsing marker。 */
export default function SosTrackerLayer() {
  const session = useSosTrackerStore((s) => s.session);
  if (!session) return null;
  const collection: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [session.lng, session.lat] }, properties: {} }],
  };
  return (
    <GeoJSONSource id="sos-tracker" data={collection}>
      <Layer id="sos-tracker-halo" type="circle" paint={{ 'circle-color': SOS_RED, 'circle-opacity': 0.25, 'circle-radius': 22 }} />
      <Layer
        id="sos-tracker-point"
        type="circle"
        paint={{ 'circle-color': SOS_RED, 'circle-radius': 10, 'circle-stroke-width': 3, 'circle-stroke-color': '#FFFFFF' }}
      />
    </GeoJSONSource>
  );
}
