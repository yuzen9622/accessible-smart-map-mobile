import en from '@/shared/i18n/locale/en/translation.json';
import { getLatLng, isOk } from '../aiResults';
import { getAggregatedToolResults, getToolResultGroup } from '../toolResultCards';
import { mapToolToActions } from '../toolActionMapper';
import { KNOWN_TOOL_NAMES, toolDoneLabel, toolLoadingLabel } from '../toolLabels';
import { t } from '../testing/translate';

const location = { type: 'Point', coordinates: [121.53, 25.03] };
const campus = { campusId: 9, schoolName: '大學', branchName: '本部', address: '校路1號', location, facilityCount: 2 };
const fixtures = [
  ['findCampusAccessibility', { campuses: [campus], page: 2, totalPages: 3, totalCount: 12 }, '大學'],
  ['getCampusAccessibilityDetails', { campus, facilities: [{ facUid: 'lift', name: '電梯', building: '教學樓', floors: ['1', '2'], specs: [{ label: '寬', value: '90cm' }], location }], totalMatchedFacilities: 40, truncated: true }, '電梯'],
  ['getBusArrival', { routeName: '307', stopName: '市府', arrivals: [{ subRouteUid: 'a', stopName: '市府', direction: 0, directionLabel: '去程', estimateMinutes: 3, statusLabel: '即將進站', plateNumb: 'BUS-1' }] }, '市府'],
  ['findNearbyBusStops', { stops: [{ stopUid: 's', stopName: '市府', coordinates: [121.53, 25.03], distance: 10, routes: ['307'] }] }, '市府'],
  ['getTrainTimetable', { date: '2026-10-21', railSystem: 'TRA', origin: { name: '臺北' }, destination: { name: '臺中' }, trains: [{ trainNo: '123', trainType: '自強', departureTime: '10:00', arrivalTime: '12:00', durationMinutes: 120 }] }, '123'],
  ['getStationTimetable', { date: '2026-10-21', station: { name: '臺北' }, trains: [{ trainNo: '456', destination: '臺中', departureTime: '11:00' }] }, '456'],
  ['getMetroAlerts', { alerts: [{ railSystem: 'TRTC', updatedAt: '10:00', alerts: [{ alertId: 'a', title: '電梯停用', description: '市府站施工', stations: [{ name: '市府' }] }] }] }, '電梯停用'],
  ['getTransitAlerts', { summary: '發現1則', alerts: [{ alertId: 'b', title: '改道', description: '307改走校路', alertUrl: 'https://example.org/alert' }] }, '改道'],
  ['searchAccessibilityGuide', { results: [{ title: '搭車指南', content: '完整內容'.repeat(100), source: 'https://example.org/guide', category: '交通' }] }, '搭車指南'],
  ['webSearch', { answer: '完整答案'.repeat(100), sources: [{ title: '官方來源', url: 'https://example.org/source', domain: 'example.org' }] }, '官方來源'],
] as const;

it.each(fixtures)('renders backend %s DTO as readable cards', (name, result, title) => {
  const group = getToolResultGroup(name, { ok: true, ...result }, t);
  expect(group).not.toBeNull();
  expect(JSON.stringify(group)).toContain(title);
});

it('preserves guide content and web answer, allowing only HTTP(S) source actions', () => {
  const guide = getToolResultGroup('searchAccessibilityGuide', { ok: true, results: [{ title: '指南', content: '全文'.repeat(500), source: 'https://example.org' }] }, t)!;
  expect(guide.items[0]).toMatchObject({ subtitle: '全文'.repeat(500), url: 'https://example.org' });
  const web = getToolResultGroup('webSearch', { ok: true, answer: '答案'.repeat(500), sources: [{ title: 'bad', url: 'javascript:alert(1)' }] }, t)!;
  expect(web.note).toBe('答案'.repeat(500));
  expect(web.items[0].url).toBeUndefined();
});

it('shows campus pagination, detail truncation and specs', () => {
  const listing = getToolResultGroup('findCampusAccessibility', { ok: true, ...fixtures[0][1] }, t)!;
  expect(listing.note).toContain('2');
  expect(listing.note).toContain('3');
  const details = getToolResultGroup('getCampusAccessibilityDetails', { ok: true, ...fixtures[1][1] }, t)!;
  expect(details.note).toContain('40');
  expect(JSON.stringify(details)).toContain('90cm');
});

