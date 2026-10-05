import { useBusStore, type ActiveBusLeg } from '@/features/bus';
import type { AccessibleRoute, BusLeg, NavInstruction, NavInstructionsData, RouteLeg } from '@/features/route/domain';
import type { ApiResponse } from '@/shared/api';
import type { GeoPosition } from '@/shared/location';
import type { VisibilitySource } from '@/shared/polling';

import { transitSpeechText } from '../../domain/transitCopy';
import { useNavStore } from '../../store/navStore';
import { createNavigationController } from '../navigationController';
import { fakeUserLocationStore } from '../testing/fakeMap';
import { resetNavHarness, useMapStore } from '../testing/navHarness';
import { flushPromises } from '@/shared/testing/flushPromises';

jest.mock('@/features/map', () => jest.requireActual('../testing/fakeMap').mapModule);

// 沿緯度 25.05 往東，經度每 0.001 約 101 m。步行到 121.502（上車站）→ 公車到 121.510（下車站）→ 步行到 121.512。
const LAT = 25.05;
const line = (from: number, to: number): [number, number][] =>
  Array.from({ length: Math.round((to - from) / 0.001) + 1 }, (_, i) => [Number((from + i * 0.001).toFixed(3)), LAT]);

const busLeg = {
  type: 'BUS',
  routeName: '小18',
  subRouteName: '小18',
  departureStop: '上車站',
  arrivalStop: '下車站',
  tdxCity: 'Taipei',
  rideMinutes: 8,
  direction: 0,
  waitInfo: { time: 5, source: 'realtime' },
  estimatedWaitMinutes: 5,
  polyline: line(121.502, 121.51),
  departureStopA11y: [],
  arrivalStopA11y: [],
  intermediateStops: [121.504, 121.506, 121.508].map((lng, i) => ({ name: `中途${i + 1}`, location: [lng, LAT] as [number, number] })),
} as BusLeg;

const route: AccessibleRoute = {
  routeId: 'r1',
  navigationId: 'nav-1',
  routeVersion: 1,
  routeToken: 'token-1',
  routeName: '公車',
  totalMinutes: 20,
  transferCount: 0,
  accessibilityHighlights: [],
  legs: [
    { type: 'WALK', from: 'A', to: '上車站', distanceM: 200, minutesEst: 3, polyline: line(121.5, 121.502), a11yFacilities: [] },
    busLeg,
    { type: 'WALK', from: '下車站', to: 'B', distanceM: 200, minutesEst: 3, polyline: line(121.51, 121.512), a11yFacilities: [] },
  ] as RouteLeg[],
};

function step(text: string, legIndex: number, polylineIndex: number | null, overrides: Partial<NavInstruction> = {}): NavInstruction {
  return { text, type: 'turn', bearing: null, relativeDirection: null, distanceM: 100, streetName: null, legType: 'WALK', legIndex, polylineIndex, ...overrides };
}

const INSTRUCTIONS: NavInstruction[] = [
  step('出發', 0, 0, { type: 'depart' }),
  step('請在「上車站」站牌等候，搭乘公車「小18」，預估等候約 5 分鐘。', 1, null, { type: 'transit_board', legType: 'BUS' }),
  step('抵達「下車站」站後請下車。', 1, null, { type: 'transit_alight', legType: 'BUS' }),
  step('向右轉', 2, 1),
  step('您已抵達目的地', 2, null, { type: 'arrive' }),
];

function ok(): ApiResponse<NavInstructionsData> {
  return {
    ok: true,
    status: 'success',
    code: 200,
    message: 'ok',
    data: { instructions: INSTRUCTIONS, initialBearing: 90, totalSteps: INSTRUCTIONS.length, warnings: [] },
  };
}

const visibility: VisibilitySource = { isActive: () => true, subscribe: () => () => {} };
/** 測試用翻譯：鍵＋參數，斷言念了哪一句、帶了什麼值。 */
const t = (key: string, options?: Record<string, string | number>) => (options ? `${key}${JSON.stringify(options)}` : key);

