import { GeoJSONSource, Layer, ViewAnnotation } from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { StyleSheet, View } from 'react-native';

import { ACCENT_FILL, ON_ACCENT_FILL } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import { useBusPanelStore, type PanelBus, type PanelStop } from '../store/busPanelStore';

const STOP_COLOR = ACCENT_FILL;
const SELECTED_COLOR = '#E53935';
/** 一般車的 marker：白底深色圖示（與站牌 2a 列表軸上的灰色公車同義）。 */
const PLAIN_BUS_ICON = '#1F2937';

interface StopProps {
  id: string;
  /** 0 一般、1 選中、2 你的站 */
  kind: 0 | 1 | 2;
}

function buildCollection(stops: PanelStop[], selectedId: string | null, mineId: string | null): FeatureCollection<Point, StopProps> {
  const features: Feature<Point, StopProps>[] = stops.map((s) => ({
    type: 'Feature',
    id: s.id,
    geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    properties: { id: s.id, kind: s.id === mineId ? 2 : s.id === selectedId ? 1 : 0 },
  }));
  return { type: 'FeatureCollection', features };
}

function buildLine(stops: PanelStop[]): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: stops.map((s) => [s.lng, s.lat]) } }],
  };
}

/** 地圖上的公車：無障礙車主色底＋輪椅記號，一般車白底——與路線詳情列表同一套記號。 */
function BusMarker({ bus }: { bus: PanelBus }) {
  return (
    <ViewAnnotation id={`panel-bus-${bus.plateNumb}`} lngLat={[bus.lng, bus.lat]} anchor="bottom">
      <View
        importantForAccessibility="no-hide-descendants"
        style={[styles.bus, bus.accessible ? styles.busAccessible : styles.busPlain]}>
        <Icon name="bus" size={16} color={bus.accessible ? ON_ACCENT_FILL : PLAIN_BUS_ICON} />
        {bus.accessible ? <Icon name="accessibility" size={14} color={ON_ACCENT_FILL} /> : null}
      </View>
    </ViewAnnotation>
  );
}

/**
 * 公車面板正在顯示的站牌（路線站序／附近／搜尋結果）。
 *
 * 路線詳情（`routeLine`）時依設計把站序連成一條主色線：一般站白心藍框、你的站放大實心、
 * 選中的站實心；並把該方向的即時車輛畫成 marker。附近／搜尋清單只畫藍點，選中的站放大換紅。
 * 放在 `<Map>` 內；沒有站牌時不渲染。
 */
export default function BusStopLayer() {
  const stops = useBusPanelStore((s) => s.displayedStops);
  const selectedId = useBusPanelStore((s) => s.selectedStopId);
  const routeLine = useBusPanelStore((s) => s.routeLine);
  const mineId = useBusPanelStore((s) => s.mineStopId);
  const buses = useBusPanelStore((s) => s.buses);
  if (stops.length === 0) return null;

  const data = buildCollection(stops, selectedId, mineId);
  // 每個 source 都帶 key＝id：路線模式與清單模式切換時 React 會照位置重用元件，
  // 而 MapLibre 的 source `id` 一旦建立就不能改（會丟 "`id` cannot be changed"）。

  if (!routeLine) {
    return (
      <GeoJSONSource key="bus-stops" id="bus-stops" data={data}>
        <Layer
          id="bus-stops-circle"
          type="circle"
          paint={{
            'circle-color': ['case', ['==', ['get', 'kind'], 1], SELECTED_COLOR, STOP_COLOR],
            'circle-radius': ['case', ['==', ['get', 'kind'], 1], 10, 6],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF',
          }}
        />
      </GeoJSONSource>
    );
  }

  return (
    <>
      {stops.length > 1 ? (
        <GeoJSONSource key="bus-route-line" id="bus-route-line" data={buildLine(stops)}>
          <Layer
            id="bus-route-line-casing"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': '#FFFFFF', 'line-width': 9 }}
          />
          <Layer
            id="bus-route-line-stroke"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': STOP_COLOR, 'line-width': 6 }}
          />
        </GeoJSONSource>
      ) : null}
      <GeoJSONSource key="bus-stops" id="bus-stops" data={data}>
        <Layer
          id="bus-stops-circle"
          type="circle"
          paint={{
            'circle-color': ['case', ['==', ['get', 'kind'], 0], '#FFFFFF', STOP_COLOR],
            'circle-radius': ['match', ['get', 'kind'], 2, 12, 1, 8, 6],
            'circle-stroke-width': ['match', ['get', 'kind'], 2, 4, 1, 3, 3],
            'circle-stroke-color': ['case', ['==', ['get', 'kind'], 0], STOP_COLOR, '#FFFFFF'],
          }}
        />
      </GeoJSONSource>
      {buses.map((bus) => (
        <BusMarker key={bus.plateNumb} bus={bus} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  bus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 30,
    paddingHorizontal: 7,
    borderRadius: 9,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  busAccessible: { backgroundColor: ACCENT_FILL },
  busPlain: { backgroundColor: '#FFFFFF' },
});
