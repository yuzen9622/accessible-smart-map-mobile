import { markRouteTokenInvalid, replaceNavigationRoute } from '@/features/route';
import type { AccessibleRoute, NavInstruction, NavInstructionsData } from '@/features/route/domain';
import { ApiError, type ApiResponse } from '@/shared/api';
import type { GeoPosition } from '@/shared/location';
import type { VisibilitySource } from '@/shared/polling';

import { useNavStore } from '../../store/navStore';
import { createNavigationController, type NavigationControllerDeps } from '../navigationController';
import { fakeUserLocationStore } from '../testing/fakeMap';
import { resetNavHarness, useMapStore } from '../testing/navHarness';
import { flushPromises } from '@/shared/testing/flushPromises';

jest.mock('@/features/map', () => jest.requireActual('../testing/fakeMap').mapModule);

// 沿緯度 25.05 往東 6 點，每點約 101 m。
const polyline: [number, number][] = Array.from({ length: 6 }, (_, i) => [121.5 + i * 0.001, 25.05]);

function makeRoute(version = 1): AccessibleRoute {
  return {
    routeId: `r${version}`,
    navigationId: 'nav-1',
    routeVersion: version,
    routeToken: `token-${version}`,
    routeName: '步行',
    totalMinutes: 10,
    transferCount: 0,
    accessibilityHighlights: [],
    legs: [{ type: 'WALK', from: 'A', to: 'B', distanceM: 500, minutesEst: 10, polyline, a11yFacilities: [] }],
  };
}

function step(text: string, polylineIndex: number | null, overrides: Partial<NavInstruction> = {}): NavInstruction {
  return {
    text,
    type: 'turn',
    bearing: null,
    relativeDirection: null,
    distanceM: 100,
    streetName: null,
    legType: 'WALK',
    legIndex: 0,
    polylineIndex,
    ...overrides,
  };
}

const INSTRUCTIONS = [step('出發', 0, { type: 'depart' }), step('右轉', 2), step('左轉', 4), step('抵達', 5, { type: 'arrive' })];

