export type LngLat = [number, number];
export type LngLatZ = [number, number, number];
export type VenueMode = 'normal' | 'wheelchair' | 'elderly' | 'visual_impaired';
export type ConnectionKind = 'stairs' | 'steps' | 'ramp' | 'escalator' | 'elevator';

export interface VenueRouteSegment {
  buildingId: string | null;
  levelRef: string | null;
  pathStart: number;
  pathEnd: number;
}
export interface VenueRouteStep extends VenueRouteSegment {
  type: 'depart' | 'walk' | 'enter' | 'exit' | ConnectionKind | 'arrive';
  instruction: string;
  maneuver?: 'left' | 'right' | 'uturn';
  distanceM: number;
  durationS: number;
  fromLevelRef?: string;
  toLevelRef?: string;
  connectionId?: string | null;
  heightPending?: boolean;
}
export interface VenueRoute {
  venueId: string;
  venueVersion: number;
  mode: VenueMode;
  fromPlaceId: string;
  toPlaceId: string;
  distanceM: number;
  durationS: number;
  elevatorRides: number;
  stairFlights: number;
  path: { coordinates: LngLatZ[]; buildingIds: (string | null)[]; levelRefs: (string | null)[] };
  segments: VenueRouteSegment[];
  steps: VenueRouteStep[];
}
export interface VenueRouteRequest {
  venueId: string;
  fromPlaceId: string;
  toPlaceId: string;
  mode: VenueMode;
}
