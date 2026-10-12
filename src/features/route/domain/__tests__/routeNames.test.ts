import { legChainSegments, routeSummary, walkStepText } from '../routeCard';
import { presentRouteNames, recordRouteNameLanguage, walkStreetNames } from '../routeNames';
import type { AccessibleRoute, BusLeg, MetroLeg, TraLeg, WalkLeg, WalkStep } from '../../types/route';

const bus: BusLeg = {
  type: 'BUS', routeName: '幹線', routeNameEn: 'Main Line', routeDisplayName: '舊幹線',
  departureStop: '甲', arrivalStop: '乙', fromNameEn: 'A', toNameEn: 'B',
  fromDisplayName: '舊甲', toDisplayName: '舊乙', departureStopId: 'id-a', arrivalStopId: 'id-b',
  waitInfo: { time: null, source: 'unavailable' }, estimatedWaitMinutes: 0, direction: 0,
  polyline: [[121, 25]], departureStopA11y: [], arrivalStopA11y: [],
  intermediateStops: [{ name: '中間', nameEn: 'Middle', displayName: '舊中間', stationUid: 'middle-id' }],
};
const metro: MetroLeg = {
  type: 'METRO', railSystem: 'TRTC', lineId: 'BL', lineUid: 'line-id', lineName: '板南線',
  routeDisplayName: 'Bannan Line', departureStation: '甲', arrivalStation: '乙',
  departureStationUid: 'a', arrivalStationUid: 'b', direction: 0, stopsCount: 1, rideMinutes: 1,
  waitInfo: { time: 0, source: 'schedule' }, estimatedWaitMinutes: 0, polyline: [],
  departureStationA11y: [], arrivalStationA11y: [], facilityHighlights: [],
};
const tra: TraLeg = {
  type: 'TRA', trainNo: '123', trainTypeName: '自強', routeDisplayName: 'Tze-Chiang',
  departureStation: '甲', arrivalStation: '乙', departureStationUID: 'a', arrivalStationUID: 'b',
  departureTime: '10:00', arrivalTime: '10:10', rideMinutes: 10,
  waitInfo: { time: 0, source: 'schedule' }, estimatedWaitMinutes: 0, polyline: [],
  departureStationA11y: [], arrivalStationA11y: [], facilityHighlights: [],
};
const step: WalkStep = {
  relativeDirection: 'CONTINUE', absoluteDirection: null, streetName: '同名路', bogusName: false,
  area: false, stairs: false, steepSlope: false, distanceM: 20, location: [121, 25],
};
const walk: WalkLeg = {
  type: 'WALK', from: '甲', to: '乙', distanceM: 20, minutesEst: 1, polyline: [], a11yFacilities: [],
  steps: [step, { ...step, distanceM: 30 }], stepStreetNames: [
    { index: 0, streetName: '同名路', nameEn: 'First Road', displayName: '舊路名' },
    { index: 1, streetName: '同名路', nameEn: 'Second Road', displayName: '舊路名' },
  ],
};
function route(): AccessibleRoute {
  return { routeId: 'r', navigationId: 'n', routeVersion: 2, routeToken: 'token', routeName: '路線',
    totalMinutes: 10, transferCount: 0, accessibilityHighlights: [], legs: [{ ...bus }, { ...metro }, { ...tra }, { ...walk }],
    facilities: { 'facility-id': { osmId: 'osm-id', name: '廁所', nameEn: 'Toilet', displayName: '舊廁所',
      category: 'toilet', location: { type: 'Point', coordinates: [121, 25] } } } };
}

it('summary and chain use nonempty display for BUS/METRO and routeDisplayName for TRA', () => {
  expect(routeSummary([bus, metro, tra], (key) => key)).toBe('舊幹線 → Bannan Line → Tze-Chiang123');
  expect(legChainSegments([bus, metro, tra]).map((item) => item.label)).toEqual(['舊幹線', 'Bannan Line', '123']);
  expect(routeSummary([{ ...bus, routeDisplayName: ' ' }, { ...metro, routeDisplayName: '' },
    { ...tra, routeDisplayName: ' ' }], (key) => key)).toBe('幹線 → 板南線 → 自強123');
});

