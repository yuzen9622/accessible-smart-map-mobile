import { AccessibilityInfo } from 'react-native';
import type { LatLng } from '@/shared/geo';
import { useNavStore } from '@/features/navigation';
import { useUserLocationStore } from '@/features/map';

import { toNavInstruction } from '../../domain/voiceNavInstruction';
import type { VoiceNavigationEvent } from '../../domain/voiceSession';
import {
  getVoiceNavigationResumeState,
  handleVoiceNavigationEvent,
  installVoiceNavigationBridge,
  onVoiceSessionTerminal,
  setBridgeTranslate,
} from '../voiceNavigationBridge';
import { fakeRouteStore } from '../testing/fakeRouteSession';
import { useVoiceStore } from '../../store/voiceStore';

// jest.mock 會被 babel 提升到最上方，上面的 import 拿到的是替身
// navigation：真的 navStore＋純函式，副作用（開導航畫面、改道）換成 spy
const mockBegin = jest.fn();
const mockEnd = jest.fn();
const mockStart = jest.fn();
const mockReroute = jest.fn();
const mockAutoReroute = jest.fn();
jest.mock('@/features/navigation', () => {
  const { useNavStore } = jest.requireActual('@/features/navigation/store/navStore');
  const { geminiOwnsNavigationSpeech } = jest.requireActual('@/features/navigation/domain/navigationAudio');
  return {
    useNavStore,
    geminiOwnsNavigationSpeech,
    beginNavigation: (...args: unknown[]) => {
      mockBegin(...args);
      useNavStore.getState().setIsNavigating(true);
      useNavStore.getState().setVoiceEnabled(true);
    },
    endNavigation: () => {
      mockEnd();
      useNavStore.getState().setIsNavigating(false);
    },
    startNavigation: () => mockStart(),
    handleVoiceRerouteEvent: (event: unknown) => mockReroute(event),
    localRerouteCoordinator: { triggerAutoReroute: (p: unknown) => mockAutoReroute(p) },
    configureNavigationSpeechOwner: jest.fn(),
  };
});

jest.mock('@/features/map', () => {
  const { create: createStore } = jest.requireActual('zustand');
  return { useUserLocationStore: createStore(() => ({ position: null })) };
});

jest.mock('@/features/route', () => jest.requireActual('../testing/fakeRouteSession').routeModule);

jest.mock('@/shared/polling', () => ({ appStateVisibility: { subscribe: () => () => {} } }));

const mockCloseChat = jest.fn();
jest.mock('@/features/ai', () => ({
  closeChat: () => mockCloseChat(),
}));




const uplink = {
  setNavigationRoute: jest.fn(),
  startNavigation: jest.fn(),
  sendNavigationPosition: jest.fn(),
  previewNavigationStep: jest.fn(),
  cancelNavigation: jest.fn(),
  setMuted: jest.fn(),
  getStatus: jest.fn((): import('../../domain/voiceSession').VoiceStatusName => 'listening'),
};

function setPosition(position: LatLng | null): void {
  useUserLocationStore.setState({ position });
}

const start: VoiceNavigationEvent = {
  type: 'nav.start',
  currentStepIndex: 0,
  totalSteps: 2,
  steps: [
    { index: 0, instruction: '向北出發', legType: 'WALK', distanceM: 40, isTransit: false },
    { index: 1, instruction: '右轉', legType: 'WALK', distanceM: 60, isTransit: false },
  ],
};

beforeAll(() => {
  setBridgeTranslate((key) => key);
  installVoiceNavigationBridge(uplink);
});

beforeEach(() => {
  useNavStore.getState().setIsNavigating(false);
  useNavStore.getState().reset();
  setPosition({ lat: 25.04, lng: 121.52 });
  fakeRouteStore.setState({ navigationRoute: null, computeRoutes: null, selectRoute: { route: { navigationId: 'nav-1', routeVersion: 3, routeToken: 'tok-3' } } });
  jest.clearAllMocks();
});

