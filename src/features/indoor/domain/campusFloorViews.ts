import type { VenueDetail, VenueLevel } from '../types/venue';

export interface CampusFloorView {
  buildingId: string;
  levelRef: string;
  ordinal: number;
  elevationM: number;
  hasDisplayGeometry: boolean;
}

/** Match web's campus display slices by source floor name. A missing floor is
 * absent, not replaced with a neighboring building's ground floor. */
export function campusFloorViews(detail: VenueDetail, buildingId: string | null, levelRef: string | null): CampusFloorView[] {
  if (buildingId !== null && !detail.buildings.some((building) => building.id === buildingId && building.levels.some((level) => level.ref === levelRef))) return [];
  if ((buildingId === null) !== (levelRef === null)) return [];
  return detail.buildings.flatMap((building) => {
    const level = levelRef === null
      ? building.levels.find((candidate) => candidate.ordinal === 0)
      : building.levels.find((candidate) => candidate.ref === levelRef);
    return level ? [{ buildingId: building.id, levelRef: level.ref, ordinal: level.ordinal, elevationM: level.elevationM, hasDisplayGeometry: level.coverage.hasDisplayGeometry }] : [];
  });
}

/** This selects a display slice only; it never asserts the user's location. */
export function defaultIndoorLevel(levels: readonly VenueLevel[]): VenueLevel | undefined {
  return levels.find((level) => level.ref === '1F' && level.coverage.hasDisplayGeometry)
    ?? levels.find((level) => level.coverage.hasDisplayGeometry)
    ?? levels[0];
}