let now = 1_000_000;
let running: { stop: () => void } | null = null;
function setup() {
  const speech = { speak: jest.fn(), stop: jest.fn() };
  const getCurrent = jest.fn(async (): Promise<GeoPosition> => ({ lat: LAT, lng: 121.5, heading: 90, accuracy: 5, speed: 1, timestamp: 0 }));
  const controller = createNavigationController({
    location: { getCurrent },
    visibility,
    reroute: { triggerAutoReroute: jest.fn(async () => false), clearOffRoute: jest.fn() },
    speech,
    language: () => 'zh-TW',
    arrivedText: () => '已抵達目的地',
    fetchInstructions: jest.fn(async () => ok()),
    transitSpeechText: (s) => transitSpeechText(t, s),
    now: () => now,
  });
  running = controller;
  return { controller, speech };
}

/** 經過 `seconds` 秒後在 `lng` 收到一個 fix。 */
async function at(lng: number, seconds = 10): Promise<void> {
  now += seconds * 1000;
  fakeUserLocationStore.getState().setPosition({ lat: LAT, lng });
  await flushPromises();
}

const spoken = (speech: { speak: jest.Mock }) => speech.speak.mock.calls.map((c: unknown[]) => String(c[0]));
const lastSpoken = (speech: { speak: jest.Mock }) => spoken(speech).at(-1) ?? '';