it('counts returned campus facilities separately from the campus location card', () => {
  const result = { ok: true, campus, facilities: [{ facUid: 'one', name: '電梯', location }], truncated: true };
  const group = getToolResultGroup('getCampusAccessibilityDetails', result, t)!;
  expect(group.note).toContain('共 1 項設施');
  expect(group.note).toContain('僅顯示前 1 項結果');
  expect(group.items[0].id).toBe('campus_9');
});

it('includes government road events and all detail tags', () => {
  const hazards = getToolResultGroup('getNearbyHazards', { ok: true, data: { reports: [], roadEvents: [{ title: '道路封閉', description: '施工', source: 'government', location: { lat: 25.03, lng: 121.53 } }] } }, t)!;
  expect(hazards.items[0]).toMatchObject({ title: '道路封閉', position: { lat: 25.03, lng: 121.53 } });
  expect(hazards.items[0].subtitle).toContain('government');
  const details = getToolResultGroup('getA11yFacilityDetails', { ok: true, facilities: [{ osmId: '1', name: '電梯', location, tags: { width: '90', opening_hours: '24/7' } }] }, t)!;
  expect(details.items[0].subtitle).toContain('width: 90');
  expect(details.items[0].subtitle).toContain('24/7');
});

const schedules = [{ direction: 0, directionLabel: '去程', first: '06:00', last: '23:00', frequencies: [{ scheduleType: 'trip', serviceDays: '平日', originStopName: '總站', originDepartureTime: '07:30' }, { scheduleType: 'headway', serviceDays: '假日', start: '08:00', end: '10:00', minHeadwayMins: 10, maxHeadwayMins: 20 }] }];
it('keeps direction-specific stop IDs, minute ETA and published schedule semantics', () => {
  const group = getToolResultGroup('getBusRouteDetail', { ok: true, routeName: '307', schedules, directions: [0, 1].map((direction) => ({ direction, subRouteUid: `r${direction}`, to: '市府', stops: [{ stopUid: 's', seq: 1, name: '市府', estimateMinutes: 4, statusLabel: '正常' }] })) }, t)!;
  expect(new Set(group.items.map((item) => item.id)).size).toBe(group.items.length);
  const serialized = JSON.stringify(group);
  for (const text of ['4', '07:30', '總站', '06:00', '23:00', '10', '20']) expect(serialized).toContain(text);
  expect(JSON.stringify(getToolResultGroup('getBusTimetable', { ok: true, schedules, note: '僅起站發車時間' }, t))).toContain('07:30');
});

it.each([{ ok: false }, { ok: true, error: 'failed' }, { status: 'ERROR' }, { status: 503 }])('rejects result failures %p', (failure) => {
  expect(isOk(failure)).toBe(false);
  expect(getToolResultGroup('findCampusAccessibility', { ...fixtures[0][1], ...failure }, t)).toBeNull();
  expect(mapToolToActions('findGooglePlaces', { places: [{ name: 'bad', location: { lat: 25, lng: 121 } }], ...failure }, null, t)).toEqual([]);
});

it.each(['findNearbyParking', 'findNearbyBusStops', 'trackBuses', 'findCampusAccessibility', 'getCampusAccessibilityDetails', 'getA11yFacilityDetails', 'getNearbyHazards'])('maps %s snapshot positions without empty-map updates', (name) => {
  const results: Record<string, unknown> = {
    findNearbyParking: { parkingSpots: [{ name: '停車場', location }] },
    findNearbyBusStops: fixtures[3][1],
    trackBuses: { buses: [{ plateNumb: 'BUS-1', lat: 25.03, lng: 121.53 }] },
    findCampusAccessibility: fixtures[0][1],
    getCampusAccessibilityDetails: fixtures[1][1],
    getA11yFacilityDetails: { facilities: [{ osmId: '1', name: '電梯', location }] },
    getNearbyHazards: { data: { reports: [], roadEvents: [{ title: '施工', location }] } },
  };
  const actions = mapToolToActions(name, { ok: true, ...(results[name] as object) }, null, t);
  expect(actions[0]).toMatchObject({ type: 'show-markers', markers: expect.arrayContaining([expect.objectContaining({ kind: 'facility', position: { lat: 25.03, lng: 121.53 } })]) });
  expect(mapToolToActions(name, { ok: true }, null, t)).toEqual([]);
  expect(mapToolToActions(name, { ok: false, ...(results[name] as object) }, null, t)).toEqual([]);
});

