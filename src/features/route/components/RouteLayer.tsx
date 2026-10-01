import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { Feature, Point } from 'geojson';

import { ROUTE_DESTINATION_COLOR, buildRouteLayerData, type RoutePointProps } from '../domain/routeLayerData';
import { useRouteSessionStore } from '../store/routeSessionStore';

/**
 * 路線圖層（SDD §4.4 RouteLayer）：選中路線的每段 leg 一條線，依 feature `kind` 分到不同 layer——
 * maplibre 的 `line-dasharray` 不支援 data-driven 表達式，所以步行虛線、實線、無障礙疊色各一層，
 * 顏色由 feature 的 `color` 屬性決定。點（起訖點、轉乘、中繼站、事故、點狀設施）共用一個 circle layer。
 *
 * 只有目的地、還沒算出路線時也畫目的地 pin（對齊 `hasRouteSession` 的定義：它也需要 pill 當出口）。
 */
export default function RouteLayer() {
  const route = useRouteSessionStore((s) => s.selectRoute?.route ?? null);
  const waypoints = useRouteSessionStore((s) => s.routeWaypoints);
  const destination = useRouteSessionStore((s) => s.destination);

  const data = buildRouteLayerData(route, waypoints);
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
      <GeoJSONSource id="route-lines" data={data.lines}>
        <Layer
          id="route-line-casing"
          type="line"
          filter={['match', ['get', 'kind'], ['transit', 'drive'], true, false]}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': '#FFFFFF', 'line-width': 11, 'line-opacity': 0.9 }}
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
      <GeoJSONSource id="route-points" data={data.points}>
        <Layer
          id="route-point-circles"
          type="circle"
          paint={{
            'circle-color': [
              'match',
              ['get', 'kind'],
              ['origin', 'transfer'],
              '#FFFFFF',
              ['get', 'color'],
            ],
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
            'circle-stroke-color': ['match', ['get', 'kind'], ['origin', 'transfer'], ['get', 'color'], '#FFFFFF'],
            'circle-stroke-width': ['match', ['get', 'kind'], ['origin', 'transfer'], 3.5, 2],
          }}
        />
      </GeoJSONSource>
    </>
  );
}
