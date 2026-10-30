import type { Feature, FeatureCollection, Geometry, LineString, Point } from 'geojson';
import type { LngLat, VenueDetail, VenueRoute } from '../types/venue';

export interface FloorProperties {
  id: string;
  layer: 'area' | 'feature' | 'wall' | 'walkway' | 'connection' | 'place';
  kind: string;
  name: string;
  placeId?: string;
}
export interface RouteProperties { kind: 'route' | 'route-stop'; pathIndex?: number }

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

/** 每點的樓層才是幾何依據；不能把電梯或跨棟路段壓成同層直線。 */
export function routeFloorGeoJSON(route: VenueRoute, buildingId: string | null, levelRef: string | null): FeatureCollection<LineString | Point, RouteProperties> {
  const features: Feature<LineString | Point, RouteProperties>[] = [];
  let run: LngLat[] = [];
  const flush = () => {
    if (run.length >= 2) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: run }, properties: { kind: 'route' } });
    run = [];
  };
  route.path.coordinates.forEach(([lng, lat], index) => {
    const belongs = route.path.buildingIds[index] === buildingId && route.path.levelRefs[index] === levelRef;
    if (!belongs) { flush(); return; }
    run.push([lng, lat]);
    features.push({ type: 'Feature', id: `route:${index}`, geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { kind: 'route-stop', pathIndex: index } });
  });
  flush();
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
