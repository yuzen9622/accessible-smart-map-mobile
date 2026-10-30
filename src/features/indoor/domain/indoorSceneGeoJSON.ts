import type { Feature, FeatureCollection, Polygon } from 'geojson';
import polygonClipping from 'polygon-clipping';
import type { IndoorMaterialRole } from '@/shared/theme/indoorPalette';
import type { LngLat, VenueDetail, VenueFeature, VenuePlace } from '../types/venue';

type XY = [number, number];
type Rings = XY[][];
type Edge = { a: XY; b: XY };
type SourcePolygon = { source: VenueFeature; rings: Rings };

/** 與 web cutaway 共用的展示尺寸，不能解讀為實測牆高／厚度。 */
export const INDOOR_DISPLAY = {
  slabThickness: 0.16,
  wallHeight: 0.85,
  wallThickness: 0.12,
  sourceWallThickness: 0.09,
  boundaryWallThickness: 0.01,
  entranceWidth: 1.6,
} as const;

export interface IndoorSceneProperties {
  role: IndoorMaterialRole;
  /** MapLibre 絕對底高／頂高；選中樓層整體平移到地面，不是來源海拔。 */
  base: number;
  height: number;
  active: boolean;
  buildingId: string;
  levelRef: string | null;
  sourceId: string;
  placeId: string | null;
  kind: 'slab' | 'surface' | 'outline' | 'wall' | 'context';
  servesLevel: boolean | null;
  displayOnly: true;
  sourceElevationM: number | null;
  thicknessM: number | null;
  thicknessKind: 'display' | 'source' | null;
}

