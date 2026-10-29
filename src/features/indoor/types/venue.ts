import type { LngLat, LngLatZ, ConnectionKind } from '@/shared/venue';
export type { LngLat, LngLatZ, VenueMode, ConnectionKind, VenueRoute, VenueRouteSegment, VenueRouteStep, VenueRouteRequest } from '@/shared/venue';

/** API 座標為經緯度；第三維是場域相對高度，不能當作手機定位樓層。 */
export type WheelchairAccess = 'yes' | 'no' | 'limited' | 'unknown';

export interface VenueAnnotations {
  geometryStatus: 'surveyed' | 'traced' | 'schematic';
  heightStatus: 'measured' | 'drawing' | 'estimated';
  source?: string;
  heightPending?: boolean;
  note?: string;
  fixme?: string;
}
export interface VenueLevel {
  ordinal: number;
  ref: string;
  elevationM: number;
  coverage: { hasAnchor: boolean; hasRouteData: boolean; hasDisplayGeometry: boolean };
}
export interface VenueBuilding extends VenueAnnotations {
  id: string;
  name: string;
  aliases: string[];
  footprint: LngLat[][];
  floorHeightM: number;
  groundOffsetM: number;
  levels: VenueLevel[];
}
export interface VenueSummary {
  venueId: string;
  name: string;
  center: LngLat;
  version: number;
  importedAt: string;
  buildings: { id: string; name: string }[];
}
export interface VenuePlace {
  id: string;
  name: string;
  ref?: string;
  kind: 'room' | 'amenity' | 'parking' | 'entrance' | 'gate' | 'anchor' | 'poi';
  buildingId: string | null;
  levelRef: string | null;
  nodeId: string;
  location: LngLat;
  arrivalNodeIds?: string[];
  featureId?: string | null;
  arrivalKind?: 'door' | 'corridor' | 'place' | null;
  doorKnown?: boolean | null;
  connectionId?: string | null;
  connectionIds?: string[];
  wheelchair?: WheelchairAccess;
  accessibleSpaces?: number;
}
export interface VenueFeature extends VenueAnnotations {
  id: string;
  kind: 'room' | 'corridor' | 'area' | 'door' | 'elevator' | 'stairs';
  buildingId: string | null;
  levelRef: string | null;
  ordinal: number | null;
  name?: string;
  ref?: string;
  geometry: { type: 'Polygon'; coordinates: LngLat[][] } | { type: 'Point'; coordinates: LngLat };
  tags?: { indoor?: string; amenity?: string; 'a11ymap:area_type'?: string; ref?: string; wheelchair?: WheelchairAccess };
  connectionId?: string | null;
  connectionIds?: string[];
}
export interface VenueWall extends VenueAnnotations {
  id: string;
  buildingId: string | null;
  levelRef: string | null;
  ordinal: number | null;
  thicknessM?: number | null;
  geometry: { type: 'LineString'; coordinates: LngLat[] };
}
export interface VenueWalkway extends VenueAnnotations {
  id: string;
  kind: 'corridor' | 'footway' | 'path' | 'pedestrian' | 'service' | 'crossing';
  indoor: boolean;
  coordinates: [LngLatZ, LngLatZ];
  nodeIds?: [string, string];
  buildingId: string | null;
  levelRef: string | null;
  buildingIds: [string | null, string | null];
  levelRefs: [string | null, string | null];
  wheelchair: WheelchairAccess;
  osmRef: string;
}
export interface VenueConnection extends VenueAnnotations {
  id: string;
  kind: ConnectionKind;
  buildingId: string | null;
  coordinates: LngLatZ[];
  levelRefs: (string | null)[];
  nodeIds?: string[];
  wheelchair: WheelchairAccess;
  osmRef: string;
  slopeRatio?: number;
  stepCount?: number;
  name?: string | null;
  ref?: string | null;
  featureIds?: string[];
}
export interface VenueDetail extends Omit<VenueSummary, 'buildings'> {
  sourceSha256: string | null;
  buildings: VenueBuilding[];
  places: VenuePlace[];
  features: VenueFeature[];
  walls: VenueWall[];
  walkways: VenueWalkway[];
  connections: VenueConnection[];
}
