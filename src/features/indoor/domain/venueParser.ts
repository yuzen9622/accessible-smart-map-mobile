import { array, boolean, choice, integer, invalidVenueData, nullable, nullableText, number, optional, pair, point, point3, record, text, uniqueIds, version } from '@/shared/venue/validation';
import type { LngLat, VenueAnnotations, VenueBuilding, VenueConnection, VenueDetail, VenueFeature, VenueLevel, VenuePlace, VenueSummary, VenueWalkway, VenueWall } from '../types/venue';

function annotations(value: Record<string, unknown>): VenueAnnotations {
  return {
    geometryStatus: choice(value.geometryStatus, ['surveyed', 'traced', 'schematic']),
    heightStatus: choice(value.heightStatus, ['measured', 'drawing', 'estimated']),
    source: optional(value.source, text),
    heightPending: optional(value.heightPending, boolean),
    note: optional(value.note, text),
    fixme: optional(value.fixme, text),
  };
}
function rings(value: unknown): LngLat[][] {
  const result = array(value, (value) => array(value, point));
  if (!result.length) invalidVenueData();
  for (const ring of result) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (ring.length < 4 || first[0] !== last[0] || first[1] !== last[1]) invalidVenueData();
  }
  return result;
}
function parseLevel(value: unknown): VenueLevel {
  const item = record(value);
  const coverage = record(item.coverage);
  return {
    ordinal: integer(item.ordinal), ref: text(item.ref), elevationM: number(item.elevationM),
    coverage: { hasAnchor: boolean(coverage.hasAnchor), hasRouteData: boolean(coverage.hasRouteData), hasDisplayGeometry: boolean(coverage.hasDisplayGeometry) },
  };
}
function parseBuilding(value: unknown): VenueBuilding {
  const item = record(value);
  const levels = array(item.levels, parseLevel);
  uniqueIds(levels, (level) => level.ref);
  uniqueIds(levels, (level) => level.ordinal);
  return {
    ...annotations(item), id: text(item.id), name: text(item.name), aliases: array(item.aliases, text),
    footprint: rings(item.footprint), floorHeightM: number(item.floorHeightM), groundOffsetM: number(item.groundOffsetM), levels,
  };
}
function wheelchair(value: unknown) {
  return choice(value, ['yes', 'no', 'limited', 'unknown']);
}
function parsePlace(value: unknown): VenuePlace {
  const item = record(value);
  const nodeId = text(item.nodeId);
  const arrivalNodeIds = optional(item.arrivalNodeIds, (value) => array(value, text));
  if (arrivalNodeIds) {
    uniqueIds(arrivalNodeIds, (id) => id);
    if (!arrivalNodeIds.includes(nodeId) || arrivalNodeIds.length > 16) invalidVenueData();
  }
  return {
    id: text(item.id), name: text(item.name), ref: optional(item.ref, text),
    kind: choice(item.kind, ['room', 'amenity', 'parking', 'entrance', 'gate', 'anchor', 'poi']),
    buildingId: nullableText(item.buildingId), levelRef: nullableText(item.levelRef), nodeId, arrivalNodeIds,
    location: point(item.location), featureId: optional(item.featureId, nullableText),
    arrivalKind: optional(item.arrivalKind, (value) => nullable(value, (value) => choice(value, ['door', 'corridor', 'place']))),
    doorKnown: optional(item.doorKnown, (value) => nullable(value, boolean)),
    connectionId: optional(item.connectionId, nullableText),
    connectionIds: optional(item.connectionIds, (value) => array(value, text)),
    wheelchair: optional(item.wheelchair, wheelchair), accessibleSpaces: optional(item.accessibleSpaces, integer),
  };
}
function parseGeometry(value: unknown): VenueFeature['geometry'] {
  const item = record(value);
  if (item.type === 'Point') return { type: 'Point', coordinates: point(item.coordinates) };
  if (item.type === 'Polygon') return { type: 'Polygon', coordinates: rings(item.coordinates) };
  return invalidVenueData();
}
function parseFeature(value: unknown): VenueFeature {
  const item = record(value);
  return {
    ...annotations(item), id: text(item.id), kind: choice(item.kind, ['room', 'corridor', 'area', 'door', 'elevator', 'stairs']),
    buildingId: nullableText(item.buildingId), levelRef: nullableText(item.levelRef), ordinal: nullable(item.ordinal, integer),
    name: optional(item.name, text), ref: optional(item.ref, text), geometry: parseGeometry(item.geometry),
    connectionId: optional(item.connectionId, nullableText), connectionIds: optional(item.connectionIds, (value) => array(value, text)),
    tags: optional(item.tags, (value) => {
      const tags = record(value);
      return { indoor: optional(tags.indoor, text), amenity: optional(tags.amenity, text), 'a11ymap:area_type': optional(tags['a11ymap:area_type'], text), ref: optional(tags.ref, text), wheelchair: optional(tags.wheelchair, wheelchair) };
    }),
  };
}
function parseWall(value: unknown): VenueWall {
  const item = record(value);
  const geometry = record(item.geometry);
  const coordinates = array(geometry.coordinates, point);
  if (geometry.type !== 'LineString' || coordinates.length < 2) invalidVenueData();
  const thicknessM = optional(item.thicknessM, (value) => nullable(value, number));
  if (thicknessM != null && thicknessM <= 0) invalidVenueData();
  return {
    ...annotations(item), id: text(item.id), buildingId: nullableText(item.buildingId), levelRef: nullableText(item.levelRef),
    ordinal: nullable(item.ordinal, integer), thicknessM, geometry: { type: 'LineString', coordinates },
  };
}
function parseWalkway(value: unknown): VenueWalkway {
  const item = record(value);
  return {
    ...annotations(item), id: text(item.id), kind: choice(item.kind, ['corridor', 'footway', 'path', 'pedestrian', 'service', 'crossing']),
    indoor: boolean(item.indoor), coordinates: pair(item.coordinates, point3),
    nodeIds: optional(item.nodeIds, (value) => pair(value, text)),
    buildingId: nullableText(item.buildingId), levelRef: nullableText(item.levelRef),
    buildingIds: pair(item.buildingIds, nullableText), levelRefs: pair(item.levelRefs, nullableText),
    wheelchair: wheelchair(item.wheelchair), osmRef: text(item.osmRef),
  };
}
function parseConnection(value: unknown): VenueConnection {
  const item = record(value);
  const coordinates = array(item.coordinates, point3);
  const levelRefs = array(item.levelRefs, nullableText);
  const nodeIds = optional(item.nodeIds, (value) => array(value, text));
  if (coordinates.length < 2 || coordinates.length !== levelRefs.length || (nodeIds && nodeIds.length !== coordinates.length)) invalidVenueData();
  return {
    ...annotations(item), id: text(item.id), kind: choice(item.kind, ['stairs', 'steps', 'ramp', 'escalator', 'elevator']),
    buildingId: nullableText(item.buildingId), coordinates, levelRefs, nodeIds,
    wheelchair: wheelchair(item.wheelchair), osmRef: text(item.osmRef),
    slopeRatio: optional(item.slopeRatio, number), stepCount: optional(item.stepCount, integer),
    name: optional(item.name, nullableText), ref: optional(item.ref, nullableText),
    featureIds: optional(item.featureIds, (value) => array(value, text)),
  };
}
export function parseVenueSummaries(value: unknown): VenueSummary[] {
  const venues = array(value, (value): VenueSummary => {
    const item = record(value);
    const buildings = array(item.buildings, (value) => {
      const building = record(value);
      return { id: text(building.id), name: text(building.name) };
    });
    uniqueIds(buildings, (building) => building.id);
    return { venueId: text(item.venueId), name: text(item.name), center: point(item.center), version: version(item.version), importedAt: text(item.importedAt), buildings };
  });
  uniqueIds(venues, (venue) => venue.venueId);
  return venues;
}

