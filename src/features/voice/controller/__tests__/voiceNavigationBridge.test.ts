import type { LatLng } from '@/shared/geo';
import { useNavStore } from '@/features/navigation';
import { useUserLocationStore } from '@/features/map';

import type { VoiceNavigationEvent } from '../../domain/voiceSession';
import {
  getVoiceNavigationResumeState,
  handleVoiceNavigationEvent,
  installVoiceNavigationBridge,
  onVoiceSessionTerminal,
  setBridgeTranslate,
} from '../voiceNavigationBridge';
import { fakeRouteStore } from '../testing/fakeRouteSession';

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
  sendNavigationPosition: jest.fn(),
  cancelNavigation: jest.fn(),
  setMuted: jest.fn(),
  getStatus: () => 'listening' as const,
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
  jest.clearAllMocks();
  useNavStore.getState().reset();
  setPosition({ lat: 25.04, lng: 121.52 });
  fakeRouteStore.setState({ selectRoute: { route: { navigationId: 'nav-1', routeVersion: 3, routeToken: 'tok-3' } } });
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

  it('已在本機導航時 nav.start 不重啟導航或改選候選', () => {
    useNavStore.getState().setIsNavigating(true);
    handleVoiceNavigationEvent(start, 'listening');
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockBegin).not.toHaveBeenCalled();
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