describe('voiceNavigationBridge', () => {
  it('nav.start：切成語音來源、寫入指令、開導航畫面並關掉本機播報，立刻上報位置', () => {
    handleVoiceNavigationEvent(start, 'listening');
    const nav = useNavStore.getState();
    expect(nav.navigationSource).toBe('voice');
    expect(nav.navigationId).toBe('nav-1');
    expect(nav.routeVersion).toBe(3);
    expect(nav.instructions.map((i) => i.text)).toEqual(['向北出發', '右轉']);
    expect(nav.routeTotalM).toBe(100);
    expect(mockBegin).toHaveBeenCalledTimes(1);
    expect(mockCloseChat).toHaveBeenCalledTimes(1);
    expect(nav.voiceEnabled).toBe(false);
    expect(uplink.sendNavigationPosition).toHaveBeenCalledWith({ latitude: 25.04, longitude: 121.52 });
  });

  it('nav.start 指定別條候選時先切到該路線，導航身分跟著它', () => {
    const second = { navigationId: 'nav-2', routeVersion: 1, routeToken: 'tok-2' };
    fakeRouteStore.setState({ computeRoutes: [{ navigationId: 'nav-1', routeVersion: 3, routeToken: 'tok-3' }, second] });
    handleVoiceNavigationEvent({ ...start, routeToken: 'tok-2' }, 'listening');
    expect(fakeRouteStore.getState().selectRoute?.route.routeToken).toBe('tok-2');
    expect(useNavStore.getState().navigationId).toBe('nav-2');
    expect(mockBegin).toHaveBeenCalledTimes(1);
  });

  it('已在本機導航時 nav.start 不重啟導航或改選候選', () => {
    useNavStore.getState().setIsNavigating(true);
    handleVoiceNavigationEvent(start, 'listening');
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockBegin).not.toHaveBeenCalled();
  });

  it('本機正在導航別條時不接手 nav.start，請後端取消', () => {
    fakeRouteStore.setState({
      navigationRoute: { route: { navigationId: 'nav-1', routeVersion: 3, routeToken: 'tok-3' } },
      computeRoutes: [{ navigationId: 'nav-2', routeVersion: 1, routeToken: 'tok-2' }],
    });
    useNavStore.setState({ isNavigating: true, navigationSource: 'local', navigationId: 'nav-1' });
    handleVoiceNavigationEvent({ ...start, routeToken: 'tok-2' }, 'listening');
    expect(fakeRouteStore.getState().navigationRoute?.route.routeToken).toBe('tok-3');
    expect(useNavStore.getState()).toMatchObject({ navigationSource: 'local', navigationId: 'nav-1' });
    expect(uplink.cancelNavigation).toHaveBeenCalledTimes(1);
  });

  it('畫面沒有後端開始的路線時不接手，請後端取消', () => {
    handleVoiceNavigationEvent({ ...start, routeToken: 'tok-unknown' }, 'listening');
    expect(mockBegin).not.toHaveBeenCalled();
    expect(useNavStore.getState().isNavigating).toBe(false);
    expect(uplink.cancelNavigation).toHaveBeenCalledTimes(1);
  });

  it.each([
    { type: 'nav.stop', reason: 'user_ui' },
    { type: 'nav.arrived' },
    { type: 'nav.step', currentStepIndex: 1, instruction: '舊步驟', remainingM: 1 },
    { type: 'nav.offroute', distanceM: 999 },
    { type: 'nav.transit', leg: { mode: 'BUS', from: '舊起站', to: '舊終站' } },
  ] satisfies VoiceNavigationEvent[])('ignores late $type after a new local navigation takes ownership', event => {
    handleVoiceNavigationEvent(start, 'listening');
    useNavStore.getState().setIsNavigating(false);
    useNavStore.getState().reset();
    useNavStore.setState({ isNavigating: true, navigationSource: 'local', navigationId: 'new-local', instructions: [{ text: '新指引', type: 'depart', legType: 'WALK', distanceM: 200, legIndex: 0, bearing: null, relativeDirection: null, streetName: null, polylineIndex: null }] });
    const before = useNavStore.getState();
    handleVoiceNavigationEvent(event, 'listening');
    expect(useNavStore.getState()).toBe(before);
    expect(mockEnd).not.toHaveBeenCalled();
  });

  it('位置上行以 10 m 節流', () => {
    handleVoiceNavigationEvent(start, 'listening');
    uplink.sendNavigationPosition.mockClear();
    setPosition({ lat: 25.04003, lng: 121.52 }); // 約 3 m
    expect(uplink.sendNavigationPosition).not.toHaveBeenCalled();
    setPosition({ lat: 25.0402, lng: 121.52 }); // 約 22 m
    expect(uplink.sendNavigationPosition).toHaveBeenCalledTimes(1);
  });

  it('使用者離開語音導航時回送 nav.cancel；後端以 arrived 結束時不回送', () => {
    handleVoiceNavigationEvent(start, 'listening');
    useNavStore.getState().setIsNavigating(false);
    expect(uplink.cancelNavigation).toHaveBeenCalledTimes(1);

    handleVoiceNavigationEvent(start, 'listening');
    handleVoiceNavigationEvent({ type: 'nav.stop', reason: 'arrived' }, 'listening');
    expect(useNavStore.getState().arrived).toBe(true);
    uplink.cancelNavigation.mockClear();
    useNavStore.getState().setIsNavigating(false);
    expect(uplink.cancelNavigation).not.toHaveBeenCalled();
  });

  it('nav.stop（非抵達）：先切回本機再結束導航，不回送 cancel', () => {
    handleVoiceNavigationEvent(start, 'listening');
    handleVoiceNavigationEvent({ type: 'nav.stop', reason: 'user_voice' }, 'listening');
    expect(mockEnd).toHaveBeenCalledTimes(1);
    expect(useNavStore.getState().isNavigating).toBe(false);
    expect(uplink.cancelNavigation).not.toHaveBeenCalled();
  });

  it('resume 狀態只在語音擁有導航時產生，帶路線 token 與目前步驟', () => {
    expect(getVoiceNavigationResumeState()).toBeNull();
    handleVoiceNavigationEvent(start, 'listening');
    useNavStore.getState().setCurrentStepIndex(1);
    expect(getVoiceNavigationResumeState()).toEqual({
      navigationId: 'nav-1',
      routeVersion: 3,
      routeToken: 'tok-3',
      lastKnownStepIndex: 1,
      currentPosition: { latitude: 25.04, longitude: 121.52 },
    });
  });

  it('語音 session 結束時，語音擁有的導航交回本機繼續', () => {
    handleVoiceNavigationEvent(start, 'listening');
    onVoiceSessionTerminal();
    expect(useNavStore.getState().navigationSource).toBe('local');
    expect(useNavStore.getState().isNavigating).toBe(true);
    expect(useNavStore.getState().voiceEnabled).toBe(true);
  });

  it('terminal handoff preserves an explicit voice mute', () => {
    handleVoiceNavigationEvent(start, 'listening');
    useVoiceStore.setState({ isMuted: true });
    try {
      onVoiceSessionTerminal();
      expect(useNavStore.getState()).toMatchObject({ isNavigating: true, navigationSource: 'local', voiceEnabled: false });
    } finally {
      useVoiceStore.setState({ isMuted: false });
    }
  });

  it('nav.resume_failed：交回本機並以目前位置觸發本機改道', () => {
    handleVoiceNavigationEvent(start, 'listening');
    handleVoiceNavigationEvent(
      { type: 'nav.resume_failed', navigationId: 'nav-1', code: 'ROUTE_EXPIRED', message: 'expired', retryable: false },
      'listening',
    );
    expect(useNavStore.getState().navigationSource).toBe('local');
    expect(mockAutoReroute).toHaveBeenCalledWith({ lat: 25.04, lng: 121.52 });
  });

  it('選到的路線 token 改變時重新 arm', () => {
    fakeRouteStore.setState({ selectRoute: { route: { navigationId: 'nav-1', routeVersion: 4, routeToken: 'tok-4' } } });
    expect(uplink.setNavigationRoute).toHaveBeenCalledWith('tok-4');
  });

  it('nav.route_replaced 以 steps 轉成指令交給改道 coordinator', () => {
    handleVoiceNavigationEvent(
      {
        type: 'nav.route_replaced',
        navigationId: 'nav-1',
        previousRouteVersion: 3,
        routeVersion: 4,
        routeToken: 'tok-4',
        route: JSON.parse('{"routeId":"r4","legs":[]}'),
        warnings: [],
        currentStepIndex: 0,
        steps: [{ index: 0, instruction: '改走新路線', legType: 'WALK', distanceM: 10, isTransit: false }],
      },
      'listening',
    );
    const call: unknown = mockReroute.mock.calls[0]?.[0];
    expect(call).toMatchObject({ type: 'nav.route_replaced', replacement: { routeVersion: 4, instructions: [{ text: '改走新路線' }] } });
  });
});


