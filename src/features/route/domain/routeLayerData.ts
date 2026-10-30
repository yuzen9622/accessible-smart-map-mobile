// RouteLayer 的幾何組裝（SDD §4.4、§6.3）。移植自 Web `src/components/Wrapper/RouteWrapper.tsx`、
// `src/components/Polyline.tsx`（commit 5eadc71）的「畫什麼」：Web 每段 leg 一個 React Polyline／Marker，
// 原生改成兩個 GeoJSON collection（線、點）交給 maplibre 的 line／circle layer，由 feature 屬性決定樣式。
//
// 規則逐條對齊 Web：
// - 所有運具採實色內線與同色系外框；步行依已確認的人行道區間分成藍／綠實線。
// - 步行 `a11ySegments` 保留點狀設施；線段資訊在詳情呈現，不蓋掉步行線的分類色。
// - 開車 `trafficSegments` 經 `visibleTrafficSegments` 過濾後疊在底線上（unknown／越界不畫）。
// - 起點＝第一段 leg 的第一點；終點＝最後一段 leg 的最後一點；運具改變處畫轉乘點；中繼站；
//   沿線 150 m 內的開車事故（`filterIncidentsAlongRoute`）。

import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

import type { LatLng } from '@/shared/geo';

import { filterIncidentsAlongRoute, isIncidentClosed } from './geo';
import { A11Y_FEATURE_COLOR, TRAFFIC_LEVEL_COLORS, getLegColor, legEdgeColor, visibleTrafficSegments } from './routeDisplay';
import type { AccessibleRoute, LngLatTuple, WalkLeg } from '../types/route';
import { ROUTE_MARKER, WALK_ROUTE, routeCasingColor } from '@/shared/theme/palettes';

export type RouteLineKind = 'walk' | 'sidewalk' | 'transit' | 'drive' | 'traffic' | 'incident';

export interface RouteLineProps {
  id: string;
  kind: RouteLineKind;
  color: string;
  /** 地圖線條的同色系外框；與標記／徽章的對比字色分開。 */
  casing?: string;
  /** 疊放順序：底線 0、疊色 1（line-sort-key）。 */
  order: number;
}

export type RoutePointKind = 'origin' | 'destination' | 'transfer' | 'waypoint' | 'incidentClosure' | 'incidentAdvisory' | 'a11yDot';

export interface RoutePointProps {
  id: string;
  kind: RoutePointKind;
  color: string;
  /** 轉乘點：捷運線色表內的線改成線色實心、`casing` 外框；沒有就維持白心、線色外框。 */
  casing?: string;
  /** 事故標題等可讀文字；地圖點擊時使用。 */
  label?: string;
}

export interface RouteLayerData {
  lines: FeatureCollection<LineString, RouteLineProps>;
  points: FeatureCollection<Point, RoutePointProps>;
}

export const ROUTE_ORIGIN_COLOR = ROUTE_MARKER.origin;
export const ROUTE_DESTINATION_COLOR = ROUTE_MARKER.destination;
export const ROUTE_WAYPOINT_COLOR = ROUTE_MARKER.waypoint;
export const INCIDENT_CLOSURE_COLOR = ROUTE_MARKER.closure;
export const INCIDENT_ADVISORY_COLOR = ROUTE_MARKER.advisory;

function line(id: string, coords: LngLatTuple[], props: Omit<RouteLineProps, 'id'>): Feature<LineString, RouteLineProps> {
  return { type: 'Feature', id, geometry: { type: 'LineString', coordinates: coords }, properties: { id, ...props } };
}

function point(id: string, coord: LngLatTuple, props: Omit<RoutePointProps, 'id'>): Feature<Point, RoutePointProps> {
  return { type: 'Feature', id, geometry: { type: 'Point', coordinates: coord }, properties: { id, ...props } };
}

