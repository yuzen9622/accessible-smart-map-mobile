import type { CircleLayerSpecification, LineLayerSpecification } from '@maplibre/maplibre-react-native';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { Feature, Point } from 'geojson';

import { ROUTE_DESTINATION_COLOR, buildRouteLayerData, type RoutePointProps } from '../domain/routeLayerData';
import { revealRouteLines } from '../domain/routeReveal';
import { useRouteReveal } from '../hooks/useRouteReveal';
import { useRouteSessionStore } from '../store/routeSessionStore';
import { WHITE } from '@/shared/theme';

/**
 * 路線圖層（SDD §4.4 RouteLayer）：選中路線的每段 leg 一條線，依 feature `kind` 分到不同 layer——
 * maplibre 的 `line-dasharray` 不支援 data-driven 表達式，所以步行虛線、實線、無障礙疊色各一層，
 * 顏色由 feature 的 `color` 屬性決定。點（起訖點、轉乘、中繼站、事故、點狀設施）共用一個 circle layer。
 *
 * 只有目的地、還沒算出路線時也畫目的地 pin（對齊 `hasRouteSession` 的定義：它也需要 pill 當出口）。
 */
/** 大眾運輸／開車線的外框：捷運線色表內的淺色線（環狀線黃…）是深框，其餘白框。 */
export const ROUTE_CASING_PAINT: LineLayerSpecification['paint'] = {
  'line-color': ['coalesce', ['get', 'casing'], WHITE],
  'line-width': 11,
  'line-opacity': 0.9,
};

/**
 * 點的填色與外框。轉乘點預設白心、線色外框；捷運線色表內的線（feature 帶 `casing`）改線色實心、`casing` 外框，
 * 黃線才不會變成白底上看不見的黃圈。起點維持白心、線色外框，其餘點線色實心、白框。
 */
export const ROUTE_POINT_COLOR_PAINT: Pick<NonNullable<CircleLayerSpecification['paint']>, 'circle-color' | 'circle-stroke-color'> = {
  'circle-color': [
    'match',
    ['get', 'kind'],
    'origin',
    WHITE,
    'transfer',
    ['case', ['has', 'casing'], ['get', 'color'], WHITE],
    ['get', 'color'],
  ],
  'circle-stroke-color': [
    'match',
    ['get', 'kind'],
    'origin',
    ['get', 'color'],
    'transfer',
    ['coalesce', ['get', 'casing'], ['get', 'color']],
    WHITE,
  ],
};

export default function RouteLayer() {
  const selected = useRouteSessionStore((s) => s.selectRoute?.route ?? null);
  const preview = useRouteSessionStore((s) => s.legGeometryPreview);
  // 查看別班公車時，那段 leg 改畫那班的線形（只在這張圖層上替換，不寫回路線）
  const previewLeg = preview && selected?.routeId === preview.routeId ? selected.legs[preview.legIndex] : undefined;
  const route =
    selected && preview && previewLeg?.type === 'BUS'
      ? { ...selected, legs: selected.legs.map((leg, index) => (index === preview.legIndex ? { ...previewLeg, polyline: preview.polyline } : leg)) }
      : selected;
  const waypoints = useRouteSessionStore((s) => s.routeWaypoints);
  const destination = useRouteSessionStore((s) => s.destination);

  const reveal = useRouteReveal(route?.routeId ?? null);
  const data = buildRouteLayerData(route, waypoints);
  // 繪出動畫期間只畫到進度位置；起點之外的點（轉乘、中繼、事故）等畫完再出現
  const lines = revealRouteLines(data.lines, reveal);
  const points = reveal >= 1 ? data.points : { ...data.points, features: data.points.features.filter((f) => f.properties.kind === 'origin') };
  if (!route && destination) {
    const pin: Feature<Point, RoutePointProps> = {
      type: 'Feature',
      id: 'destination',
      geometry: { type: 'Point', coordinates: [destination.lng, destination.lat] },
      properties: { id: 'destination', kind: 'destination', color: ROUTE_DESTINATION_COLOR },
    };
    data.points.features.push(pin);
  }
  if (data.lines.features.length === 0 && data.points.features.length === 0) return null;

  return (
    <>
      <GeoJSONSource id="route-lines" data={lines}>
        <Layer
          id="route-line-casing"
          type="line"
          filter={['match', ['get', 'kind'], ['transit', 'drive'], true, false]}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={ROUTE_CASING_PAINT}
        />
        <Layer
          id="route-line-walk"
          type="line"
          filter={['==', ['get', 'kind'], 'walk']}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': 0.8, 'line-dasharray': [0.5, 1.5] }}
        />
        <Layer
          id="route-line-solid"
          type="line"
          filter={['match', ['get', 'kind'], ['transit', 'drive', 'traffic'], true, false]}
          layout={{ 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['get', 'order'] }}
          paint={{ 'line-color': ['get', 'color'], 'line-width': 8 }}
        />
        <Layer
          id="route-line-a11y"
          type="line"
          filter={['==', ['get', 'kind'], 'a11y']}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': 0.95 }}
        />
        <Layer
          id="route-line-incident"
          type="line"
          filter={['==', ['get', 'kind'], 'incident']}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': ['get', 'color'], 'line-width': 5, 'line-opacity': 0.9, 'line-dasharray': [1, 1.5] }}
        />
        <Layer
          id="route-line-a11y-indoor"
          type="line"
          filter={['==', ['get', 'kind'], 'a11yIndoor']}
          paint={{ 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': 0.95, 'line-dasharray': [1, 2] }}
        />
      </GeoJSONSource>
      <GeoJSONSource id="route-points" data={points}>
        <Layer
          id="route-point-circles"
          type="circle"
          paint={{
            ...ROUTE_POINT_COLOR_PAINT,
            'circle-radius': [
              'match',
              ['get', 'kind'],
              'destination',
              10,
              'origin',
              8,
              'transfer',
              7,
              'a11yDot',
              6,
              8,
            ],
            'circle-stroke-width': ['match', ['get', 'kind'], ['origin', 'transfer'], 3.5, 2],
          }}
        />
      </GeoJSONSource>
    </>
  );
}
