import type { VenueAnnotations, VenueDetail, VenueRoute } from '../../types/venue';

const annotations: VenueAnnotations = { geometryStatus: 'schematic', heightStatus: 'estimated', heightPending: true, note: '測試資料', fixme: '高度待確認' };

/** 合成契約測試資料，不代表任何實際場館的幾何或通行能力。 */
export function createVenueDetail(): VenueDetail {
  return {
    venueId: 'test-venue', name: '測試場館', version: 3, importedAt: '2026-10-29T00:00:00Z', center: [121, 25], sourceSha256: null,
    buildings: [{
      ...annotations, id: 'a', name: '測試館', aliases: [], floorHeightM: 3, groundOffsetM: 0,
      footprint: [[[121, 25], [121.001, 25], [121.001, 25.001], [121, 25]]],
      levels: [
        { ordinal: 1, ref: '1F', elevationM: 0, coverage: { hasAnchor: true, hasRouteData: true, hasDisplayGeometry: true } },
        { ordinal: 2, ref: '2F', elevationM: 3, coverage: { hasAnchor: true, hasRouteData: true, hasDisplayGeometry: true } },
        { ordinal: 3, ref: '3F', elevationM: 6, coverage: { hasAnchor: false, hasRouteData: false, hasDisplayGeometry: true } },
      ],
    }],
    places: [
      { id: 'start', name: '起點空間', kind: 'room', buildingId: 'a', levelRef: '1F', nodeId: 'node-0', location: [121, 25], arrivalKind: 'corridor', doorKnown: false },
      { id: 'end', name: '終點空間', kind: 'room', buildingId: 'a', levelRef: '2F', nodeId: 'node-3', location: [121.0002, 25], arrivalKind: 'corridor', doorKnown: false },
    ],
    features: [
      { ...annotations, id: 'room', kind: 'room', buildingId: 'a', levelRef: '1F', ordinal: 1, geometry: { type: 'Polygon', coordinates: [[[121, 25], [121.001, 25], [121.001, 25.001], [121, 25]], [[121.0001, 25.0001], [121.0002, 25.0001], [121.0002, 25.0002], [121.0001, 25.0001]]] } },
      { ...annotations, id: 'shaft', kind: 'elevator', buildingId: 'a', levelRef: '3F', ordinal: 3, geometry: { type: 'Point', coordinates: [121.0001, 25] } },
    ],
    walls: [{ ...annotations, id: 'wall', buildingId: 'a', levelRef: '1F', ordinal: 1, geometry: { type: 'LineString', coordinates: [[121, 25], [121.001, 25]] } }],
    walkways: [{ ...annotations, id: 'walkway', kind: 'corridor', indoor: true, buildingId: 'a', levelRef: '1F', buildingIds: ['a', 'a'], levelRefs: ['1F', '1F'], coordinates: [[121, 25, 0], [121.0001, 25, 0]], wheelchair: 'yes', osmRef: 'test-way' }],
    connections: [{ ...annotations, id: 'lift', kind: 'elevator', buildingId: 'a', coordinates: [[121.0001, 25, 0], [121.0001, 25, 3]], levelRefs: ['1F', '2F'], nodeIds: ['node-1', 'node-2'], wheelchair: 'yes', osmRef: 'test-lift' }],
  };
}
export function createVenueRoute(): VenueRoute {
  return {
    venueId: 'test-venue', venueVersion: 3, mode: 'wheelchair', fromPlaceId: 'start', toPlaceId: 'end', distanceM: 20, durationS: 80, elevatorRides: 1, stairFlights: 0,
    path: { coordinates: [[121, 25, 0], [121.0001, 25, 0], [121.0001, 25, 3], [121.0002, 25, 3]], buildingIds: ['a', 'a', 'a', 'a'], levelRefs: ['1F', '1F', '2F', '2F'] },
    segments: [{ buildingId: 'a', levelRef: '1F', pathStart: 0, pathEnd: 2 }, { buildingId: 'a', levelRef: '2F', pathStart: 2, pathEnd: 3 }],
    steps: [
      { type: 'depart', instruction: '由起點出發', distanceM: 0, durationS: 0, buildingId: 'a', levelRef: '1F', pathStart: 0, pathEnd: 0 },
      { type: 'walk', instruction: '沿一樓走廊前進', distanceM: 10, durationS: 10, buildingId: 'a', levelRef: '1F', pathStart: 0, pathEnd: 1 },
      { type: 'elevator', instruction: '搭乘電梯至 2F', distanceM: 0, durationS: 60, buildingId: 'a', levelRef: '2F', fromLevelRef: '1F', toLevelRef: '2F', connectionId: 'lift', heightPending: true, pathStart: 1, pathEnd: 2 },
      { type: 'walk', instruction: '沿二樓走廊前進', distanceM: 10, durationS: 10, buildingId: 'a', levelRef: '2F', pathStart: 2, pathEnd: 3 },
      { type: 'arrive', instruction: '抵達終點空間前公共走道', distanceM: 0, durationS: 0, buildingId: 'a', levelRef: '2F', pathStart: 3, pathEnd: 3 },
    ],
  };
}