it('switches old zh display to source English and back without identity, geometry or DTO mutation', () => {
  const original = route();
  const snapshot = JSON.stringify(original);
  recordRouteNameLanguage(original, 'zh-TW');
  const en = presentRouteNames(original, 'en');
  expect(en.legs[0]).toMatchObject({ routeName: '幹線', routeDisplayName: 'Main Line', fromDisplayName: 'A',
    toDisplayName: 'B', departureStopId: 'id-a', intermediateStops: [{ stationUid: 'middle-id', displayName: 'Middle' }] });
  expect(en.facilities?.['facility-id']).toMatchObject({ osmId: 'osm-id', displayName: 'Toilet' });
  expect(en.routeToken).toBe(original.routeToken);
  expect(en.navigationId).toBe(original.navigationId);
  expect(en.routeVersion).toBe(original.routeVersion);
  expect(en.legs[0].polyline).toBe(original.legs[0].polyline);
  expect(presentRouteNames(original, 'zh-TW').legs[0]).toMatchObject({ routeDisplayName: '舊幹線' });
  expect(JSON.stringify(original)).toBe(snapshot);
});

it('does not infer display language without provenance and reprojects English routes into canonical Chinese', () => {
  expect(presentRouteNames(route(), 'en').legs[0]).toMatchObject({ routeDisplayName: 'Main Line' });
  expect(presentRouteNames(route(), 'zh-TW').legs[0]).toMatchObject({ routeDisplayName: '幹線' });
  const original = route();
  original.legs[0] = { ...bus, routeDisplayName: 'Display English' };
  recordRouteNameLanguage(original, 'en');
  expect(presentRouteNames(original, 'en').legs[0]).toMatchObject({ routeDisplayName: 'Display English' });
  expect(presentRouteNames(original, 'zh-TW').legs[0]).toMatchObject({ routeDisplayName: '幹線' });
});

it('pairs same-named streets by original index before filtering, preserving WALK nine fields', () => {
  const snapshot = JSON.stringify(walk);
  const names = walkStreetNames(walk, 'en');
  expect(names).toEqual(['First Road', 'Second Road']);
  const paired = walk.steps!.map((item, index) => ({ item, name: names[index] })).filter(({ item }) => item.distanceM > 20);
  expect(walkStepText(paired[0].item, (_key, options) => String(options?.street ?? ''), paired[0].name)).toBe('Second Road');
  expect(walkStreetNames(walk, 'zh-TW')).toEqual(['同名路', '同名路']);
  expect(Object.keys(step)).toHaveLength(9);
  expect(JSON.stringify(walk)).toBe(snapshot);
});

it.each([
  [{ index: 0, streetName: '同名路', nameEn: 'A' }, { index: 0, streetName: '同名路', nameEn: 'B' }],
  [{ index: 2, streetName: '同名路', nameEn: 'A' }],
  [{ index: -1, streetName: '同名路', nameEn: 'A' }],
  [{ index: 0.5, streetName: '同名路', nameEn: 'A' }],
  [{ index: 0, streetName: '不同路', nameEn: 'A' }],
  [{ index: 0, streetName: '同名路', nameEn: ' ', displayName: 'Stale' }],
  [],
])('rejects invalid sidecar %#', (...entries) => {
  expect(walkStreetNames({ ...walk, stepStreetNames: entries }, 'en')).toEqual(['同名路', '同名路']);
});

it('keeps canonical text without source English and supports English-only names', () => {
  const original = route();
  original.legs[0] = { ...bus, routeName: '', routeNameEn: 'English-only', routeDisplayName: '' };
  const english = presentRouteNames(original, 'en');
  expect(english.legs[0]).toMatchObject({ routeName: '', routeDisplayName: 'English-only' });
  expect(english.legs[1]).toMatchObject({ lineName: '板南線', routeDisplayName: '板南線' });
});
