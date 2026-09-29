// RouteLayer 的幾何組裝（SDD §4.4、§6.3）。移植自 Web `src/components/Wrapper/RouteWrapper.tsx`、
// `src/components/Polyline.tsx`（commit 5eadc71）的「畫什麼」：Web 每段 leg 一個 React Polyline／Marker，
// 原生改成兩個 GeoJSON collection（線、點）交給 maplibre 的 line／circle layer，由 feature 屬性決定樣式。
//
// 規則逐條對齊 Web：
// - 每段 leg 一條底線；步行虛線、大眾運輸與開車實線。
// - 步行 `a11ySegments` 在底線上疊色；`startIndex === endIndex` 是點狀設施（畫圓點，不是零長度線）。
// - 開車 `trafficSegments` 經 `visibleTrafficSegments` 過濾後疊在底線上（unknown／越界不畫）。
// - 起點＝第一段 leg 的第一點；終點＝最後一段 leg 的最後一點；運具改變處畫轉乘點；中繼站；
//   沿線 150 m 內的開車事故（`filterIncidentsAlongRoute`）。

import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

import type { LatLng } from '@/shared/geo';

import { filterIncidentsAlongRoute } from './geo';
import { A11Y_FEATURE_COLOR, TRAFFIC_LEVEL_COLORS, getLegColor, visibleTrafficSegments } from './routeDisplay';
import type { AccessibleRoute, LngLatTuple } from '../types/route';

export type RouteLineKind = 'walk' | 'transit' | 'drive' | 'traffic' | 'a11y' | 'a11yIndoor';

export interface RouteLineProps {
  id: string;
  kind: RouteLineKind;
  color: string;
  /** 疊放順序：底線 0、疊色 1（line-sort-key）。 */
  order: number;
}

export type RoutePointKind = 'origin' | 'destination' | 'transfer' | 'waypoint' | 'incidentClosure' | 'incidentAdvisory' | 'a11yDot';

export interface RoutePointProps {
  id: string;
  kind: RoutePointKind;
  color: string;
  /** 事故標題等可讀文字；地圖點擊時使用。 */
  label?: string;
}

export interface RouteLayerData {
  lines: FeatureCollection<LineString, RouteLineProps>;
  points: FeatureCollection<Point, RoutePointProps>;
}

export const ROUTE_ORIGIN_COLOR = '#10B981';
export const ROUTE_DESTINATION_COLOR = '#EF4444';
export const ROUTE_WAYPOINT_COLOR = '#3B82F6';
export const INCIDENT_CLOSURE_COLOR = '#DC2626';
export const INCIDENT_ADVISORY_COLOR = '#F59E0B';

function line(id: string, coords: LngLatTuple[], props: Omit<RouteLineProps, 'id'>): Feature<LineString, RouteLineProps> {
  return { type: 'Feature', id, geometry: { type: 'LineString', coordinates: coords }, properties: { id, ...props } };
}

function point(id: string, coord: LngLatTuple, props: Omit<RoutePointProps, 'id'>): Feature<Point, RoutePointProps> {
  return { type: 'Feature', id, geometry: { type: 'Point', coordinates: coord }, properties: { id, ...props } };
}

function isFiniteTuple(p: LngLatTuple | undefined): p is LngLatTuple {
  return !!p && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

export function buildRouteLayerData(route: AccessibleRoute | null, waypoints: readonly LatLng[] = []): RouteLayerData {
  const lines: Feature<LineString, RouteLineProps>[] = [];
  const points: Feature<Point, RoutePointProps>[] = [];
  if (!route) return { lines: { type: 'FeatureCollection', features: lines }, points: { type: 'FeatureCollection', features: points } };

  route.legs.forEach((leg, legIndex) => {
    const coords = (leg.polyline ?? []).filter(isFiniteTuple);
    const base = `leg-${legIndex}`;
    if (coords.length >= 2) {
      const kind: RouteLineKind = leg.type === 'WALK' ? 'walk' : leg.type === 'DRIVE' || leg.type === 'MOTORCYCLE' ? 'drive' : 'transit';
      lines.push(line(base, coords, { kind, color: getLegColor(leg), order: 0 }));
    }

    if (leg.type === 'WALK' && leg.a11ySegments) {
      leg.a11ySegments.forEach((segment, i) => {
        const color = A11Y_FEATURE_COLOR[segment.feature];
        if (segment.startIndex === segment.endIndex) {
          const at = coords[segment.startIndex];
          if (at) points.push(point(`${base}-a11y-${i}`, at, { kind: 'a11yDot', color }));
          return;
        }
        const slice = coords.slice(segment.startIndex, segment.endIndex + 1);
        if (slice.length >= 2) {
          lines.push(line(`${base}-a11y-${i}`, slice, { kind: segment.indoor ? 'a11yIndoor' : 'a11y', color, order: 1 }));
        }
      });
    }

    if (leg.type === 'DRIVE' || leg.type === 'MOTORCYCLE') {
      visibleTrafficSegments(leg.trafficSegments, coords.length).forEach((segment, i) => {
        const slice = coords.slice(segment.fromIndex, segment.toIndex + 1);
        if (slice.length >= 2) {
          lines.push(
            line(`${base}-traffic-${segment.trafficLevel}-${segment.fromIndex}-${segment.toIndex}-${i}`, slice, {
              kind: 'traffic',
              color: TRAFFIC_LEVEL_COLORS[segment.trafficLevel],
              order: 1,
            }),
          );
        }
      });
      filterIncidentsAlongRoute(leg.incidents, coords).forEach((incident) => {
        const closure = incident.severity === 'closure';
        points.push(
          point(`${base}-incident-${incident.incidentId}`, [incident.location.lng, incident.location.lat], {
            kind: closure ? 'incidentClosure' : 'incidentAdvisory',
            color: closure ? INCIDENT_CLOSURE_COLOR : INCIDENT_ADVISORY_COLOR,
            label: incident.title,
          }),
        );
      });
    }

    const previous = route.legs[legIndex - 1];
    if (legIndex > 0 && previous && previous.type !== leg.type && coords[0]) {
      points.push(point(`${base}-transfer`, coords[0], { kind: 'transfer', color: getLegColor(leg) }));
    }
  });

  waypoints.forEach((wp, i) => {
    if (Number.isFinite(wp.lat) && Number.isFinite(wp.lng)) {
      points.push(point(`waypoint-${i}`, [wp.lng, wp.lat], { kind: 'waypoint', color: ROUTE_WAYPOINT_COLOR, label: String(i + 1) }));
    }
  });

  const first = route.legs[0]?.polyline?.find(isFiniteTuple);
  const lastLeg = route.legs[route.legs.length - 1];
  const last = lastLeg?.polyline ? [...lastLeg.polyline].reverse().find(isFiniteTuple) : undefined;
  if (first) points.push(point('origin', first, { kind: 'origin', color: ROUTE_ORIGIN_COLOR }));
  if (last) points.push(point('destination', last, { kind: 'destination', color: ROUTE_DESTINATION_COLOR }));

  return { lines: { type: 'FeatureCollection', features: lines }, points: { type: 'FeatureCollection', features: points } };
}