const EPS = 0.001;
const OVERLAY_EPS = 0.000001;
const METERS_PER_DEGREE = 6_371_000 * Math.PI / 180;
const cross = (a: XY, b: XY) => a[0] * b[1] - a[1] * b[0];
const minus = (a: XY, b: XY): XY => [a[0] - b[0], a[1] - b[1]];
const length = (a: XY, b: XY) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const midpoint = (a: XY, b: XY): XY => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const interpolate = (a: XY, b: XY, t: number): XY => t === 0 ? a : t === 1 ? b : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function area(ring: XY[]): number {
  return ring.reduce((sum, point, index) => sum + cross(point, ring[(index + 1) % ring.length]), 0) / 2;
}
function insideRing(point: XY, ring: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function inside(point: XY, rings: Rings): boolean {
  return rings.length > 0 && insideRing(point, rings[0]) && !rings.slice(1).some((ring) => insideRing(point, ring));
}
function edges(rings: Rings): Edge[] {
  return rings.flatMap((ring) => ring.slice(1).map((b, index) => ({ a: ring[index], b })).filter(({ a, b }) => length(a, b) > OVERLAY_EPS));
}
function distanceToEdge(point: XY, edge: Edge): number {
  const delta = minus(edge.b, edge.a);
  const squared = cross(delta, [-delta[1], delta[0]]);
  const t = squared ? Math.max(0, Math.min(1, ((point[0] - edge.a[0]) * delta[0] + (point[1] - edge.a[1]) * delta[1]) / squared)) : 0;
  return length(point, interpolate(edge.a, edge.b, t));
}

/** Split source edges at real intersections, including partially shared boundaries. */
function splitEdges(source: Edge[], boundaries: Edge[]): Edge[] {
  return source.flatMap((edge) => {
    const delta = minus(edge.b, edge.a);
    const size = length(edge.a, edge.b);
    const cuts = [0, 1];
    for (const other of boundaries) {
      if (Math.max(edge.a[0], edge.b[0]) + OVERLAY_EPS < Math.min(other.a[0], other.b[0]) || Math.min(edge.a[0], edge.b[0]) - OVERLAY_EPS > Math.max(other.a[0], other.b[0]) || Math.max(edge.a[1], edge.b[1]) + OVERLAY_EPS < Math.min(other.a[1], other.b[1]) || Math.min(edge.a[1], edge.b[1]) - OVERLAY_EPS > Math.max(other.a[1], other.b[1])) continue;
      const direction = minus(other.b, other.a);
      const offset = minus(other.a, edge.a);
      const denominator = cross(delta, direction);
      if (Math.abs(denominator) > 1e-10) {
        const t = cross(offset, direction) / denominator;
        const u = cross(offset, delta) / denominator;
        if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
      } else if (Math.abs(cross(delta, offset)) / size < OVERLAY_EPS) {
        for (const point of [other.a, other.b]) {
          const t = ((point[0] - edge.a[0]) * delta[0] + (point[1] - edge.a[1]) * delta[1]) / (size * size);
          if (t > 0 && t < 1) cuts.push(t);
        }
      }
    }
    cuts.sort((a, b) => a - b);
    return cuts.slice(1).flatMap((end, index) => (end - cuts[index]) * size > OVERLAY_EPS ? [{ a: interpolate(edge.a, edge.b, cuts[index]), b: interpolate(edge.a, edge.b, end) }] : []);
  });
}

/** Use the same Boolean geometry implementation as web; source holes and
 * authored voids must survive intersections and overlapping floor patches. */
function union(polygons: Rings[]): Rings[] {
  return polygons.length ? polygonClipping.union(polygons[0], ...polygons.slice(1)) : [];
}
function clip(polygons: Rings[], keep: Rings[], exclude: Rings[] = []): Rings[] {
  if (!polygons.length || !keep.length) return [];
  const clipped = polygonClipping.intersection(union(polygons), union(keep));
  return exclude.length ? polygonClipping.difference(clipped, ...exclude) : clipped;
}
/** Web uses the same nanometre grid for generated wall Boolean operands to
 * remove floating-point slivers; authored floor/surface coordinates stay intact. */
function wallOverlay(polygon: Rings): Rings {
  return polygon.map((ring) => ring.map(([x, y]): XY => [Math.round(x * 1e9) / 1e9, Math.round(y * 1e9) / 1e9]));
}
function cleanWalls(polygons: Rings[]): Rings[] {
  return polygons.flatMap((polygon) => {
    const rings = wallOverlay(polygon).map((ring) => {
      const points = ring.filter((point, index) => index === 0 || point[0] !== ring[index - 1][0] || point[1] !== ring[index - 1][1]);
      if (points.length < 3) return [];
      const origin = points[0];
      if (area(points.map((point) => minus(point, origin))) === 0) return [];
      if (length(points[0], points[points.length - 1]) > 0) points.push(points[0]);
      return points;
    });
    return rings[0]?.length ? [[rings[0], ...rings.slice(1).filter((ring) => ring.length)]] : [];
  });
}
function clipWalls(polygons: Rings[], keep: Rings[], exclude: Rings[] = []): Rings[] {
  if (!polygons.length || !keep.length) return [];
  const merged = cleanWalls(union(polygons.map(wallOverlay)));
  const surface = cleanWalls(union(keep.map(wallOverlay)));
  const clipped = cleanWalls(polygonClipping.intersection(merged, surface));
  return exclude.length ? cleanWalls(polygonClipping.difference(clipped, ...exclude.map(wallOverlay))) : clipped;
}
function strip({ a, b }: Edge, low: number, high: number): Rings {
  const size = length(a, b);
  const nx = -(b[1] - a[1]) / size, ny = (b[0] - a[0]) / size;
  const at = (point: XY, offset: number): XY => [point[0] + nx * offset, point[1] + ny * offset];
  return [[at(a, low), at(b, low), at(b, high), at(a, high), at(a, low)]];
}
function outlines(rings: Rings, width: number): Rings[] {
  return edges(rings).map((edge) => strip(edge, -width / 2, width / 2));
}
function segmentsCross(a: Edge, b: Edge): boolean {
  const directionA = minus(a.b, a.a), directionB = minus(b.b, b.a), offset = minus(b.a, a.a);
  const denominator = cross(directionA, directionB);
  if (Math.abs(denominator) < 1e-9) return false;
  const t = cross(offset, directionB) / denominator, u = cross(offset, directionA) / denominator;
  return t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS;
}
function isVoid(feature: VenueFeature) { return /void/.test(feature.tags?.['a11ymap:area_type'] ?? ''); }
function isOpening(feature: VenueFeature) { return /stair|elevator|lift|void|vertical-core/.test(feature.tags?.['a11ymap:area_type'] ?? '') || feature.kind === 'stairs'; }
function isFloorBase(feature: VenueFeature) { return feature.kind === 'area' && feature.tags?.['a11ymap:area_type'] === 'indoor-floor-base'; }
function isEnclosed(feature: VenueFeature) { return feature.kind === 'room' || feature.tags?.amenity === 'toilets'; }
function isFloorPatch(feature: VenueFeature) { return (isOpening(feature) && !isVoid(feature)) || isFloorBase(feature) || isEnclosed(feature) || feature.kind === 'corridor'; }

interface WallSegment { a: XY; b: XY; owners: string[]; polygon: Rings }

function roomWalls(
  features: VenueFeature[],
  thickness = INDOOR_DISPLAY.wallThickness,
  includeEdge: (feature: VenueFeature, a: XY, b: XY) => boolean = () => true,
): WallSegment[] {
  const edges: { a: XY; b: XY; owner: string; inward: XY }[] = [];
  for (const f of features) {
    if (!isEnclosed(f) || f.geometry.type !== "Polygon") continue;
    f.geometry.coordinates.forEach((ring, ringIndex) => {
      const sign = Math.sign(area(ring)) * (ringIndex ? -1 : 1);
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i],
          b = ring[i + 1];
        if (!includeEdge(f, a, b)) continue;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < EPS) continue;
        edges.push({
          a,
          b,
          owner: f.id,
          inward: [(-(b[1] - a[1]) / len) * sign, ((b[0] - a[0]) / len) * sign],
        });
      }
    });
  }
  const pieces = new Map<
    string,
    { a: XY; b: XY; owners: Set<string>; inward: XY }
  >();
  const key = (p: XY) => `${Math.round(p[0] / EPS)},${Math.round(p[1] / EPS)}`;
  for (const edge of edges) {
    const dx = edge.b[0] - edge.a[0],
      dy = edge.b[1] - edge.a[1],
      len = Math.hypot(dx, dy);
    const cuts = [0, 1];
    for (const other of edges) {
      for (const p of [other.a, other.b]) {
        const cross =
          Math.abs(dx * (p[1] - edge.a[1]) - dy * (p[0] - edge.a[0])) / len;
        const t =
          ((p[0] - edge.a[0]) * dx + (p[1] - edge.a[1]) * dy) / (len * len);
        if (cross < EPS && t > EPS / len && t < 1 - EPS / len) cuts.push(t);
      }
    }
    cuts.sort((a, b) => a - b);
    // Recomputing a + (b - a) can differ from b by one floating-point ULP.
    // Preserve authored endpoints so adjoining wall strips share exactly the
    // same vertex and polygon union can close their boundary rings.
    const pointAt = (t: number): XY =>
      t === 0
        ? [...edge.a]
        : t === 1
          ? [...edge.b]
          : [edge.a[0] + dx * t, edge.a[1] + dy * t];
    for (let i = 1; i < cuts.length; i++) {
      if ((cuts[i] - cuts[i - 1]) * len < EPS) continue;
      const a = pointAt(cuts[i - 1]),
        b = pointAt(cuts[i]);
      const id = [key(a), key(b)].sort().join(":");
      const existing = pieces.get(id);
      if (existing) existing.owners.add(edge.owner);
      else
        pieces.set(id, {
          a,
          b,
          owners: new Set([edge.owner]),
          inward: edge.inward,
        });
    }
  }
  const wallPieces = [...pieces.values()];
  const walls: WallSegment[] = wallPieces.map(({ a, b, inward: n, owners }) => {
    const inner = owners.size > 1 ? thickness / 2 : thickness;
    const outer = owners.size > 1 ? -thickness / 2 : 0;
    const ring: XY[] = [
      [a[0] + n[0] * outer, a[1] + n[1] * outer],
      [b[0] + n[0] * outer, b[1] + n[1] * outer],
      [b[0] + n[0] * inner, b[1] + n[1] * inner],
      [a[0] + n[0] * inner, a[1] + n[1] * inner],
    ];
    ring.push(ring[0]);
    return { a, b, owners: [...owners], polygon: [ring] };
  });

  // Inward strips overlap at convex corners but only touch at a single point
  // at a concave corner. Join the two inward offset lines to close that gap.
  // Clip the join to its source room so a recess or corridor stays untouched.
  const cross = (a: XY, b: XY) => a[0] * b[1] - a[1] * b[0];
  const wallDepth = (owner: string, point: XY, direction: XY) => {
    const piece = wallPieces.find((part) => {
      if (!part.owners.has(owner)) return false;
      const nearA =
        Math.hypot(part.a[0] - point[0], part.a[1] - point[1]) < EPS;
      const nearB =
        Math.hypot(part.b[0] - point[0], part.b[1] - point[1]) < EPS;
      if (!nearA && !nearB) return false;
      const delta: XY = [part.b[0] - part.a[0], part.b[1] - part.a[1]];
      return Math.abs(cross(delta, direction)) < EPS;
    });
    return piece && piece.owners.size > 1 ? thickness / 2 : thickness;
  };
  for (const f of features) {
    if (!isEnclosed(f) || f.geometry.type !== "Polygon") continue;
    const room = f.geometry.coordinates;
    room.forEach((ring, ringIndex) => {
      const vertices = ring
        .slice(0, -1)
        .filter(
          (point, index, all) =>
            index === 0 ||
            Math.hypot(
              point[0] - all[index - 1][0],
              point[1] - all[index - 1][1],
            ) >= EPS,
        );
      const sign = Math.sign(area(ring)) * (ringIndex ? -1 : 1);
      vertices.forEach((point, index) => {
        const prev = vertices[(index + vertices.length - 1) % vertices.length];
        const next = vertices[(index + 1) % vertices.length];
        if (!includeEdge(f, prev, point) || !includeEdge(f, point, next))
          return;
        const lengthA = Math.hypot(point[0] - prev[0], point[1] - prev[1]);
        const lengthB = Math.hypot(next[0] - point[0], next[1] - point[1]);
        if (lengthA < EPS || lengthB < EPS) return;
        const directionA: XY = [
          (point[0] - prev[0]) / lengthA,
          (point[1] - prev[1]) / lengthA,
        ];
        const directionB: XY = [
          (next[0] - point[0]) / lengthB,
          (next[1] - point[1]) / lengthB,
        ];
        const turn = cross(directionA, directionB);
        if (turn * sign >= -EPS) return;
        const depthA = wallDepth(f.id, point, directionA);
        const depthB = wallDepth(f.id, point, directionB);
        const offsetA: XY = [
          point[0] - directionA[1] * sign * depthA,
          point[1] + directionA[0] * sign * depthA,
        ];
        const offsetB: XY = [
          point[0] - directionB[1] * sign * depthB,
          point[1] + directionB[0] * sign * depthB,
        ];
        const delta: XY = [offsetB[0] - offsetA[0], offsetB[1] - offsetA[1]];
        const distance = cross(delta, directionB) / turn;
        const intersection: XY = [
          offsetA[0] + directionA[0] * distance,
          offsetA[1] + directionA[1] * distance,
        ];
        const join: XY[] = [point, offsetA, intersection, offsetB, point];
        for (const polygon of polygonClipping.intersection([join], room)) {
          walls.push({ a: point, b: point, owners: [f.id], polygon });
        }
      });
    });
  }
  return walls;
}