/** 只在 API 邊界建立可信型別；資料有缺口時不猜測幾何或導引連線。 */
export function parseVenueDetail(value: unknown): VenueDetail {
  const item = record(value);
  const detail: VenueDetail = {
    venueId: text(item.venueId), name: text(item.name), version: version(item.version), importedAt: text(item.importedAt),
    center: point(item.center), sourceSha256: nullableText(item.sourceSha256),
    buildings: array(item.buildings, parseBuilding), places: array(item.places, parsePlace),
    features: array(item.features, parseFeature), walls: item.walls === undefined ? [] : array(item.walls, parseWall),
    walkways: array(item.walkways, parseWalkway), connections: array(item.connections, parseConnection),
  };
  for (const items of [detail.buildings, detail.places, detail.features, detail.walls, detail.walkways, detail.connections]) uniqueIds<{ id: string }>(items, (item) => item.id);
  const buildingLevels = new Map(detail.buildings.map((building) => [building.id, new Set(building.levels.map((level) => level.ref))]));
  const checkContext = (buildingId: string | null, levelRef: string | null) => {
    if (buildingId === null) return;
    const levels = buildingLevels.get(buildingId);
    if (!levels || (levelRef !== null && !levels.has(levelRef))) invalidVenueData();
  };
  for (const item of [...detail.places, ...detail.features, ...detail.walls]) checkContext(item.buildingId, item.levelRef);
  for (const walkway of detail.walkways) {
    checkContext(walkway.buildingId, walkway.levelRef);
    walkway.buildingIds.forEach((buildingId, index) => checkContext(buildingId, walkway.levelRefs[index]));
  }
  for (const connection of detail.connections) connection.levelRefs.forEach((levelRef) => checkContext(connection.buildingId, levelRef));
  return detail;
}
