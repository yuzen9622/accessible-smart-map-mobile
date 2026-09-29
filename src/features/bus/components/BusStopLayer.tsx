import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection, Point } from 'geojson';

import { useBusPanelStore, type PanelStop } from '../store/busPanelStore';

const STOP_COLOR = '#0065C8';
const SELECTED_COLOR = '#E53935';

interface StopProps {
  id: string;
  selected: 0 | 1;
}

function buildCollection(stops: PanelStop[], selectedId: string | null): FeatureCollection<Point, StopProps> {
  const features: Feature<Point, StopProps>[] = stops.map((s) => ({
    type: 'Feature',
    id: s.id,
    geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    properties: { id: s.id, selected: s.id === selectedId ? 1 : 0 },
  }));
  return { type: 'FeatureCollection', features };
}

/**
 * 公車面板正在顯示的站牌（路線站序／附近／搜尋結果），選中的站放大並換色。
 * 放在 `<Map>` 內；沒有站牌時不渲染。
 */
export default function BusStopLayer() {
  const stops = useBusPanelStore((s) => s.displayedStops);
  const selectedId = useBusPanelStore((s) => s.selectedStopId);
  if (stops.length === 0) return null;

  return (
    <GeoJSONSource id="bus-stops" data={buildCollection(stops, selectedId)}>
      <Layer
        id="bus-stops-circle"
        type="circle"
        paint={{
          'circle-color': ['case', ['==', ['get', 'selected'], 1], SELECTED_COLOR, STOP_COLOR],
          'circle-radius': ['case', ['==', ['get', 'selected'], 1], 10, 6],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        }}
      />
    </GeoJSONSource>
  );
}