function placeForFeature(detail: VenueDetail, feature: VenueFeature): VenuePlace | null {
  const places = detail.places.filter((place) => place.buildingId === feature.buildingId && place.levelRef === feature.levelRef);
  const explicit = places.filter((place) => place.featureId === feature.id);
  if (explicit.length === 1) return explicit[0];
  if (explicit.length > 1 || !feature.ref) return null;
  const matchingFeatures = detail.features.filter((candidate) => candidate.buildingId === feature.buildingId && candidate.levelRef === feature.levelRef && candidate.ref === feature.ref);
  const matchingPlaces = places.filter((place) => !place.featureId && place.ref === feature.ref);
  return matchingFeatures.length === 1 && matchingPlaces.length === 1 ? matchingPlaces[0] : null;
}

/** Source feature/connection association is necessary; a shaft's presence never
 * creates a stop or divides a mixed core into invented elevator/stair geometry. */
function facilityRole(detail: VenueDetail, feature: VenueFeature): { role: IndoorMaterialRole; servesLevel: boolean | null } | null {
  const type = feature.tags?.['a11ymap:area_type'];
  if (type === 'vertical-core') return { role: 'core', servesLevel: null };
  const kind = type === 'elevator-shaft' || feature.kind === 'elevator' ? 'elevator' : type === 'stairwell' || feature.kind === 'stairs' ? 'stairs' : null;
  if (!kind) return null;
  const ids = new Set([feature.connectionId, ...(feature.connectionIds ?? [])]);
  const connections = detail.connections.filter((connection) => connection.buildingId === feature.buildingId && (kind === 'elevator' ? connection.kind === 'elevator' : ['stairs', 'steps', 'escalator'].includes(connection.kind)) && (ids.has(connection.id) || connection.featureIds?.includes(feature.id)));
  const servesLevel = connections.length ? connections.some((connection) => connection.levelRefs.includes(feature.levelRef)) : null;
  return { role: servesLevel === false ? 'nonStopping' : kind, servesLevel };
}