function ok(instructions: NavInstruction[] = INSTRUCTIONS): ApiResponse<NavInstructionsData> {
  return {
    ok: true,
    status: 'success',
    code: 200,
    message: 'ok',
    data: { instructions, initialBearing: 0, totalSteps: instructions.length, warnings: [] },
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function fakeVisibility() {
  const listeners = new Set<(active: boolean) => void>();
  const source: VisibilitySource = {
    isActive: () => true,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return { source, foreground: () => listeners.forEach((fn) => fn(true)) };
}

/** 模擬 map 的定位監看寫入一個 fix（位置與航向分兩次寫，和真實 useLocationTracking 一樣）。 */
function fix(lat: number, lng: number, course: number | null = null): void {
  fakeUserLocationStore.getState().setPosition({ lat, lng });
  fakeUserLocationStore.getState().setCourse(course);
}

async function flush(): Promise<void> {
  await flushPromises();
}

function setup(overrides: Partial<NavigationControllerDeps> = {}) {
  const vis = fakeVisibility();
  const speech = { speak: jest.fn(), stop: jest.fn() };
  const reroute = { triggerAutoReroute: jest.fn(async () => false), clearOffRoute: jest.fn() };
  const fetchInstructions = jest.fn(async () => ok());
  const getCurrent = jest.fn(
    async (): Promise<GeoPosition> => ({ lat: 25.05, lng: 121.5025, heading: 90, accuracy: 5, speed: 1, timestamp: 0 }),
  );
  let t = 1_000_000;
  const controller = createNavigationController({
    location: { getCurrent },
    visibility: vis.source,
    reroute,
    speech,
    language: () => 'zh-TW',
    arrivedText: () => '已抵達目的地',
    fetchInstructions,
    now: () => t,
    ...overrides,
  });
  return { controller, vis, speech, reroute, fetchInstructions, getCurrent, advance: (ms: number) => (t += ms) };
}

beforeEach(() => {
  jest.useFakeTimers();
  resetNavHarness();
  const route = makeRoute();
  useMapStore.setState({ selectRoute: { index: 0, route }, computeRoutes: [route] });
  useNavStore.setState({ isNavigating: true, navigationSource: 'local', voiceEnabled: true });
});
afterEach(() => jest.useRealTimers());

describe('NavigationController', () => {
  it('loads instructions by routeToken only, raises location accuracy and announces the first step', async () => {
    const { controller, fetchInstructions, speech } = setup();
    controller.start();
    await flush();

    expect(fetchInstructions).toHaveBeenCalledWith(
      { routeToken: 'token-1', userHeading: undefined, language: 'zh-TW' },
      expect.any(AbortSignal),
    );
    expect(fakeUserLocationStore.getState().navigationAccuracy).toBe(true);
    const nav = useNavStore.getState();
    expect(nav.navigationId).toBe('nav-1');
    expect(nav.instructions).toHaveLength(4);
    expect(nav.routeTotalM).toBeGreaterThan(490);
    expect(speech.speak).toHaveBeenLastCalledWith('出發', 'zh-TW');

    controller.stop();
    expect(fakeUserLocationStore.getState().navigationAccuracy).toBe(false);
  });

  it('advances from the shared location store and announces each new step', async () => {
    const { controller, speech } = setup();
    controller.start();
    await flush();

    fix(25.05, 121.5025);
    await flush();
    const nav = useNavStore.getState();
    expect(nav.currentStepIndex).toBe(2);
    expect(nav.distanceToNextM).toBeGreaterThan(140);
    expect(nav.etaSource).toBe('local');
    expect(speech.speak).toHaveBeenLastCalledWith('左轉', 'zh-TW');
    controller.stop();
  });

  it('hands a confirmed off-route episode to the reroute coordinator and clears it on return', async () => {
    const { controller, reroute } = setup();
    controller.start();
    await flush();

    for (let i = 0; i < 3; i++) {
      fix(25.0505, 121.502 + i * 0.00001);
      await flush();
    }
    expect(reroute.triggerAutoReroute).toHaveBeenCalledTimes(1);
    expect(useNavStore.getState().isOffRoute).toBe(true);

    useNavStore.getState().setReroutePending();
    fix(25.05, 121.502);
    await flush();
    expect(reroute.clearOffRoute).toHaveBeenCalled();
    expect(useNavStore.getState().isOffRoute).toBe(false);
    expect(useNavStore.getState().rerouteStatus).toBe('idle');
    controller.stop();
  });

  it('keeps retrying the reroute while drifting past the 500 m follow radius, instead of going silent (bug: long off-route with no auto-reroute)', async () => {
    const { controller, reroute, advance } = setup();
    controller.start();
    await flush();

    for (let i = 0; i < 3; i++) {
      fix(25.0505, 121.502 + i * 0.00001);
      await flush();
    }
    expect(reroute.triggerAutoReroute).toHaveBeenCalledTimes(1);
    expect(useNavStore.getState().isOffRoute).toBe(true);
    const stepIndexBeforeDrift = useNavStore.getState().currentStepIndex;

    // 繼續往北漂，超過 500 m 的跟隨上限：`advanceNavigation` 本身會回傳 null，
    // 但既有的偏航狀態要讓 controller 持續嘗試重算，而不是整個放棄。
    advance(31_000); // 過了 30 秒自動重算冷卻
    fix(25.06, 121.502);
    await flush();
    expect(reroute.triggerAutoReroute).toHaveBeenCalledTimes(2);
    expect(useNavStore.getState().isOffRoute).toBe(true);
    // 這個樣本投影沒有意義，步驟／進度不該被更動。
    expect(useNavStore.getState().currentStepIndex).toBe(stepIndexBeforeDrift);

    advance(31_000);
    fix(25.065, 121.502);
    await flush();
    expect(reroute.triggerAutoReroute).toHaveBeenCalledTimes(3);
    controller.stop();
  });

  it('arrives exactly once and says so once', async () => {
    const { controller, speech } = setup();
    controller.start();
    await flush();

    fix(25.05, 121.505);
    await flush();
    fix(25.05, 121.50501);
    await flush();
    expect(useNavStore.getState().arrived).toBe(true);
    expect(speech.speak.mock.calls.filter(([text]) => text === '已抵達目的地')).toHaveLength(1);
    controller.stop();
  });

  it('stays silent when the local voice is off or the assistant owns speech', async () => {
    useNavStore.setState({ voiceEnabled: false });
    const off = setup();
    off.controller.start();
    await flush();
    expect(off.speech.speak).not.toHaveBeenCalled();
    off.controller.stop();

    useNavStore.setState({ voiceEnabled: true });
    const gemini = setup({ geminiOwnsSpeech: () => true });
    gemini.controller.start();
    await flush();
    expect(gemini.speech.speak).not.toHaveBeenCalled();
    gemini.controller.stop();
  });

  it('cuts local speech the moment the assistant takes over the speaker', async () => {
    let notify: (owns: boolean) => void = () => {};
    const { controller, speech } = setup({
      subscribeSpeechOwner: (cb) => {
        notify = cb;
        return () => {};
      },
    });
    controller.start();
    await flush();
    speech.stop.mockClear();
    notify(true);
    expect(speech.stop).toHaveBeenCalledTimes(1);
    controller.stop();
  });

  it('writes the foreground fix into the shared store, which drives progress', async () => {
    const { controller, vis, getCurrent } = setup();
    controller.start();
    await flush();
    vis.foreground();
    await flush();
    expect(getCurrent).toHaveBeenCalledWith({ accuracy: 'best-for-navigation' });
    expect(fakeUserLocationStore.getState().position).toEqual({ lat: 25.05, lng: 121.5025 });
    expect(useNavStore.getState().currentStepIndex).toBe(2);
    controller.stop();
  });

  it('drops a late instructions response once the route was replaced', async () => {
    const stale = deferred<ApiResponse<NavInstructionsData>>();
    const fetchInstructions = jest
      .fn()
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(ok([step('新路線右轉', 1), step('新路線抵達', 5, { type: 'arrive' })]));
    const { controller } = setup({ fetchInstructions });
    useNavStore.setState({ navigationId: 'nav-1', routeVersion: 1 });
    controller.start();
    await flush();

    // 重算把路線換成 v2（navStore 身分同步更新，就像 applyRouteReplacement 做的）；
    // 套用後以使用者語系重取 v2 的指令。
    replaceNavigationRoute(makeRoute(2));
    useNavStore.setState({ routeVersion: 2 });
    await flush();
    expect(fetchInstructions.mock.calls[1][0].routeToken).toBe('token-2');

    // v1 的請求這時才回來：不得覆蓋 v2。
    stale.resolve(ok());
    await flush();
    const nav = useNavStore.getState();
    expect(nav.routeVersion).toBe(2);
    expect(nav.instructions[0].text).toBe('新路線右轉');
    controller.stop();
  });

  it('drops a late instructions response once voice took over', async () => {
    const pending = deferred<ApiResponse<NavInstructionsData>>();
    const signals: AbortSignal[] = [];
    const fetchInstructions = jest.fn((_request: unknown, signal?: AbortSignal) => {
      if (signal) signals.push(signal);
      return pending.promise;
    });
    const { controller } = setup({ fetchInstructions });
    controller.start();
    await flush();
    const [signal] = signals;

    useNavStore.setState({ navigationSource: 'voice', instructions: [step('語音步驟', null)] });
    expect(signal.aborted).toBe(true);
    pending.resolve(ok());
    await flush();
    expect(useNavStore.getState().instructions[0].text).toBe('語音步驟');
    controller.stop();
  });

  it('runs a voice takeover on synthetic geometry and announces the carried step once', async () => {
    const pending = deferred<ApiResponse<NavInstructionsData>>();
    const fetchInstructions = jest.fn(() => pending.promise);
    useNavStore.setState({
      navigationSource: 'voice',
      instructions: [step('語音一', null), step('語音二', null), step('語音三', null)],
      currentStepIndex: 1,
    });
    fakeUserLocationStore.setState({ position: { lat: 25.05, lng: 121.5049 } });
    const { controller, speech } = setup({ fetchInstructions });
    controller.start();
    await flush();
    expect(fetchInstructions).not.toHaveBeenCalled();
    speech.speak.mockClear();

    useNavStore.getState().setNavigationSource('local');
    await flush();
    const nav = useNavStore.getState();
    expect(nav.instructions.every((ins) => ins.polylineIndex != null)).toBe(true);
    expect(nav.currentStepIndex).toBe(2);
    // 不先念第 0 步：接手的那一步直接播，之後才因為重新投影前進。
    expect(speech.speak.mock.calls.map(([text]) => text)).not.toContain('語音一');
    expect(fetchInstructions).toHaveBeenCalledTimes(1);

    pending.resolve(ok());
    await flush();
    expect(useNavStore.getState().instructions[1].text).toBe('右轉');
    controller.stop();
  });

  it('ignores location after stop', async () => {
    const { controller, speech } = setup();
    controller.start();
    await flush();
    controller.stop();
    expect(speech.stop).toHaveBeenCalled();

    const before = useNavStore.getState().currentStepIndex;
    fix(25.05, 121.5025);
    await flush();
    expect(useNavStore.getState().currentStepIndex).toBe(before);
  });

  it('prefers a fresh compass while walking and settles the throttled heading', async () => {
    const { controller, advance } = setup();
    controller.start();
    await flush();
    fakeUserLocationStore.getState().setHeading(45);
    expect(useNavStore.getState()).toMatchObject({ userHeading: 45, headingSource: 'compass' });

    // 80 ms 內第二個讀數：先不寫，節流結束後補寫最新平滑值。
    advance(10);
    fakeUserLocationStore.getState().setHeading(60);
    expect(useNavStore.getState().userHeading).toBe(45);
    jest.advanceTimersByTime(80);
    expect(useNavStore.getState().userHeading).toBeGreaterThan(45);

    advance(2000);
    fix(25.05, 121.5005, 90);
    await flush();
    // 羅盤已過期（>1.5 s）：退回 GPS 航向。
    expect(useNavStore.getState().headingSource).toBe('gps');
    controller.stop();
  });

  it('ends idle when an off-route confirm and a drive→walk handoff land on the same sample', async () => {
    // 開車 5 點接步行 3 點（Web 順序：confirm 先 setPending，交接再 setRerouteIdle）。
    const drivePolyline: [number, number][] = Array.from({ length: 5 }, (_, i) => [121.5 + i * 0.001, 25.05]);
    const walkPolyline: [number, number][] = Array.from({ length: 3 }, (_, i) => [121.504 + i * 0.001, 25.05]);
    const composite: AccessibleRoute = {
      ...makeRoute(),
      legs: [
        { type: 'DRIVE', from: 'A', to: 'P', distanceM: 400, durationMin: 2, polyline: drivePolyline },
        { type: 'WALK', from: 'P', to: 'B', distanceM: 200, minutesEst: 3, polyline: walkPolyline, a11yFacilities: [] },
      ],
    };
    useMapStore.setState({ selectRoute: { index: 0, route: composite }, computeRoutes: [composite] });
    const instructions = [
      step('出發', 0, { type: 'depart', legType: 'DRIVE' }),
      step('停車', 4, { type: 'arrive', legType: 'DRIVE' }),
      step('步行出發', 0, { type: 'depart', legIndex: 1 }),
      step('抵達', 2, { type: 'arrive', legIndex: 1 }),
    ];
    const reroute = {
      // 真實的協調器在送出前同步 setPending。
      triggerAutoReroute: jest.fn(async () => {
        useNavStore.getState().setReroutePending();
        return false;
      }),
      clearOffRoute: jest.fn(),
    };
    const { controller } = setup({ reroute, fetchInstructions: jest.fn(async () => ok(instructions)) });
    controller.start();
    await flush();

    fix(25.05, 121.501); // 在路上：記下目前是開車 leg
    await flush();
    fix(25.0508, 121.5015); // 偏北約 89 m：超過開車 80 m 門檻
    await flush();
    fix(25.0508, 121.502);
    await flush();
    fix(25.0508, 121.5045); // 第三個偏離樣本，同時已走到步行 leg
    await flush();

    expect(reroute.triggerAutoReroute).toHaveBeenCalledTimes(1);
    const nav = useNavStore.getState();
    expect(nav.isOffRoute).toBe(false);
    expect(nav.rerouteStatus).toBe('idle');
    controller.stop();
  });

  it('refetches instructions in the user language after a reroute, keeping the reroute reason', async () => {
    const fetchInstructions = jest.fn(async () => ok());
    const { controller } = setup({ fetchInstructions, language: () => 'en' });
    controller.start();
    await flush();
    expect(fetchInstructions).toHaveBeenCalledTimes(1);

    // 模擬 applyRouteReplacement：先換路線，再同步更新 navStore 身分與重算原因。
    replaceNavigationRoute(makeRoute(2));
    useNavStore.setState({ routeVersion: 2, instructions: [step('重算後（後端語言）', 0)] });
    useNavStore.getState().setLastRerouteReason('OFF_ROUTE');
    await flush();

    expect(fetchInstructions).toHaveBeenCalledTimes(2);
    expect(fetchInstructions.mock.calls[1]).toEqual([
      { routeToken: 'token-2', userHeading: undefined, language: 'en' },
      expect.any(AbortSignal),
    ]);
    const nav = useNavStore.getState();
    expect(nav.instructions[1].text).toBe('右轉');
    expect(nav.lastRerouteReason).toBe('OFF_ROUTE');
    controller.stop();
  });
});

describe('NavigationController step mode (live vs preview)', () => {
  it('starts live when the user is already on the route and ignores manual step changes', async () => {
    fix(25.05, 121.5);
    const { controller } = setup();
    controller.start();
    await flush();

    expect(useNavStore.getState().stepMode).toBe('live');
    const before = useNavStore.getState().currentStepIndex;
    useNavStore.getState().selectPreviewStep(3);
    expect(useNavStore.getState().currentStepIndex).toBe(before);
    controller.stop();
  });

  it('previews when the user is far from the route: GPS does not drive steps, the user does', async () => {
    // 台中（離台北的路線約 130 km）
    fix(24.1477, 120.6736);
    const { controller, speech, reroute } = setup();
    controller.start();
    await flush();

    expect(useNavStore.getState().stepMode).toBe('preview');
    fix(24.148, 120.674);
    await flush();
    expect(useNavStore.getState().currentStepIndex).toBe(0);
    expect(reroute.triggerAutoReroute).not.toHaveBeenCalled();

    useNavStore.getState().selectPreviewStep(2);
    expect(useNavStore.getState().currentStepIndex).toBe(2);
    expect(speech.speak).toHaveBeenLastCalledWith('左轉', 'zh-TW');
    useNavStore.getState().selectPreviewStep(99);
    expect(useNavStore.getState().currentStepIndex).toBe(3);
    useNavStore.getState().selectPreviewStep(-1);
    expect(useNavStore.getState().currentStepIndex).toBe(0);
    expect(useNavStore.getState().arrived).toBe(false);
    controller.stop();
  });

  it('switches from preview to live once a fix lands near the route and re-derives the step from GPS', async () => {
    fix(24.1477, 120.6736);
    const { controller } = setup();
    controller.start();
    await flush();
    useNavStore.getState().selectPreviewStep(3);

    fix(25.05, 121.5005);
    await flush();
    const nav = useNavStore.getState();
    expect(nav.stepMode).toBe('live');
    expect(nav.currentStepIndex).toBe(1);

    // live 是單向的：之後走遠是偏航，不會變回可手動切換。
    fix(24.1477, 120.6736);
    await flush();
    expect(useNavStore.getState().stepMode).toBe('live');
    controller.stop();
  });

  it('does not let manual selection override a voice-owned navigation', async () => {
    fix(24.1477, 120.6736);
    const { controller } = setup();
    controller.start();
    await flush();
    useNavStore.setState({ navigationSource: 'voice' });
    useNavStore.getState().selectPreviewStep(2);
    expect(useNavStore.getState().currentStepIndex).toBe(0);
    controller.stop();
  });
});

it('refreshes language with the same token and preserves the current step', async () => {
  let language: 'zh-TW' | 'en' = 'zh-TW';
  const { controller, speech, fetchInstructions } = setup({ language: () => language });
  controller.start(); await flush();
  useNavStore.setState({ currentStepIndex: 2 });
  language = 'en'; controller.refreshLanguage(); await flush();
  expect(fetchInstructions).toHaveBeenLastCalledWith({ routeToken: 'token-1', userHeading: undefined, language: 'en' }, expect.any(AbortSignal));
  expect(useNavStore.getState().currentStepIndex).toBe(2); expect(speech.stop).toHaveBeenCalled();
  controller.stop();
});

it('pauses navigation when another channel invalidates its token and does not retry that token', async () => {
  const { controller, speech, fetchInstructions } = setup();
  controller.start(); await flush();
  speech.speak.mockClear(); speech.stop.mockClear();
  markRouteTokenInvalid('token-1');
  expect(useNavStore.getState().instructionError).toBe('expired');
  expect(speech.stop).toHaveBeenCalled();
  expect(useMapStore.getState().selectRoute?.route.routeToken).toBe('token-1');
  fix(25.05, 121.50501); controller.refreshLanguage(); await flush();
  expect(fetchInstructions).toHaveBeenCalledTimes(1);
  expect(speech.speak).not.toHaveBeenCalled();
  expect(useNavStore.getState().arrived).toBe(false);
  controller.stop();
});

it.each(['INVALID_ROUTE_TOKEN', 'BAD_INPUT', 'INTERNAL_ERROR'])('surfaces %s and pauses guidance without clearing the preview', async (reason) => {
  const { controller, speech } = setup({ fetchInstructions: jest.fn(async () => { throw new ApiError('failure', reason === 'INTERNAL_ERROR' ? 500 : 400, reason); }) });
  controller.start(); await flush();
  expect(useNavStore.getState().instructionError).toBe(reason === 'INVALID_ROUTE_TOKEN' ? 'expired' : 'unavailable');
  expect(useMapStore.getState().selectRoute).not.toBeNull();
  speech.speak.mockClear(); fix(25.05, 121.50501); await flush();
  expect(speech.speak).not.toHaveBeenCalled(); expect(useNavStore.getState().arrived).toBe(false);
  controller.stop();
});
