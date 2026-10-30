import type { Feature, FeatureCollection, LineString } from 'geojson';

import type { LngLat, LngLatZ, VenueDetail } from '../types/venue';

type XY = [number, number];
type XYZ = [number, number, number];
const EPS = 1e-8;
const METERS_PER_DEGREE = 6_371_000 * Math.PI / 180;
const cross = (a: XY, b: XY) => a[0] * b[1] - a[1] * b[0];

function inRing(point: XY, ring: XY[], includeBoundary = false): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (Math.abs(cross([dx, dy], [point[0] - a[0], point[1] - a[1]])) < EPS
      && point[0] >= Math.min(a[0], b[0]) - EPS && point[0] <= Math.max(a[0], b[0]) + EPS
      && point[1] >= Math.min(a[1], b[1]) - EPS && point[1] <= Math.max(a[1], b[1]) + EPS) return includeBoundary;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < a[0] + dx * (point[1] - a[1]) / dy) inside = !inside;
  }
  return inside;
}

/** Web campusRoads uses this clipping only for display; it never changes topology. */
function outsideBuildingSegments(a: XYZ, b: XYZ, polygons: XY[][][]): [XYZ, XYZ][] {
  const delta: XY = [b[0] - a[0], b[1] - a[1]];
  if (Math.hypot(...delta) < EPS) return [];
  const cuts = [0, 1];
  for (const polygon of polygons) for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
    const c = ring[i - 1], d = ring[i];
    const edge: XY = [d[0] - c[0], d[1] - c[1]], relative: XY = [c[0] - a[0], c[1] - a[1]];
    const determinant = cross(delta, edge);
    if (Math.abs(determinant) < EPS) continue;
    const t = cross(relative, edge) / determinant, u = cross(relative, delta) / determinant;
    if (t > EPS && t < 1 - EPS && u >= -EPS && u <= 1 + EPS) cuts.push(t);
  }
  cuts.sort((x, y) => x - y);
  const at = (t: number): XYZ => t === 0 ? [...a] : t === 1 ? [...b]
    : [a[0] + delta[0] * t, a[1] + delta[1] * t, a[2] + (b[2] - a[2]) * t];
  return cuts.slice(1).flatMap((end, index): [XYZ, XYZ][] => {
    const start = cuts[index];
    if (end - start < EPS) return [];
    const middle = at((start + end) / 2), point: XY = [middle[0], middle[1]];
    const inside = polygons.some((polygon) => inRing(point, polygon[0]) && !polygon.slice(1).some((hole) => inRing(point, hole, true)));
    return inside ? [] : [[at(start), at(end)]];
  });
}

export interface CampusRoadProperties {
  id: string;
  roadClass: 'path' | 'service';
  class: string;
  subclass: string;
  layer: number;
}

/** The same published outdoor network as web, independent of selected floor or route. */
export function campusRoadGeoJSON(detail: VenueDetail): FeatureCollection<LineString, CampusRoadProperties> {
  const features: Feature<LineString, CampusRoadProperties>[] = [];
  const lngScale = METERS_PER_DEGREE * Math.cos(detail.center[1] * Math.PI / 180);
  if (Math.abs(lngScale) < 1) return { type: 'FeatureCollection', features };
  const local = ([lng, lat]: LngLat): XY => [(lng - detail.center[0]) * lngScale, (lat - detail.center[1]) * METERS_PER_DEGREE];
  const local3 = ([lng, lat, z]: LngLatZ): XYZ => [...local([lng, lat]), z];
  const geographic = ([x, y]: XYZ): LngLat => [detail.center[0] + x / lngScale, detail.center[1] + y / METERS_PER_DEGREE];
  const buildings = new Map(detail.buildings.map((building) => [building.id, building]));
  const footprints = detail.buildings.map((building) => building.footprint.map((ring) => ring.map(local)));
  const groundHeights = [0, ...detail.buildings.flatMap((building) => building.levels.filter((level) => level.ordinal === 0).map((level) => level.elevationM))];
  const ground = (point: LngLatZ, buildingId: string | null, ref: string | null): boolean => {
    if (ref !== null) return Boolean(buildingId && buildings.get(buildingId)?.levels.some((level) => level.ref === ref && level.ordinal === 0));
    return groundHeights.some((height) => Math.abs(point[2] - height) <= 0.02);
  };
  const contexts = new Map<string, { buildingId: string | null; ref: string | null; outdoor: boolean }>();
  for (const walkway of detail.walkways) for (const [i, id] of (walkway.nodeIds ?? []).entries()) {
    const previous = contexts.get(id);
    contexts.set(id, {
      buildingId: walkway.buildingIds[i], ref: walkway.levelRefs[i],
      outdoor: previous?.outdoor === true || !walkway.indoor,
    });
  }
  const seen = new Set<string>();
  const revision = `${detail.venueId}:${detail.version}`;
  const append = (id: string, kind: string, coordinates: LngLatZ[]) => {
    if (seen.has(id)) return;
    seen.add(id);
    const points = coordinates.map(local3);
    for (let index = 1; index < points.length; index++) {
      for (const [part, segment] of outsideBuildingSegments(points[index - 1], points[index], footprints).entries()) {
        const roadClass = kind === 'service' ? 'service' : 'path';
        features.push({
          type: 'Feature',
          properties: {
            id: `${revision}:${id}:${index}:${part}`, roadClass, class: roadClass,
            subclass: kind === 'steps' || kind === 'stairs' ? 'steps' : 'pedestrian', layer: 0,
          },
          geometry: { type: 'LineString', coordinates: segment.map(geographic) },
        });
      }
    }
  };
  for (const walkway of detail.walkways) {
    if (walkway.indoor || !walkway.coordinates.every((point, index) => ground(point, walkway.buildingIds[index], walkway.levelRefs[index]))) continue;
    append(walkway.id, walkway.kind, walkway.coordinates);
  }
  for (const connection of detail.connections) {
    if (!['ramp', 'steps', 'stairs'].includes(connection.kind) || connection.coordinates.length < 2) continue;
    const endpoints = [0, connection.coordinates.length - 1];
    const evidence = endpoints.map((index) => connection.nodeIds?.[index] ? contexts.get(connection.nodeIds[index]) : undefined);
    // Height alone cannot turn an indoor or unowned connection into an outdoor road.
    if (!evidence.some((endpoint) => endpoint?.outdoor)) continue;
    if (!endpoints.every((index, end) => ground(connection.coordinates[index], evidence[end]?.buildingId ?? connection.buildingId ?? null, evidence[end]?.ref ?? connection.levelRefs[index] ?? null))) continue;
    append(connection.id, connection.kind, connection.coordinates);
  }
  return { type: 'FeatureCollection', features };
}