function trackBus(eta: number | null, stop: 'board' | 'alight' = 'board') {
  const active: ActiveBusLeg = { key: 'nav:0:r1:0:1:小18:0:上車站', leg: busLeg, route };
  const current = useBusStore.getState().activeBusLeg;
  useBusStore.setState({
    activeBusLeg: current?.key === active.key ? current : active,
    liveBusPositions:
      stop === 'board'
        ? [{ plateNumb: 'KKA-1234', isTarget: true, direction: 0, lat: LAT, lng: 121.5, speed: 0, gpsTime: '', isLowFloor: '是', hasLiftOrRamp: '是', vehicleClass: '' }]
        : [],
    legArrival: { stop, eta },
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  resetNavHarness();
  useMapStore.setState({ selectRoute: { index: 0, route }, computeRoutes: [route] });
  useNavStore.setState({ isNavigating: true, navigationSource: 'local', voiceEnabled: true });
  useBusStore.setState({ activeBusLeg: null, liveBusPositions: [], legArrival: null });
  now = 1_000_000;
});
afterEach(() => {
  // 斷言失敗時測試本體走不到 stop()：在這裡停，免得還在訂閱的 controller 影響下一個測試。
  running?.stop();
  running = null;
  jest.useRealTimers();
});

async function startAtOrigin() {
  const env = setup();
  fakeUserLocationStore.getState().setPosition({ lat: LAT, lng: 121.5 });
  env.controller.start();
  await flushPromises();
  return env;
}

describe('bus segment: waiting at the stop', () => {
  it('stays on the boarding step at the stop instead of jumping to "get off"', async () => {
    const { speech } = await startAtOrigin();
    trackBus(4);
    await at(121.5019);
    expect(useNavStore.getState().currentStepIndex).toBe(1);
    expect(useNavStore.getState().transitGuide).toEqual({ phase: 'waiting', routeName: '小18', boardStop: '上車站', waitMinutes: 4 });
    expect(lastSpoken(speech)).toContain('navBusSpeakAtStop{"stop":"上車站"}');
    expect(lastSpoken(speech)).toContain('navBusSpeakWait{"route":"小18","count":4}');
    // 後端的靜態等候文字（「預估等候約 5 分鐘」）不念。
    expect(spoken(speech).some((s) => s.includes('預估等候約 5 分鐘'))).toBe(false);

    // 在站牌附近站著不動：仍然在等車。
    await at(121.50205, 60);
    expect(useNavStore.getState().currentStepIndex).toBe(1);
  });

  it('updates the minutes live and announces once when the bus is close and once when arriving', async () => {
    const { speech } = await startAtOrigin();
    trackBus(8);
    await at(121.5019);
    const afterArrival = speech.speak.mock.calls.length;

    trackBus(6);
    await flushPromises();
    expect(useNavStore.getState().transitGuide).toMatchObject({ waitMinutes: 6 });
    expect(speech.speak.mock.calls.length).toBe(afterArrival);

    trackBus(3);
    await flushPromises();
    expect(lastSpoken(speech)).toBe('navBusSpeakWait{"route":"小18","count":3}');
    trackBus(2);
    await flushPromises();
    expect(speech.speak.mock.calls.length).toBe(afterArrival + 1);

    trackBus(1);
    await flushPromises();
    expect(lastSpoken(speech)).toBe('navBusSpeakArriving{"route":"小18"}');
    trackBus(0);
    await flushPromises();
    expect(speech.speak.mock.calls.length).toBe(afterArrival + 2);
  });

  it('re-arms the reminders when the awaited bus leaves and the next one is far away', async () => {
    const { speech } = await startAtOrigin();
    trackBus(2);
    await at(121.5019);
    trackBus(12);
    await flushPromises();
    trackBus(3);
    await flushPromises();
    expect(lastSpoken(speech)).toBe('navBusSpeakWait{"route":"小18","count":3}');
  });

  it('a single GPS jump away from the stop is not boarding', async () => {
    await startAtOrigin();
    await at(121.5019);
    await at(121.5027, 1); // 一個飄移點：70 m／1 秒
    await at(121.5019, 1);
    expect(useNavStore.getState().currentStepIndex).toBe(1);
    expect(useNavStore.getState().transitGuide?.phase).toBe('waiting');
  });

  it('clears the guide and stays silent in route preview', async () => {
    const { speech } = await startAtOrigin();
    trackBus(4);
    await at(121.5019);
    useNavStore.setState({ stepMode: 'preview' });
    await flushPromises();
    expect(useNavStore.getState().transitGuide).toBeNull();
    const before = speech.speak.mock.calls.length;
    trackBus(1);
    await flushPromises();
    expect(useNavStore.getState().transitGuide).toBeNull();
    expect(speech.speak.mock.calls.length).toBe(before);
  });

  it('walking around near the stop is not boarding', async () => {
    await startAtOrigin();
    await at(121.5019);
    await at(121.5024, 40); // 約 40 m、1 m/s
    await at(121.5026, 30);
    expect(useNavStore.getState().currentStepIndex).toBe(1);
    expect(useNavStore.getState().transitGuide?.phase).toBe('waiting');
  });
});

describe('bus segment: riding', () => {
  async function board() {
    const env = await startAtOrigin();
    trackBus(1);
    await at(121.5019);
    // 離站約 70 m → 100 m，兩個樣本都約 10 m/s → 已上車。
    await at(121.5027, 6);
    await at(121.503, 3);
    return env;
  }

  it('detects boarding from movement, hands the bus feature the locked plate, and announces stops left', async () => {
    const { speech } = await board();
    expect(useNavStore.getState().currentStepIndex).toBe(2);
    expect(useBusStore.getState().activeBusLeg?.boarded).toEqual({ plate: 'KKA-1234' });
    expect(useNavStore.getState().transitGuide).toMatchObject({ phase: 'riding', alightStop: '下車站', stopsLeft: 4, minutesSource: 'estimated' });
    expect(lastSpoken(speech)).toContain('navBusSpeakBoarded');
    expect(lastSpoken(speech)).toContain('navBusSpeakStopsLeft{"count":4,"stop":"下車站"}');
    // 後端「抵達…請下車」的靜態文字由搭乘導引取代。
    expect(spoken(speech).some((s) => s.includes('站後請下車'))).toBe(false);
  });

  // 使用者那台車開走後被判定「過了上車站」，下一班變成追蹤目標：上車時不能鎖到下一班的車牌。
  it('locks the plate of the bus that left with the user, not the next one', async () => {
    await startAtOrigin();
    trackBus(0);
    await at(121.5019);
    await at(121.5027, 6);
    useBusStore.setState({
      liveBusPositions: [
        { plateNumb: 'NEXT-9999', isTarget: true, direction: 0, lat: LAT, lng: 121.49, speed: 0, gpsTime: '', isLowFloor: '是', hasLiftOrRamp: '是', vehicleClass: '' },
      ],
      legArrival: { stop: 'board', eta: 12 },
    });
    await at(121.503, 3);
    expect(useBusStore.getState().activeBusLeg?.boarded).toEqual({ plate: 'KKA-1234' });
  });

  it('uses the realtime minutes of the boarded bus when the bus feature has them', async () => {
    await board();
    trackBus(5, 'alight');
    await flushPromises();
    expect(useNavStore.getState().transitGuide).toMatchObject({ minutes: 5, minutesSource: 'realtime' });
  });

  it('counts down stops, warns one stop before, and says to get off before the next walking step', async () => {
    const { speech } = await board();
    await at(121.5045);
    expect(useNavStore.getState().transitGuide).toMatchObject({ stopsLeft: 3 });
    expect(lastSpoken(speech)).toContain('navBusSpeakStopsLeft{"count":3,"stop":"下車站"}');

    await at(121.5085);
    expect(useNavStore.getState().transitGuide).toMatchObject({ stopsLeft: 1 });
    expect(lastSpoken(speech)).toBe('navBusSpeakNextAlight{"stop":"下車站"}');

    await at(121.51);
    expect(useNavStore.getState().currentStepIndex).toBe(3);
    expect(useNavStore.getState().transitGuide).toBeNull();
    expect(lastSpoken(speech)).toBe('navBusSpeakAlight{"stop":"下車站"} 向右轉');
  });

  it('a sparse fix far along the bus route counts as boarded even without speed', async () => {
    await startAtOrigin();
    await at(121.5019);
    await at(121.5045, 600); // 約 250 m，但用了 10 分鐘
    expect(useNavStore.getState().currentStepIndex).toBe(2);
    expect(useNavStore.getState().transitGuide?.phase).toBe('riding');
  });
});

describe('bus segment: two rides', () => {
  const bus2 = {
    ...busLeg,
    routeName: '紅30',
    subRouteName: '紅30',
    departureStop: '轉乘站',
    arrivalStop: '終點站',
    polyline: line(121.507, 121.513),
    intermediateStops: [{ name: '中途A', location: [121.51, LAT] as [number, number] }],
  } as BusLeg;
  const twoBusRoute: AccessibleRoute = {
    ...route,
    routeId: 'r2',
    legs: [
      { type: 'WALK', from: 'A', to: '上車站', distanceM: 200, minutesEst: 3, polyline: line(121.5, 121.502), a11yFacilities: [] },
      { ...busLeg, polyline: line(121.502, 121.506), intermediateStops: [{ name: '中途1', location: [121.504, LAT] as [number, number] }] },
      { type: 'WALK', from: '下車站', to: '轉乘站', distanceM: 100, minutesEst: 2, polyline: line(121.506, 121.507), a11yFacilities: [] },
      bus2,
      { type: 'WALK', from: '終點站', to: 'B', distanceM: 100, minutesEst: 2, polyline: line(121.513, 121.514), a11yFacilities: [] },
    ] as RouteLeg[],
  };
  const twoBusInstructions: NavInstruction[] = [
    step('出發', 0, 0, { type: 'depart' }),
    step('等車 1', 1, null, { type: 'transit_board', legType: 'BUS' }),
    step('下車 1', 1, null, { type: 'transit_alight', legType: 'BUS' }),
    step('走到轉乘站', 2, 1),
    step('等車 2', 3, null, { type: 'transit_board', legType: 'BUS' }),
    step('下車 2', 3, null, { type: 'transit_alight', legType: 'BUS' }),
    step('向左轉', 4, 1),
    step('您已抵達目的地', 4, null, { type: 'arrive' }),
  ];

  // 一開導航人已經在第二段公車上：不能停在第一段，也不能跳到第二段下車卻一直顯示「請在站牌等候」。
  it('starting navigation while already on the second bus ends up riding that bus', async () => {
    useMapStore.setState({ selectRoute: { index: 0, route: twoBusRoute }, computeRoutes: [twoBusRoute] });
    const speech = { speak: jest.fn(), stop: jest.fn() };
    const controller = createNavigationController({
      location: { getCurrent: jest.fn(async (): Promise<GeoPosition> => ({ lat: LAT, lng: 121.511, heading: 90, accuracy: 5, speed: 8, timestamp: 0 })) },
      visibility,
      reroute: { triggerAutoReroute: jest.fn(async () => false), clearOffRoute: jest.fn() },
      speech,
      language: () => 'zh-TW',
      arrivedText: () => '已抵達目的地',
      fetchInstructions: jest.fn(async () => ({ ...ok(), data: { instructions: twoBusInstructions, initialBearing: 90, totalSteps: 8, warnings: [] } })),
      transitSpeechText: (s) => transitSpeechText(t, s),
      now: () => now,
    });
    running = controller;
    fakeUserLocationStore.getState().setPosition({ lat: LAT, lng: 121.511 });
    controller.start();
    await flushPromises();
    for (const lng of [121.5111, 121.5112, 121.5113, 121.5114]) await at(lng, 2);
    expect(useNavStore.getState().currentStepIndex).toBe(5);
    expect(useNavStore.getState().transitGuide).toMatchObject({ phase: 'riding', alightStop: '終點站' });
  });
});