/** Native single-floor grounded cutaway. All raised dimensions are display
 * conventions from web geometry/sceneContent, never measured building heights.
 * Other buildings are only thin footprint context and cannot cover the cutaway. */
export function indoorSceneGeoJSON(detail: VenueDetail, buildingId: string | null, levelRef: string | null): FeatureCollection<Polygon, IndoorSceneProperties> {
  const result: Feature<Polygon, IndoorSceneProperties>[] = [];
  const selected = detail.buildings.find((building) => building.id === buildingId);
  const level = selected?.levels.find((candidate) => candidate.ref === levelRef);
  const lngScale = METERS_PER_DEGREE * Math.cos(detail.center[1] * Math.PI / 180);
  if (Math.abs(lngScale) < 1) return { type: 'FeatureCollection', features: [] };
  const local = ([lng, lat]: LngLat): XY => [(lng - detail.center[0]) * lngScale, (lat - detail.center[1]) * METERS_PER_DEGREE];
  const geographic = ([x, y]: XY): LngLat => [detail.center[0] + x / lngScale, detail.center[1] + y / METERS_PER_DEGREE];
  const properties = (sourceId: string, role: IndoorMaterialRole, kind: IndoorSceneProperties['kind'], base: number, height: number, placeId: string | null = null, servesLevel: boolean | null = null): IndoorSceneProperties => ({ sourceId, role, kind, base, height, active: true, buildingId: selected?.id ?? '', levelRef: level?.ref ?? null, placeId, servesLevel, displayOnly: true, sourceElevationM: level?.elevationM ?? null, thicknessM: null, thicknessKind: null });
  const add = (rings: Rings, props: IndoorSceneProperties) => {
    result.push({ type: 'Feature', id: `${props.buildingId}:${props.sourceId}:${props.kind}:${result.length}`, geometry: { type: 'Polygon', coordinates: rings.map((ring) => ring.map(geographic)) }, properties: props });
  };
  for (const building of detail.buildings) {
    if (building.id === buildingId) continue;
    result.push({ type: 'Feature', id: `context:${building.id}`, geometry: { type: 'Polygon', coordinates: building.footprint }, properties: { ...properties(building.id, 'context', 'context', 0, 0.035), active: false, buildingId: building.id, levelRef: null, sourceElevationM: null } });
  }
  if (!selected || !level) return { type: 'FeatureCollection', features: result };
  const source: SourcePolygon[] = detail.features.flatMap((feature) => feature.buildingId === buildingId && feature.levelRef === levelRef && feature.geometry.type === 'Polygon' ? [{ source: feature, rings: feature.geometry.coordinates.map((ring) => ring.map(local)) }] : []);
  const patches = source.filter(({ source }) => isFloorPatch(source)).map(({ rings }) => rings);
  const voids = source.filter(({ source }) => isVoid(source)).map(({ rings }) => rings);
  const floorOutline = union(patches);
  const floor = voids.length ? clip(floorOutline, floorOutline, voids) : floorOutline;
  for (const rings of floor) add(rings, properties(selected.id, 'slab', 'slab', 0, INDOOR_DISPLAY.slabThickness));
  const base = INDOOR_DISPLAY.slabThickness;
  for (const item of source) {
    const feature = item.source;
    if (isFloorBase(feature) || isVoid(feature)) continue;
    const association = placeForFeature(detail, feature);
    const facility = facilityRole(detail, feature);
    const role: IndoorMaterialRole = facility?.role ?? (feature.kind === 'room' ? 'room' : feature.tags?.amenity === 'toilets' ? 'toilet' : feature.kind === 'corridor' ? 'corridor' : 'unknownArea');
    const surfaceBase = base + (facility ? 0.024 : 0.004);
    const surfaceTop = surfaceBase + (facility ? 0.02 : 0.018);
    if (facility || !isOpening(feature)) {
      const surfaces = voids.length ? clip([item.rings], [item.rings], voids) : [item.rings];
      for (const rings of surfaces) add(rings, properties(feature.id, role, 'surface', surfaceBase, surfaceTop, association?.id ?? null, facility?.servesLevel ?? null));
    }
    const outlineRole: IndoorMaterialRole = facility ? facility.servesLevel === false ? 'nonStoppingOutline' : 'facilityOutline' : feature.kind === 'area' || isOpening(feature) ? 'spaceBoundary' : 'outline';
    for (const rings of outlines(item.rings, 0.035)) add(rings, properties(feature.id, outlineRole, 'outline', base + 0.05, base + 0.053, association?.id ?? null, facility?.servesLevel ?? null));
  }

  const enclosed = source.flatMap((item) => {
    if (isEnclosed(item.source)) return [{ source: item.source, rings: item.rings, approaches: Array<Edge>() }];
    if (item.source.tags?.['a11ymap:area_type'] !== 'elevator-shaft' || !item.source.connectionId) return [];
    const connection = detail.connections.find((connection) => connection.id === item.source.connectionId && connection.buildingId === buildingId && connection.kind === 'elevator');
    if (!connection) return [];
    const stops = new Set(connection.nodeIds ?? detail.places.filter((place) => place.buildingId === buildingId && (place.connectionId === connection.id || place.connectionIds?.includes(connection.id))).map((place) => place.nodeId));
    const boundary = edges(item.rings);
    const approaches = detail.walkways.flatMap((walkway) => {
      if (!walkway.nodeIds?.some((id) => stops.has(id)) || Math.abs(walkway.coordinates[0][2] - walkway.coordinates[1][2]) > EPS) return [];
      const edge = { a: local([walkway.coordinates[0][0], walkway.coordinates[0][1]]), b: local([walkway.coordinates[1][0], walkway.coordinates[1][1]]) };
      return boundary.some((side) => segmentsCross(side, edge)) ? [edge] : [];
    });
    return approaches.length ? [{ source: { ...item.source, kind: 'room' as const }, rings: item.rings, approaches }] : [];
  });
  const rooms = enclosed.map(({ rings }) => rings);
  const corridors = source.filter(({ source }) => source.kind === 'corridor').map(({ rings }) => rings);
  const roomBoundaries = enclosed.flatMap(({ rings, approaches }) => edges(rings).filter((edge) => !approaches.some((approach) => segmentsCross(edge, approach))));
  const approaches = new Map(enclosed.map((item) => [item.source.id, item.approaches]));
  const roomStrips = roomWalls(
    enclosed.map((item) => ({ ...item.source, geometry: { type: 'Polygon', coordinates: item.rings } })),
    INDOOR_DISPLAY.wallThickness,
    (feature, a, b) => !approaches.get(feature.id)?.some((approach) => segmentsCross({ a, b }, approach)),
  ).map((wall) => wall.polygon);
  const roomUnion = cleanWalls(union(roomStrips.map(wallOverlay)));
  const interiorWalls = corridors.length ? cleanWalls(polygonClipping.difference(roomUnion, ...corridors.map(wallOverlay))) : roomUnion;
  for (const rings of interiorWalls) add(rings, { ...properties('room-boundaries', 'wall', 'wall', base, base + INDOOR_DISPLAY.wallHeight), thicknessM: INDOOR_DISPLAY.wallThickness, thicknessKind: 'display' });

  // Exterior walls are derived from this floor's source union, not an arbitrary
  // building footprint. Keep source-linked entries open using web's display gap.
  const outlineEdges = floorOutline.flatMap((polygon) => edges([polygon[0], ...polygon.slice(1).filter((ring) => Math.abs(area(ring)) >= 1)]));
  const links: Edge[] = detail.walkways.flatMap((walkway) => walkway.buildingIds.some((id, index) => id === buildingId && walkway.levelRefs[index] === levelRef) ? [{ a: local([walkway.coordinates[0][0], walkway.coordinates[0][1]]), b: local([walkway.coordinates[1][0], walkway.coordinates[1][1]]) }] : []);
  for (const connection of detail.connections) {
    if (connection.kind === 'elevator' || connection.buildingId !== buildingId) continue;
    connection.coordinates.slice(1).forEach((point, index) => {
      if (connection.levelRefs[index] !== levelRef && connection.levelRefs[index + 1] !== levelRef) return;
      const previous = connection.coordinates[index];
      links.push({ a: local([previous[0], previous[1]]), b: local([point[0], point[1]]) });
    });
  }
  const exteriorStrips = roomWalls(floorOutline.map((rings, index): VenueFeature => ({
    id: `exterior-${index}`, kind: 'room', buildingId: selected.id, levelRef: level.ref, ordinal: level.ordinal,
    geometry: { type: 'Polygon', coordinates: [rings[0], ...rings.slice(1).filter((ring) => Math.abs(area(ring)) >= 1)] },
    geometryStatus: selected.geometryStatus, heightStatus: selected.heightStatus,
  }))).map((wall) => wall.polygon);
  const entranceCuts: Rings[] = [];
  for (const edge of outlineEdges) {
    const delta = minus(edge.b, edge.a), size = length(edge.a, edge.b);
    for (const link of links) {
      const direction = minus(link.b, link.a), offset = minus(link.a, edge.a), denominator = cross(delta, direction);
      if (Math.abs(denominator) < 1e-10) continue;
      const t = cross(offset, direction) / denominator, u = cross(offset, delta) / denominator;
      if (t < 0 || t > 1 || u < -0.05 / length(link.a, link.b) || u > 1 + 0.05 / length(link.a, link.b)) continue;
      const near = (point: XY) => outlineEdges.some((boundary) => distanceToEdge(point, boundary) < 0.05);
      const outside = (point: XY) => !near(point) && !floorOutline.some((polygon) => inside(point, polygon));
      const sample = 0.1 / length(link.a, link.b);
      const sides = [outside(interpolate(link.a, link.b, Math.max(0, Math.min(1, u - sample)))), outside(interpolate(link.a, link.b, Math.max(0, Math.min(1, u + sample))))];
      if (!sides.some(Boolean) || sides.every(Boolean)) continue;
      const start = t - INDOOR_DISPLAY.entranceWidth / 2 / size, end = t + INDOOR_DISPLAY.entranceWidth / 2 / size;
      entranceCuts.push(strip({ a: interpolate(edge.a, edge.b, start), b: interpolate(edge.a, edge.b, end) }, -0.3, 0.3));
    }
  }
  for (const rings of cleanWalls(union(exteriorStrips.map(wallOverlay)))) add(rings, { ...properties('floor-exterior', 'wall', 'wall', base, base + INDOOR_DISPLAY.wallHeight), thicknessM: INDOOR_DISPLAY.wallThickness, thicknessKind: 'display' });

  for (const wall of detail.walls) {
    if (wall.buildingId !== buildingId || wall.levelRef !== levelRef) continue;
    const wallEdges = edges([wall.geometry.coordinates.map(local)]);
    for (const edge of splitEdges(wallEdges, roomBoundaries)) {
      const size = length(edge.a, edge.b), center = midpoint(edge.a, edge.b);
      const normal: XY = [-(edge.b[1] - edge.a[1]) / size, (edge.b[0] - edge.a[0]) / size];
      const left = rooms.some((room) => inside([center[0] + normal[0] * EPS * 4, center[1] + normal[1] * EPS * 4], room));
      const right = rooms.some((room) => inside([center[0] - normal[0] * EPS * 4, center[1] - normal[1] * EPS * 4], room));
      const width = wall.thicknessM ?? (left || right ? INDOOR_DISPLAY.sourceWallThickness : INDOOR_DISPLAY.boundaryWallThickness);
      const polygon = strip(edge, right || !left ? -width / (left || !right ? 2 : 1) : 0, left || !right ? width / (right || !left ? 2 : 1) : 0);
      const displayed = left || right ? clipWalls([polygon], rooms, corridors) : [polygon];
      for (const rings of displayed) add(rings, { ...properties(wall.id, 'wall', 'wall', base, base + INDOOR_DISPLAY.wallHeight), thicknessM: width, thicknessKind: wall.thicknessM == null ? 'display' : 'source' });
    }
  }
  if (entranceCuts.length) {
    const withOpenings = result.flatMap((feature) => {
      if (feature.properties.kind !== 'wall') return [feature];
      const rings: Rings = feature.geometry.coordinates.map((ring) => ring.map(([lng, lat]) => local([lng, lat])));
      return cleanWalls(polygonClipping.difference(wallOverlay(rings), ...entranceCuts.map(wallOverlay))).map((polygon, index): Feature<Polygon, IndoorSceneProperties> => ({ ...feature, id: `${feature.id}:opening:${index}`, geometry: { type: 'Polygon', coordinates: polygon.map((ring) => ring.map(geographic)) } }));
    });
    return { type: 'FeatureCollection', features: withOpenings };
  }
  return { type: 'FeatureCollection', features: result };
}
