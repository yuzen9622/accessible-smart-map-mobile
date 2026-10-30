import type { VenueHandoff } from '../../types/route';

/** Small contract fixture for handoff identity and stale-result tests, not a surveyed venue. */
export function venueHandoffFixture(): VenueHandoff {
  return {
    destinationName: '測試會議室',
    arrival: {
      venueId: 'test-venue', placeId: 'meeting', gateId: 'gate',
      gateLocation: { lat: 24.15, lng: 120.68 }, mode: 'wheelchair', venueVersion: 3,
    },
    leg: {
      venueId: 'test-venue', venueVersion: 3, mode: 'wheelchair', fromPlaceId: 'gate', toPlaceId: 'meeting',
      distanceM: 30, durationS: 60, elevatorRides: 0, stairFlights: 0,
      path: {
        coordinates: [[120.68, 24.15, 0], [120.6801, 24.1501, 0]],
        buildingIds: [null, 'building'], levelRefs: [null, '1F'],
      },
      segments: [{ buildingId: 'building', levelRef: '1F', pathStart: 0, pathEnd: 1 }],
      steps: [
        { type: 'depart', instruction: '從校門出發', distanceM: 0, durationS: 0, buildingId: null, levelRef: null, pathStart: 0, pathEnd: 0 },
        { type: 'walk', instruction: '前往公共走道', distanceM: 30, durationS: 60, buildingId: 'building', levelRef: '1F', pathStart: 0, pathEnd: 1 },
        { type: 'arrive', instruction: '抵達空間前公共走道', distanceM: 0, durationS: 0, buildingId: 'building', levelRef: '1F', pathStart: 1, pathEnd: 1 },
      ],
    },
  };
}
