import { fireEvent, render, screen } from '@testing-library/react-native';

import { recordRouteNameLanguage, type AccessibleRoute, type BusDepartureCandidate, type BusLeg } from '@/features/route/domain';

import { busLegKey, useBusStore } from '../../store/busStore';
import type { RouteDetailDirection } from '../../types/transit';
import BusLegStops from '../BusLegStops';

let mockRefreshed: BusDepartureCandidate[] | undefined;
let mockDirections: RouteDetailDirection[] | null = null;
/** 查看別班時的公開 route-detail（publicFeed）。 */
let mockOther: { directions: RouteDetailDirection[] | null; status: 'idle' | 'loading' | 'ready' | 'error' } = { directions: null, status: 'loading' };
const mockSelection = jest.fn();

jest.mock('@/shared/i18n', () => ({
  getAppLanguage: () => 'zh-TW',
  useAppTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key}:${JSON.stringify(options)}` : key),
  }),
}));
jest.mock('../../hooks/useBusLegStopEtas', () => ({
  useBusLegStopEtas: (_leg: unknown, enabled: boolean, _poll: boolean, publicFeed?: boolean) =>
    publicFeed ? (enabled ? mockOther : { directions: null, status: 'idle' }) : { directions: mockDirections, status: 'ready', candidates: mockRefreshed },
}));
jest.mock('expo-haptics', () => ({ selectionAsync: () => mockSelection() }));

const NOW = Date.parse('2026-10-22T17:22:51+08:00');

function candidate(overrides: Partial<BusDepartureCandidate>): BusDepartureCandidate {
  return {
    candidateId: 'TXG5|1|600-U8|1792661451000',
    routeName: '5',
    subRouteUid: 'TXG5',
    direction: 1,
    departureStopId: 'TXG824',
    arrivalStopId: 'TXG2246',
    plateNumb: '600-U8',
    estimatedWaitMinutes: 8,
    boardingTime: '2026-10-22T17:30:51.000+08:00',
    alightingTime: '2026-10-22T17:35:51.000+08:00',
    boardingTimeSource: 'realtime',
    alightingTimeSource: 'realtime',
    vehicleAccessibility: 'unknown',
    hasLiftOrRamp: null,
    selected: true,
    ...overrides,
  };
}

const planned = candidate({});
const other = candidate({
  candidateId: 'TXG108|0|KKA-6317|1792661571000',
  routeName: '108',
  subRouteUid: 'TXG108',
  plateNumb: 'KKA-6317',
  boardingTime: '2026-10-22T17:32:51.000+08:00',
  alightingTime: '2026-10-22T17:37:51.000+08:00',
  vehicleAccessibility: 'low_floor',
  selected: false,
});
const timetable = candidate({
  candidateId: 'TXG300|0|trip|1792661940000',
  routeName: '300',
  plateNumb: undefined,
  tripId: 'trip',
  boardingTime: '2026-10-22T17:39:00.000+08:00',
  alightingTime: '2026-10-22T17:42:00.000+08:00',
  boardingTimeSource: 'schedule',
  alightingTimeSource: 'schedule',
  selected: false,
});

function fixture(candidates?: BusDepartureCandidate[]): { route: AccessibleRoute; leg: BusLeg } {
  const leg: BusLeg = {
    type: 'BUS', routeName: '5', departureStop: '國立臺中科技大學', arrivalStop: '第二市場(三民路)',
    departureTime: '17:30', arrivalTime: '17:35',
    intermediateStops: [{ name: '中間站', stationUid: 'S1' }],
    direction: 1, estimatedWaitMinutes: 1, waitInfo: { time: 1, source: 'realtime' },
    polyline: [], departureStopA11y: [], arrivalStopA11y: [],
    departureCandidates: candidates,
  };
  const route: AccessibleRoute = {
    routeId: 'route', routeToken: 'token', routeName: '5', totalMinutes: 15,
    transferCount: 0, accessibilityHighlights: [], legs: [leg],
  };
  recordRouteNameLanguage(route, 'zh-TW');
  return { route, leg };
}

const renderLeg = ({ route, leg }: { route: AccessibleRoute; leg: BusLeg }) =>
  render(<BusLegStops route={route} routeIndex={0} legIndex={0} leg={leg} />);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  mockRefreshed = undefined;
  mockDirections = null;
  mockOther = { directions: null, status: 'loading' };
  mockSelection.mockClear();
  useBusStore.setState({ activeBusLeg: null, liveBusPositions: [] });
});

afterEach(() => jest.useRealTimers());

it('lists every departure and times the board/alight rows by the planned bus', async () => {
  await renderLeg(fixture([planned, other, timetable]));
  const tiles = screen.getAllByRole('radio');
  expect(tiles).toHaveLength(3);
  expect(tiles[0].props.accessibilityState).toMatchObject({ checked: true });
  expect(screen.getAllByText('nativeBusDepartureMinutes:{"count":8}').length).toBeGreaterThan(0);
  expect(screen.getByText('17:39')).toBeTruthy();
  expect(screen.getByText('nativeBusDepartureScheduled')).toBeTruthy();
  // 即時班次的上車列只放即時徽章，不同時列出時刻
  expect(screen.getByLabelText('board 國立臺中科技大學 nativeBusDepartureMinutes:{"count":8}')).toBeTruthy();
  expect(screen.getByLabelText('alight 第二市場(三民路) nativeBusDepartureMinutes:{"count":13}')).toBeTruthy();
});

it('views another bus without touching the planned leg, and returns by tapping the planned tile', async () => {
  const data = fixture([planned, other, timetable]);
  const before = JSON.stringify(data.route);
  await renderLeg(data);

  await fireEvent.press(screen.getAllByRole('radio')[1]);
  expect(mockSelection).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole('radio')[1].props.accessibilityState).toMatchObject({ checked: true });
  expect(screen.getByLabelText('board 國立臺中科技大學 nativeBusDepartureMinutes:{"count":10}')).toBeTruthy();
  expect(screen.getByLabelText('alight 第二市場(三民路) nativeBusDepartureMinutes:{"count":15}')).toBeTruthy();
  // 中途站序屬於規劃的路線，查看別班時收起
  // 那班的站序還在載入；規劃那班的站序不拿來冒充
  expect(screen.getByText('nativeBusViewedStopsLoading')).toBeTruthy();
  expect(screen.queryByText(/passStops/)).toBeNull();
  expect(JSON.stringify(data.route)).toBe(before);

  // 點回導航採用的那張就回到規劃班次
  await fireEvent.press(screen.getAllByRole('radio')[0]);
  expect(screen.getAllByRole('radio')[0].props.accessibilityState).toMatchObject({ checked: true });
  expect(screen.getByLabelText('board 國立臺中科技大學 nativeBusDepartureMinutes:{"count":8}')).toBeTruthy();
  expect(screen.queryByText('nativeBusViewedStopsLoading')).toBeNull();
});

it('keeps following the viewed bus after a refresh moves its ETA', async () => {
  const data = fixture([planned, other]);
  const view = await renderLeg(data);
  await fireEvent.press(screen.getAllByRole('radio')[1]);

  mockRefreshed = [planned, { ...other, candidateId: 'TXG108|0|KKA-6317|1792661691000', boardingTime: '2026-10-22T17:34:51.000+08:00' }];
  await view.rerender(<BusLegStops route={data.route} routeIndex={0} legIndex={0} leg={data.leg} />);
  expect(screen.getAllByRole('radio')[1].props.accessibilityState).toMatchObject({ checked: true });
  expect(screen.getByLabelText('board 國立臺中科技大學 nativeBusDepartureMinutes:{"count":12}')).toBeTruthy();
});

it('falls back to the plain route badge when the backend sent no candidates', async () => {
  await renderLeg(fixture(undefined));
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
  expect(screen.getByText('5')).toBeTruthy();
  expect(screen.getByText('passStops:{"count":1}')).toBeTruthy();
});

it('stops live-tracking the planned bus on the map while another bus is viewed', async () => {
  const data = fixture([planned, other]);
  useBusStore.setState({ activeBusLeg: { key: busLegKey(data.route, 0, 0, { ...data.leg, planContext: { routeToken: 'token', legIndex: 0 } }), route: data.route, leg: data.leg } });
  await renderLeg(data);
  expect(useBusStore.getState().activeBusLeg).not.toBeNull();
  await fireEvent.press(screen.getAllByRole('radio')[1]);
  expect(useBusStore.getState().activeBusLeg).toBeNull();
});

it('keeps the planned bus extras (nearest bus) when the plan is being viewed', async () => {
  const data = fixture([planned, other]);
  data.leg.nearestBus = { plateNumb: '600-U8', stopsAway: 3 } as BusLeg['nearestBus'];
  await renderLeg(data);
  expect(screen.getByText('nearestBusStopsAway:{"count":3}')).toBeTruthy();
  await fireEvent.press(screen.getAllByRole('radio')[1]);
  expect(screen.queryByText(/nearestBusStopsAway/)).toBeNull();
});

it('shows a timetable bus by its clock alone and never pairs a clock with a live badge', async () => {
  await renderLeg(fixture([{ ...timetable, selected: true }, { ...planned, selected: false }]));
  expect(screen.getByLabelText('board 國立臺中科技大學 busPlannedAt:{"time":"17:39"}')).toBeTruthy();
  expect(screen.getByLabelText('alight 第二市場(三民路) busPlannedAt:{"time":"17:42"}')).toBeTruthy();
});

it('counts the stops from the live stop list even when the plan sent none, before expanding', async () => {
  const data = fixture([planned, other]);
  data.leg.intermediateStops = undefined;
  const names = ['國立臺中科技大學', '中站一', '中站二', '第二市場(三民路)'];
  mockDirections = [{
    direction: 1,
    stops: names.map((name, index) => ({ seq: index + 1, name, lat: 24.15, lng: 120.68 + index * 0.001, estimateMinutes: null, statusLabel: '' })),
  }];
  await renderLeg(data);
  expect(screen.getByText('passStops:{"count":2}')).toBeTruthy();
  await fireEvent.press(screen.getByText('passStops:{"count":2}'));
  expect(screen.getByText('中站一')).toBeTruthy();
  expect(screen.getByText('中站二')).toBeTruthy();
});

it('slices the stop list by the ride the backend re-selected on refresh', async () => {
  const data = fixture([planned, other]);
  data.leg.subRouteUid = 'TXG5';
  data.leg.intermediateStops = undefined;
  const names = ['國立臺中科技大學', '中興堂', '干城站', '第二市場(三民路)'];
  mockDirections = [{
    direction: 0,
    subRouteUid: 'TXG108',
    stops: names.map((name, index) => ({ seq: index + 1, name, lat: 24.15, lng: 120.68 + index * 0.001, estimateMinutes: null, statusLabel: '' })),
  }];
  mockRefreshed = [{ ...planned, selected: false }, { ...other, selected: true }];
  await renderLeg(data);
  expect(screen.getByText('passStops:{"count":2}')).toBeTruthy();
});

it("lists the viewed bus's own stops and draws its geometry on the map until the plan is back", async () => {
  const data = fixture([planned, other]);
  const onPreviewGeometry = jest.fn();
  const names: [string, string, number][] = [['X', '前一站', 120.679], ['TXG7354', '國立臺中科技大學', 120.68], ['S1', '一零八中途站', 120.681], ['TXG2946', '第二市場(臺灣大道)', 120.682]];
  mockOther = {
    status: 'ready',
    directions: [{
      direction: 0,
      subRouteUid: 'TXG108',
      stops: names.map(([stopUid, name, lng], index) => ({ seq: index + 1, stopUid, name, lat: 24.15, lng, estimateMinutes: 12, statusLabel: '' })),
      polyline: [[120.679, 24.15], [120.6805, 24.15], [120.682, 24.15]],
    }],
  };
  const otherBus = { ...other, departureStopId: 'TXG7354', arrivalStopId: 'TXG2946', direction: 0 as const };
  data.leg.departureCandidates = [planned, otherBus];
  await render(<BusLegStops route={data.route} routeIndex={0} legIndex={0} leg={data.leg} onPreviewGeometry={onPreviewGeometry} />);
  expect(onPreviewGeometry).not.toHaveBeenCalled();

  await fireEvent.press(screen.getAllByRole('radio')[1]);
  expect(screen.getByText('第二市場(臺灣大道)')).toBeTruthy();
  await fireEvent.press(screen.getByText('passStops:{"count":1}'));
  expect(screen.getByText('一零八中途站')).toBeTruthy();
  const polyline = onPreviewGeometry.mock.calls.at(-1)?.[0] as [number, number][];
  expect(polyline[0][0]).toBeCloseTo(120.68, 6);
  expect(polyline.at(-1)?.[0]).toBeCloseTo(120.682, 6);

  await fireEvent.press(screen.getAllByRole('radio')[0]);
  expect(onPreviewGeometry).toHaveBeenLastCalledWith(null);
  expect(screen.queryByText('一零八中途站')).toBeNull();
});

it('says so when the viewed bus has no usable stop list', async () => {
  mockOther = { directions: [], status: 'ready' };
  await renderLeg(fixture([planned, other]));
  await fireEvent.press(screen.getAllByRole('radio')[1]);
  expect(screen.getByText('nativeBusViewedStopsUnavailable')).toBeTruthy();
});