function isFiniteTuple(p: LngLatTuple | undefined): p is LngLatTuple {
  return !!p && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

/** 分割底線而非另加疊線，讓藍／綠區間跟著同一個繪出進度出現，也不重複計算路線長度。 */
function walkingLines(leg: WalkLeg, base: string): Feature<LineString, RouteLineProps>[] {
  const coords = leg.polyline ?? [];
  if (coords.length < 2) return [];
  const sidewalkEdges = new Array<boolean>(coords.length - 1).fill(false);
  if (Array.isArray(leg.sidewalkSegments)) {
    for (const segment of leg.sidewalkSegments) {
      if (!segment || !Number.isInteger(segment.startIndex) || !Number.isInteger(segment.endIndex) ||
          segment.startIndex < 0 || segment.startIndex >= segment.endIndex || segment.endIndex >= coords.length ||
          !coords.slice(segment.startIndex, segment.endIndex + 1).every(isFiniteTuple)) continue;
      sidewalkEdges.fill(true, segment.startIndex, segment.endIndex);
    }
  }
  const result: Feature<LineString, RouteLineProps>[] = [];
  let start = 0;
  for (let edge = 1; edge <= sidewalkEdges.length; edge++) {
    if (edge < sidewalkEdges.length && sidewalkEdges[edge] === sidewalkEdges[start]) continue;
    const sidewalk = sidewalkEdges[start];
    // 先以原索引切片，再處理無效座標，避免人行道區間因座標過濾而移位。
    const slice = coords.slice(start, edge + 1).filter(isFiniteTuple);
    if (slice.length >= 2) result.push(line(result.length === 0 ? base : `${base}-walk-${start}`, slice, {
      kind: sidewalk ? 'sidewalk' : 'walk',
      color: sidewalk ? WALK_ROUTE.sidewalk : WALK_ROUTE.line,
      casing: sidewalk ? WALK_ROUTE.sidewalkCasing : WALK_ROUTE.casing,
      order: 0,
    }));
    start = edge;
  }
  return result;
}

export function buildRouteLayerData(route: AccessibleRoute | null, waypoints: readonly LatLng[] = []): RouteLayerData {
  const lines: Feature<LineString, RouteLineProps>[] = [];
  const points: Feature<Point, RoutePointProps>[] = [];
  if (!route) return { lines: { type: 'FeatureCollection', features: lines }, points: { type: 'FeatureCollection', features: points } };

  route.legs.forEach((leg, legIndex) => {
    const coords = (leg.polyline ?? []).filter(isFiniteTuple);
    const base = `leg-${legIndex}`;
    const casing = legEdgeColor(leg);
    if (leg.type === 'WALK') {
      lines.push(...walkingLines(leg, base));
    } else if (coords.length >= 2) {
      const kind: RouteLineKind = leg.type === 'DRIVE' || leg.type === 'MOTORCYCLE' ? 'drive' : 'transit';
      const color = getLegColor(leg);
      lines.push(line(base, coords, { kind, color, casing: routeCasingColor(color), order: 0 }));
    }

    if (leg.type === 'WALK' && leg.a11ySegments) {
      leg.a11ySegments.forEach((segment, i) => {
        const color = A11Y_FEATURE_COLOR[segment.feature];
        if (segment.startIndex === segment.endIndex) {
          const at = leg.polyline?.[segment.startIndex];
          if (isFiniteTuple(at)) points.push(point(`${base}-a11y-${i}`, at, { kind: 'a11yDot', color }));
          return;
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
              casing: routeCasingColor(TRAFFIC_LEVEL_COLORS[segment.trafficLevel]),
              order: 1,
            }),
          );
        }
      });
      filterIncidentsAlongRoute(leg.incidents, coords).forEach((incident) => {
        const closure = isIncidentClosed(incident);
        const extent = (incident.points ?? []).filter(isFiniteTuple);
        if (extent.length >= 2) {
          lines.push(
            line(`${base}-incident-extent-${incident.incidentId}`, extent, {
              kind: 'incident',
              color: closure ? INCIDENT_CLOSURE_COLOR : INCIDENT_ADVISORY_COLOR,
              order: 2,
            }),
          );
        }
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
      points.push(point(`${base}-transfer`, coords[0], { kind: 'transfer', color: getLegColor(leg), ...(casing ? { casing } : {}) }));
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