it('sends GPS updates during ordinary voice chat without starting navigation', () => {
  useNavStore.getState().setIsNavigating(false);
  jest.clearAllMocks();
  setPosition({ lat: 24.15, lng: 120.68 });
  expect(uplink.sendNavigationPosition).toHaveBeenCalledWith({ latitude: 24.15, longitude: 120.68 });
  expect(mockBegin).not.toHaveBeenCalled();
  expect(useNavStore.getState().isNavigating).toBe(false);
});
it.each(['idle', 'ended', 'error', 'needs-login', 'connecting', 'reconnecting'] as const)('does not upload GPS when voice is %s', status => {
  uplink.getStatus.mockReturnValueOnce(status);
  uplink.sendNavigationPosition.mockClear();
  setPosition({ lat: 24.16, lng: 120.68 });
  expect(uplink.sendNavigationPosition).not.toHaveBeenCalled();
});

describe('backend navigation recovery', () => {
  const leg = { mode: 'BUS' as const, from: '甲站', to: '乙站', routeName: '307' };
  const resume: VoiceNavigationEvent = {
    type: 'nav.resume_ok', navigationId: 'nav-1', routeVersion: 3, routeToken: 'fresh-token',
    currentStepIndex: 1, totalSteps: 3, onVehicle: true,
    steps: [
      { index: 0, instruction: '走到站牌', legType: 'WALK', distanceM: 40, isTransit: false },
      { index: 1, legIndex: 1, instruction: '搭車', type: 'transit_board', legType: 'BUS', distanceM: 300, isTransit: true },
      { index: 2, legIndex: 1, instruction: '下車', type: 'transit_alight', legType: 'BUS', distanceM: 10, isTransit: true },
    ],
  };

  it('transit keeps backend leg without guessing a step or erasing progress; alighting clears it', () => {
    handleVoiceNavigationEvent(start, 'listening');
    useNavStore.getState().setInstructions(resume.steps.map(toNavInstruction));
    useNavStore.getState().setDistanceToNextM(23);
    handleVoiceNavigationEvent({ type: 'nav.transit', leg }, 'listening');
    expect(useNavStore.getState()).toMatchObject({ currentStepIndex: 0, distanceToNextM: 23, voiceTransit: { onVehicle: true, leg } });
    useNavStore.getState().setTransitGuide(null);
    expect(useNavStore.getState()).toMatchObject({ voiceTransit: { onVehicle: true, leg } });
    handleVoiceNavigationEvent({ type: 'nav.step', currentStepIndex: 2, instruction: '下車', remainingM: 10 }, 'listening');
    expect(useNavStore.getState()).toMatchObject({ currentStepIndex: 2, voiceTransit: null });
  });

  it('resume refreshes only active A while viewing B, rebuilds distances and restores vehicle state', () => {
    fakeRouteStore.setState({ navigationRoute: { route: { navigationId: 'nav-1', routeVersion: 3, routeToken: 'old', legs: JSON.parse('[{"type":"WALK"},{"type":"BUS","departureStop":"甲站","arrivalStop":"乙站","routeName":"307"}]') } } });
    handleVoiceNavigationEvent(start, 'listening');
    fakeRouteStore.setState({ selectRoute: { route: { navigationId: 'nav-B', routeVersion: 1, routeToken: 'B-token' } } });
    useNavStore.getState().setProgress({ remainingM: 999, distanceToNextM: 888, remainingDurationSec: 100, estimatedArrivalAt: 123 });
    handleVoiceNavigationEvent(resume, 'listening');
    expect(fakeRouteStore.getState().navigationRoute?.route.routeToken).toBe('fresh-token');
    expect(fakeRouteStore.getState().selectRoute?.route.routeToken).toBe('B-token');
    expect(getVoiceNavigationResumeState()?.routeToken).toBe('fresh-token');
    expect(useNavStore.getState()).toMatchObject({ currentStepIndex: 1, routeTotalM: 350, remainingM: 310, distanceToNextM: 300, remainingDurationSec: null, estimatedArrivalAt: null, voiceTransit: { onVehicle: true, leg }, voiceEnabled: false });
  });

  it('resume restores the metro train terminal without replacing the alighting station', () => {
    fakeRouteStore.setState({ navigationRoute: { route: { navigationId: 'nav-1', routeVersion: 3, routeToken: 'old', legs: JSON.parse('[{"type":"WALK"},{"type":"METRO","departureStation":"市政府","arrivalStation":"台北車站","lineName":"板南線","terminalStation":"頂埔","lineKey":"TRTC_BL","fromNameEn":"Taipei City Hall","toNameEn":"Taipei Main Station","terminalNameEn":"Dingpu","routeDisplayName":"板南線","toDisplayName":"台北車站"}]') } } });
    handleVoiceNavigationEvent(start, 'listening');
    handleVoiceNavigationEvent({ ...resume, steps: resume.steps.map((s) => (s.legType === 'BUS' ? { ...s, legType: 'METRO' } : s)) }, 'listening');
    expect(useNavStore.getState().voiceTransit).toEqual({ onVehicle: true,
      leg: { mode: 'METRO', from: '市政府', to: '台北車站', routeName: '板南線', terminalStation: '頂埔',
        lineKey: 'TRTC_BL', fromNameEn: 'Taipei City Hall', toNameEn: 'Taipei Main Station', terminalNameEn: 'Dingpu' } });
  });

  it('resume without trusted steps or leg clears stale distances and does not invent stations', () => {
    handleVoiceNavigationEvent(start, 'listening');
    handleVoiceNavigationEvent({ ...resume, steps: [], currentStepIndex: 0 }, 'listening');
    expect(useNavStore.getState()).toMatchObject({ routeTotalM: null, remainingM: null, distanceToNextM: null, voiceTransit: { onVehicle: true, leg: null } });
  });

  it('stale resume failure and failure for local-owned navigation are inert; matching failure reports actual message', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    handleVoiceNavigationEvent(start, 'listening');
    const failed = { type: 'nav.resume_failed' as const, navigationId: 'other', code: 'ROUTE_EXPIRED' as const, message: '恢復失敗，路線已過期', retryable: false };
    handleVoiceNavigationEvent(failed, 'listening');
    expect(useNavStore.getState().navigationSource).toBe('voice');
    expect(mockAutoReroute).not.toHaveBeenCalled();
    handleVoiceNavigationEvent({ ...failed, navigationId: 'nav-1' }, 'listening');
    expect(announce).toHaveBeenCalledWith(failed.message);
    expect(useNavStore.getState()).toMatchObject({ navigationSource: 'local', isNavigating: true, voiceEnabled: true });
    mockAutoReroute.mockClear();
    handleVoiceNavigationEvent({ ...failed, navigationId: 'nav-1' }, 'listening');
    expect(mockAutoReroute).not.toHaveBeenCalled();
  });

  it('nav.error reports NO_ROUTE_ARMED without terminating a local route', () => {
    useNavStore.getState().setIsNavigating(true);
    handleVoiceNavigationEvent({ type: 'nav.error', code: 'NO_ROUTE_ARMED', message: '沒有可啟動的路線' }, 'listening');
    expect(mockEnd).not.toHaveBeenCalled();
    expect(useNavStore.getState()).toMatchObject({ isNavigating: true, navigationSource: 'local' });
  });

  it('resume success rejects stale identity/version and arrived navigation', () => {
    handleVoiceNavigationEvent(start, 'listening');
    for (const event of [{ ...resume, navigationId: 'other' }, { ...resume, routeVersion: 2 }]) {
      handleVoiceNavigationEvent(event, 'listening');
      expect(useNavStore.getState().instructions.map((i) => i.text)).toEqual(['向北出發', '右轉']);
    }
    useNavStore.getState().setArrived(true);
    handleVoiceNavigationEvent(resume, 'listening');
    expect(useNavStore.getState().arrived).toBe(true);
    expect(useNavStore.getState().currentStepIndex).toBe(0);
  });

  it('walking step discards transit and repeat does not enable local speech', () => {
    handleVoiceNavigationEvent(start, 'listening');
    handleVoiceNavigationEvent({ type: 'nav.transit', leg }, 'listening');
    handleVoiceNavigationEvent({ type: 'nav.step', currentStepIndex: 1, instruction: '右轉', remainingM: 60 }, 'listening');
    expect(useNavStore.getState()).toMatchObject({ voiceTransit: null, voiceEnabled: false });
  });

  it('start and replacement discard old transit state', () => {
    handleVoiceNavigationEvent(start, 'listening');
    handleVoiceNavigationEvent({ type: 'nav.transit', leg }, 'listening');
    handleVoiceNavigationEvent(start, 'listening');
    expect(useNavStore.getState()).toMatchObject({ voiceTransit: null });
    handleVoiceNavigationEvent({ type: 'nav.transit', leg }, 'listening');
    handleVoiceNavigationEvent({
      type: 'nav.route_replaced', navigationId: 'nav-1', previousRouteVersion: 3, routeVersion: 4, routeToken: 'tok-4',
      route: JSON.parse('{"routeId":"r4","legs":[]}'), steps: [], currentStepIndex: 0, warnings: [],
    }, 'listening');
    expect(useNavStore.getState()).toMatchObject({ voiceTransit: null });
  });
});
