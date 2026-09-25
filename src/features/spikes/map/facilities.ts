// Spike A：只為量測 7.9k 級設施點的分群效能。Phase 1 會改走 shared/api 與 features/map/api。
import type { Feature, FeatureCollection, Point } from 'geojson';

import { getAppConfig } from '@/shared/config';

export type FacilityCategory = 'elevator' | 'ramp' | 'toilet';

export interface FacilityProperties {
  id: string;
  name: string;
  category: FacilityCategory;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCategory(value: unknown): value is FacilityCategory {
  return value === 'elevator' || value === 'ramp' || value === 'toilet';
}

function toFeature(item: unknown): Feature<Point, FacilityProperties> | null {
  if (!isRecord(item) || !isRecord(item.location)) return null;
  const { coordinates } = item.location;
  if (
    !Array.isArray(coordinates) ||
    typeof coordinates[0] !== 'number' ||
    typeof coordinates[1] !== 'number' ||
    typeof item._id !== 'string' ||
    typeof item.name !== 'string' ||
    !isCategory(item.category)
  ) {
    return null;
  }
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [coordinates[0], coordinates[1]] },
    properties: { id: item._id, name: item.name, category: item.category },
  };
}

export interface FacilityLoadResult {
  collection: FeatureCollection<Point, FacilityProperties>;
  bytes: number;
  fetchMs: number;
  parseMs: number;
}

export async function loadFacilities(signal: AbortSignal): Promise<FacilityLoadResult> {
  const { apiBaseUrl } = getAppConfig();
  const started = Date.now();
  const response = await fetch(
    `${apiBaseUrl}/api/v1/a11y/all-facilities?category=elevator,ramp,toilet`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(`all-facilities HTTP ${response.status}`);
  }
  const text = await response.text();
  const fetched = Date.now();
  const body: unknown = JSON.parse(text);
  const data = isRecord(body) && Array.isArray(body.data) ? body.data : [];
  const features = data
    .map(toFeature)
    .filter((feature): feature is Feature<Point, FacilityProperties> => feature !== null);
  return {
    collection: { type: 'FeatureCollection', features },
    bytes: text.length,
    fetchMs: fetched - started,
    parseMs: Date.now() - fetched,
  };
}
