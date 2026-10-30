import type { Feature, FeatureCollection, Geometry, LineString, Point } from 'geojson';
import type { LngLatZ, VenueDetail, VenueRoute } from '../types/venue';
import { campusFloorViews, type CampusFloorView } from './campusFloorViews';

export interface FloorProperties {
  id: string;
  layer: 'area' | 'feature' | 'wall' | 'walkway' | 'connection' | 'place';
  kind: string;
  name: string;
  placeId?: string;
}
export interface RouteProperties { kind: 'route' | 'route-stop'; pathIndex?: number; pathStart?: number; pathEnd?: number }

/** 只畫所選樓層。電梯井道不會自行產生可搭乘點，停靠點僅取 connections。 */
export function floorGeoJSON(detail: VenueDetail, buildingId: string | null, levelRef: string | null): FeatureCollection<Geometry, FloorProperties> {
  const features: Feature<Geometry, FloorProperties>[] = [];
  for (const item of detail.features) {
    if (item.buildingId !== buildingId || item.levelRef !== levelRef) continue;
    features.push({ type: 'Feature', id: `feature:${item.id}`, geometry: item.geometry, properties: { id: item.id, layer: item.geometry.type === 'Polygon' ? 'area' : 'feature', kind: item.kind, name: item.name ?? item.ref ?? '' } });
  }
  for (const item of detail.walls) {
    if (item.buildingId !== buildingId || item.levelRef !== levelRef) continue;
    features.push({ type: 'Feature', id: `wall:${item.id}`, geometry: item.geometry, properties: { id: item.id, layer: 'wall', kind: 'wall', name: '' } });
  }
  for (const item of detail.walkways) {
    if (!item.buildingIds.every((id) => id === buildingId) || !item.levelRefs.every((ref) => ref === levelRef)) continue;
    features.push({ type: 'Feature', id: `walkway:${item.id}`, geometry: { type: 'LineString', coordinates: item.coordinates.map(([lng, lat]) => [lng, lat]) }, properties: { id: item.id, layer: 'walkway', kind: item.kind, name: '' } });
  }
  for (const item of detail.connections) {
    if (item.buildingId !== buildingId) continue;
    item.coordinates.forEach(([lng, lat], index) => {
      if (item.levelRefs[index] !== levelRef) return;
      features.push({ type: 'Feature', id: `connection:${item.id}:${index}`, geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { id: item.id, layer: 'connection', kind: item.kind, name: item.name ?? item.ref ?? '' } });
    });
  }
  for (const place of detail.places) {
    if (place.buildingId !== buildingId || place.levelRef !== levelRef) continue;
    features.push({ type: 'Feature', id: `place:${place.id}`, geometry: { type: 'Point', coordinates: place.location }, properties: { id: place.id, placeId: place.id, layer: 'place', kind: place.kind, name: place.name } });
  }
  return { type: 'FeatureCollection', features };
}

function clipFloorEdge(from: LngLatZ, to: LngLatZ, view: CampusFloorView): [LngLatZ, LngLatZ] | null {
  const low = view.elevationM - 0.16, high = view.elevationM + 0.85;
  const delta = to[2] - from[2];
  if (Math.abs(delta) < 1e-10) return from[2] >= low && from[2] <= high ? [from, to] : null;
  const first = (low - from[2]) / delta, last = (high - from[2]) / delta;
  const start = Math.max(0, Math.min(first, last)), end = Math.min(1, Math.max(first, last));
  if (start >= end) return null;
  const at = (amount: number): LngLatZ => amount === 0 ? from : amount === 1 ? to : [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + delta * amount,
  ];
  return [at(start), at(end)];
}

/** Preserve authored adjacent edges across visible buildings and the ground
 * campus network. Hidden floors never become shortcuts between visible runs. */
export function routeFloorGeoJSON(route: VenueRoute, detail: VenueDetail, buildingId: string | null, levelRef: string | null): FeatureCollection<LineString | Point, RouteProperties> {
  const features: Feature<LineString | Point, RouteProperties>[] = [];
  const { coordinates, buildingIds, levelRefs } = route.path;
  if (coordinates.length !== buildingIds.length || coordinates.length !== levelRefs.length) return { type: 'FeatureCollection', features };
  const views = campusFloorViews(detail, buildingId, levelRef);
  const visible = (index: number) => views.some((view) => (
    buildingIds[index] === view.buildingId && levelRefs[index] === view.levelRef
  ) || (
    view.hasDisplayGeometry && view.ordinal === 0 && buildingIds[index] === null && levelRefs[index] === null
    && [0, view.elevationM].some((height) => Math.abs(coordinates[index][2] - height) <= 0.02)
  ));
  const stops = new Set<number>();
  const add = (index: number, edge: [LngLatZ, LngLatZ]) => {
    features.push({ type: 'Feature', id: `route-edge:${index}`, geometry: { type: 'LineString', coordinates: edge.map(([lng, lat]) => [lng, lat]) }, properties: { kind: 'route', pathStart: index, pathEnd: index + 1 } });
    if (edge[0] === coordinates[index]) stops.add(index);
    if (edge[1] === coordinates[index + 1]) stops.add(index + 1);
  };
  coordinates.slice(1).forEach((to, index) => {
    const from = coordinates[index];
    if (buildingIds[index] !== null && buildingIds[index] === buildingIds[index + 1]) {
      const view = views.find((candidate) => candidate.hasDisplayGeometry && candidate.buildingId === buildingIds[index]
        && candidate.levelRef === levelRefs[index] && candidate.levelRef === levelRefs[index + 1]);
      const edge = view ? clipFloorEdge(from, to, view) : null;
      if (edge) add(index, edge);
    } else if (visible(index) && visible(index + 1)) add(index, [from, to]);
  });
  for (const index of stops) {
    const [lng, lat] = coordinates[index];
    features.push({ type: 'Feature', id: `route:${index}`, geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { kind: 'route-stop', pathIndex: index } });
  }
  return { type: 'FeatureCollection', features };
}

export function venueCacheKey(venueId: string, version: number): string { return `${venueId}:${version}`; }

export function buildingBounds(detail: VenueDetail, buildingId: string): [number, number, number, number] | null {
  const building = detail.buildings.find((item) => item.id === buildingId);
  const points = building?.footprint.flat();
  if (!points?.length) return null;
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}