const controls = ['proposeNavigationCandidate', 'confirmNavigationCandidateSwitch', 'startNavigation', 'stopNavigation', 'repeatNavStep', 'getActiveNavigationContext', 'endVoiceSession'];
it.each(controls)('labels %s without changing route ownership', (name) => {
  expect(KNOWN_TOOL_NAMES).toContain(name);
  expect(toolLoadingLabel(name, t)).not.toContain(name);
  expect(toolDoneLabel(name, t)).not.toContain(name);
  expect(en).toHaveProperty(`nativeAiToolDone_${name}`, expect.any(String));
  expect(en).toHaveProperty(`nativeAiToolLoading_${name}`, expect.any(String));
  expect(mapToolToActions(name, { ok: true }, null, t)).toEqual([]);
});

it.each([NaN, Infinity, -Infinity, 999])('rejects non-map coordinates %s without clearing existing results', (lat) => {
  expect(getLatLng({ lat, lng: 121 })).toBeNull();
  expect(mapToolToActions('trackBuses', { ok: true, buses: [{ lat, lng: 121 }] }, null, t)).toEqual([]);
});
it.each([{ ok: true }, { status: 'OK' }, { status: 200 }, { status: 'success', error: null }])('accepts successful status %p', (result) => {
  expect(isOk(result)).toBe(true);
});
it.each(['findGooglePlaces', 'findA11yPlaces'])('does not clear markers on empty %s', (name) => {
  expect(mapToolToActions(name, { ok: true }, null, t)).toEqual([]);
});

it.each([
  ['trackBuses', { buses: [{ plateNumb: 'A', lat: 25, lng: 121 }, { plateNumb: 'B', lat: 25.1, lng: 121 }] }, { buses: [{ plateNumb: 'A', lat: 26, lng: 121 }] }, '26'],
  ['getBusArrival', { arrivals: [{ subRouteUid: 'r', direction: 0, stopName: '市府', estimateMinutes: 9 }] }, { arrivals: [{ subRouteUid: 'r', direction: 0, stopName: '市府', estimateMinutes: 2 }] }, '2'],
  ['getAirQuality', { pm25: 50, advice: '舊建議' }, { pm25: 10, advice: '新建議' }, '10'],
] as const)('replaces repeated %s IDs with the latest content without reordering', (name, before, after, latest) => {
  const first = getToolResultGroup(name, { ok: true, ...before }, t)!;
  const groups = getAggregatedToolResults([before, after].map((result) => ({ name, result: { ok: true, ...result } })), t);
  expect(groups[0].items.map((item) => item.id)).toEqual(first.items.map((item) => item.id));
  expect(JSON.stringify(groups[0].items[0])).toContain(latest);
  expect(groups[0].items[0]).toEqual(getToolResultGroup(name, { ok: true, ...after }, t)!.items[0]);
  if (name === 'getAirQuality') expect(groups[0].note).toBe('新建議');
});

it.each(fixtures)('uses existing done status instead of an extra empty card for %s', (name) => {
  const groups = getAggregatedToolResults([{ name, result: { ok: true } }], t);
  expect(groups).toEqual([]);
  expect(toolDoneLabel(name, t)).not.toBe('');
  expect(toolDoneLabel(name, t)).not.toContain(name);
  expect(mapToolToActions(name, { ok: true }, null, t)).toEqual([]);
});

it('retains all returned campuses for UI pagination and keeps the backend page total', () => {
  const groups = getAggregatedToolResults([{ name: 'findCampusAccessibility', result: { ok: true, campuses: Array.from({ length: 20 }, (_, i) => ({ ...campus, campusId: i })), page: 1, totalPages: 2, totalCount: 40 } }], t);
  expect(groups[0].items).toHaveLength(20);
  expect(groups[0].items.at(-1)?.id).toBe('campus_19');
  expect(groups[0].note).toContain('40');
});
