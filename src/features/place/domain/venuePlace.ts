import type { VenueDetail, VenuePlace } from '@/features/indoor/domain';

import type { VenuePlaceDetail } from '../types/place';

export interface VenuePlaceIdentity { venueId: string; placeId: string }

export function venuePlaceId(identity: VenuePlaceIdentity): string {
  return `venue:${encodeURIComponent(identity.venueId)}:${encodeURIComponent(identity.placeId)}`;
}

export function parseVenuePlaceId(id: string): VenuePlaceIdentity | null {
  const parts = id.split(':');
  if (parts.length !== 3 || parts[0] !== 'venue') return null;
  try {
    const venueId = decodeURIComponent(parts[1]);
    const placeId = decodeURIComponent(parts[2]);
    return venueId.trim() && placeId.trim() ? { venueId, placeId } : null;
  } catch { return null; }
}

function floorLabel(ref: string | null): string {
  if (ref === null) return '戶外';
  if (/^-?\d+$/.test(ref)) return Number(ref) < 0 ? `B${Math.abs(Number(ref))}` : `${ref}F`;
  return ref;
}

export function venuePlaceSubtitle(place: VenuePlaceDetail): string {
  return [place.buildingName || place.venueName, floorLabel(place.levelRef)].filter(Boolean).join('・');
}

export function toVenuePlaceDetail(detail: VenueDetail, place: VenuePlace): VenuePlaceDetail {
  const buildingName = detail.buildings.find((building) => building.id === place.buildingId)?.name ?? '';
  return {
    kind: 'venue-place', venueId: detail.venueId, placeId: place.id, placeKind: place.kind, name: place.name,
    venueName: detail.name, buildingId: place.buildingId, buildingName, levelRef: place.levelRef,
    sourceVersion: detail.version, dataSource: 'api',
    address: [detail.name, buildingName, floorLabel(place.levelRef)].filter(Boolean).join('・'),
    position: { lng: place.location[0], lat: place.location[1] },
    arrivalKind: place.arrivalKind ?? null, doorKnown: place.doorKnown ?? null,
    wheelchair: place.wheelchair,
  };
}

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().trim();

/** 依真實 catalog/detail 搜尋房號、名稱、建物別名與樓層；不從座標推測樓層。 */
export function searchVenuePlaces(details: readonly VenueDetail[], query: string, limit = 12): VenuePlaceDetail[] {
  const normalized = normalize(query);
  if (!normalized) return [];
  const terms = normalized.split(/\s+/);
  return details.flatMap((detail) => detail.places.flatMap((place) => {
    const building = detail.buildings.find((item) => item.id === place.buildingId);
    const text = normalize([place.name, place.ref, detail.name, building?.name, ...(building?.aliases ?? []), place.levelRef, floorLabel(place.levelRef)].filter(Boolean).join(' '));
    if (!terms.every((term) => text.includes(term))) return [];
    const rank = [place.ref, place.name].some((name) => name && normalize(name) === normalized) ? 0 : normalize(place.name).startsWith(normalized) ? 1 : 2;
    return [{ rank, entry: toVenuePlaceDetail(detail, place) }];
  })).sort((a, b) => a.rank - b.rank).slice(0, limit).map(({ entry }) => entry);
}

export function isVenuePlaceDetail(value: unknown): value is VenuePlaceDetail {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  const position = entry.position as Record<string, unknown> | null;
  return entry.kind === 'venue-place' && entry.dataSource === 'api'
    && ['room', 'amenity', 'parking', 'entrance', 'gate', 'anchor', 'poi'].includes(String(entry.placeKind))
    && ['venueId', 'placeId', 'name', 'venueName', 'buildingName', 'address'].every((key) => typeof entry[key] === 'string')
    && Boolean(entry.venueId) && Boolean(entry.placeId)
    && (entry.buildingId === null || typeof entry.buildingId === 'string')
    && (entry.levelRef === null || typeof entry.levelRef === 'string')
    && (entry.arrivalKind === null || ['door', 'corridor', 'place'].includes(String(entry.arrivalKind)))
    && (entry.doorKnown === null || typeof entry.doorKnown === 'boolean')
    && (entry.wheelchair === undefined || ['yes', 'no', 'limited', 'unknown'].includes(String(entry.wheelchair)))
    && typeof entry.sourceVersion === 'number' && Number.isSafeInteger(entry.sourceVersion) && entry.sourceVersion >= 0
    && typeof position === 'object' && position !== null
    && typeof position.lat === 'number' && Number.isFinite(position.lat)
    && typeof position.lng === 'number' && Number.isFinite(position.lng);
}
