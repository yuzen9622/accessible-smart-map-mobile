import type { LatLng } from '@/shared/geo';
import { useNavStore } from '@/features/navigation';
import { useUserLocationStore } from '@/features/map';
import { useIndoorStore } from '@/features/indoor';

import {
  configureVoiceJourneyNavigation,
  currentNavigationState,
  handleVoiceUiCommand,
  installVoiceNavigationBridge,
  runNavigationControl,
  setBridgeTranslate,
} from '../voiceNavigationBridge';
import { fakeRouteStore } from '../testing/fakeRouteSession';
import { useVoiceStore } from '../../store/voiceStore';

// navigation：真的 navStore；開始／結束導航換成和按鈕同一個入口的替身
const mockBegin = jest.fn();
const mockEnd = jest.fn();
let speechOwner: { prepareNavigation?: () => void; speakCue?: (text: string) => boolean; cueChannelLive?: () => boolean } = {};
jest.mock('@/features/navigation', () => {
  const { useNavStore } = jest.requireActual('@/features/navigation/store/navStore');
  const { resolveStepMode } = jest.requireActual('@/features/navigation/domain/navigationEngine');
  return {
    useNavStore,
    resolveStepMode,
    beginNavigation: (...args: unknown[]) => mockBegin(...args),
    endNavigation: () => {
      mockEnd();
      useNavStore.getState().setIsNavigating(false);
    },
    handleVoiceRerouteEvent: jest.fn(),
    configureNavigationSpeechOwner: (owner: typeof speechOwner) => { speechOwner = owner; },
  };
});
jest.mock('@/features/map', () => {
  const { create: createStore } = jest.requireActual('zustand');
  return { useUserLocationStore: createStore(() => ({ position: null })) };
});
jest.mock('@/features/route/controller/routeSessionPort', () => jest.requireActual('../testing/fakeRouteSession').routeModule);
jest.mock('@/features/route/hooks/useRouteSession', () => jest.requireActual('../testing/fakeRouteSession').routeModule);
jest.mock('@/shared/polling', () => ({ appStateVisibility: { subscribe: () => () => {} } }));
const mockCloseChat = jest.fn();
jest.mock('@/features/ai', () => ({ closeChat: () => mockCloseChat() }));

const uplink = {
  setNavigationRoute: jest.fn(),
  startNavigation: jest.fn(),
  sendNavigationPosition: jest.fn(),
  sendNavigationState: jest.fn(),
  sendNavigationCue: jest.fn(),
  cancelNavigation: jest.fn(),
  getStatus: jest.fn((): import('../../domain/voiceSession').VoiceStatusName => 'listening'),
};

/** 和真的 beginJourneyNavigation 一樣：釘住選定路線、開始導航並通知播報擁有者。 */
function fakeBeginJourney(): void {
  mockBegin();
  fakeRouteStore.setState({ navigationRoute: fakeRouteStore.getState().selectRoute });
  speechOwner.prepareNavigation?.();
  useNavStore.getState().setIsNavigating(true);
}

function setPosition(position: LatLng | null): void {
  useUserLocationStore.setState({ position });
}

// 路線沿台北 121.52 經線往北；台中的定位離路線遠，開場就是預覽
const legs = [{ type: 'WALK', polyline: [[121.52, 25.04], [121.52, 25.05]] }] as never;
const walk = { routeId: 'walk', navigationId: 'nav-walk', routeVersion: 1, routeToken: 'tok-walk', legs };
const ride = { routeId: 'ride', navigationId: 'nav-ride', routeVersion: 1, routeToken: 'tok-ride', legs };

beforeAll(() => {
  setBridgeTranslate((key) => key);
  installVoiceNavigationBridge(uplink);
});

beforeEach(() => {
  useNavStore.getState().setIsNavigating(false);
  useNavStore.getState().reset();
  useIndoorStore.getState().clearRoute();
  useVoiceStore.setState({ isMuted: false });
  setPosition({ lat: 25.04, lng: 121.52 });
  configureVoiceJourneyNavigation(fakeBeginJourney);
  fakeRouteStore.setState({ indoorRoute: null, navigationRoute: null, computeRoutes: [walk, ride], selectRoute: { route: walk } });
  uplink.getStatus.mockReturnValue('listening');
  jest.clearAllMocks();
});

describe('voice ui.command uses the App navigation flow', () => {
  it('starts the requested route through the button flow and reports live guidance on the route', async () => {
    expect(await handleVoiceUiCommand({ action: 'start', routeToken: 'tok-ride' })).toEqual({ ok: true, guidance: 'live' });
    expect(mockBegin).toHaveBeenCalledTimes(1);
    expect(fakeRouteStore.getState().selectRoute?.route.routeToken).toBe('tok-ride');
    expect(mockCloseChat).toHaveBeenCalled();
    // 後端只拿這條路線做警報追蹤
    expect(uplink.startNavigation).toHaveBeenCalledWith('tok-ride', expect.objectContaining({ latitude: 25.04 }));
  });

  it('reports preview when the user is far from the route, like the button does', async () => {
    setPosition({ lat: 24.14, lng: 120.68 });
    expect(await handleVoiceUiCommand({ action: 'start', routeToken: 'tok-walk' })).toEqual({ ok: true, guidance: 'preview' });
  });

  it('refuses a route the screen does not have', async () => {
    expect(await handleVoiceUiCommand({ action: 'start', routeToken: 'tok-gone' })).toEqual({ ok: false, reason: 'ROUTE_NOT_FOUND' });
    expect(mockBegin).not.toHaveBeenCalled();
  });

  it('after a manual exit a newly planned route starts again', async () => {
    await handleVoiceUiCommand({ action: 'start', routeToken: 'tok-walk' });
    await handleVoiceUiCommand({ action: 'stop' });
    expect(mockEnd).toHaveBeenCalledTimes(1);
    expect(uplink.cancelNavigation).toHaveBeenCalledTimes(1);
    fakeRouteStore.setState({ computeRoutes: [{ ...ride, routeToken: 'tok-new' }] });
    expect(await handleVoiceUiCommand({ action: 'start', routeToken: 'tok-new' })).toMatchObject({ ok: true });
    expect(mockBegin).toHaveBeenCalledTimes(2);
  });

  it('switching to another route ends the current navigation first', async () => {
    await handleVoiceUiCommand({ action: 'start', routeToken: 'tok-walk' });
    expect(await handleVoiceUiCommand({ action: 'start', routeToken: 'tok-ride' })).toMatchObject({ ok: true });
    expect(mockEnd).toHaveBeenCalledTimes(1);
    expect(fakeRouteStore.getState().selectRoute?.route.routeToken).toBe('tok-ride');
  });

  it('only advances indoor steps', async () => {
    expect(await handleVoiceUiCommand({ action: 'advance' })).toEqual({ ok: false, reason: 'NOT_AN_INDOOR_STEP' });
  });

  it('text chat starts the named candidate or the selected route', async () => {
    expect(await runNavigationControl({ action: 'start', routeId: 'ride' })).toMatchObject({ ok: true });
    expect(fakeRouteStore.getState().selectRoute?.route.routeId).toBe('ride');
    expect(await runNavigationControl({ action: 'stop' })).toEqual({ ok: true });
    expect(await runNavigationControl({ action: 'start' })).toMatchObject({ ok: true });
  });
});

describe('engine state and speech', () => {
  it('reports the engine state the assistant answers from', async () => {
    await handleVoiceUiCommand({ action: 'start', routeToken: 'tok-walk' });
    useNavStore.getState().setInstructions([
      { text: '沿三民路直行', type: 'depart', bearing: null, relativeDirection: null, distanceM: 300, streetName: '三民路', legType: 'MOTORCYCLE', polylineIndex: 0 },
      { text: '左轉進入民生路', type: 'turn', bearing: null, relativeDirection: null, distanceM: 200, streetName: '民生路', legType: 'MOTORCYCLE', polylineIndex: 4 },
    ] as never, [], 0);
    useNavStore.getState().setDistanceToNextM(120);
    expect(currentNavigationState()).toMatchObject({
      active: true,
      currentStepIndex: 0,
      distanceToNextM: 120,
      steps: [{ instruction: '沿三民路直行' }, { instruction: '左轉進入民生路', streetName: '民生路' }],
    });
    expect(uplink.sendNavigationState).toHaveBeenLastCalledWith(expect.objectContaining({ active: true }));
  });

  it('tells the assistant what the waiting card shows, and resends when it changes', async () => {
    await handleVoiceUiCommand({ action: 'start', routeToken: 'tok-walk' });
    useNavStore.getState().setTransitGuide({ phase: 'waiting', routeName: '26', boardStop: '黎明文心南五路口', waitMinutes: null, scheduledAt: '10:30' });
    expect(uplink.sendNavigationState).toHaveBeenLastCalledWith(expect.objectContaining({
      busWait: { routeName: '26', stop: '黎明文心南五路口', waitMinutes: null, expectedAt: '10:30' },
    }));
    useNavStore.getState().setTransitGuide({ phase: 'waiting', routeName: '26', boardStop: '黎明文心南五路口', waitMinutes: 3 });
    expect(uplink.sendNavigationState).toHaveBeenLastCalledWith(expect.objectContaining({
      busWait: { routeName: '26', stop: '黎明文心南五路口', waitMinutes: 3 },
    }));
    useNavStore.getState().setTransitGuide({ phase: 'riding', routeName: '26', alightStop: 'B', stopsLeft: 3, minutes: 8, minutesSource: 'realtime' });
    expect(currentNavigationState()).not.toHaveProperty('busWait');
  });

  it('sends the HUD speed limit in exactly the strict nav.state shape, resends on change and omits it off a vehicle leg', async () => {
    await handleVoiceUiCommand({ action: 'start', routeToken: 'tok-walk' });
    useNavStore.getState().setInstructions([
      { text: '向左轉進入「忠孝西路二段」，請走左邊數來第二車道', type: 'turn', bearing: null, relativeDirection: null, distanceM: 344, streetName: '忠孝西路二段', legType: 'DRIVE', polylineIndex: 4 },
    ] as never, [], 0);
    expect(currentNavigationState()).not.toHaveProperty('speedLimit');
    expect(currentNavigationState().steps?.[0]?.instruction).toBe('向左轉進入「忠孝西路二段」，請走左邊數來第二車道');

    useNavStore.getState().setRoadGuidance({ kind: 'known', limitKph: 50 }, null);
    const sent = uplink.sendNavigationState.mock.lastCall?.[0];
    expect(sent.speedLimit).toStrictEqual({ kind: 'known', limitKph: 50 });

    useNavStore.getState().setRoadGuidance({ kind: 'unknown', limitKph: null }, null);
    expect(uplink.sendNavigationState.mock.lastCall?.[0].speedLimit).toStrictEqual({ kind: 'unknown', limitKph: null });
    useNavStore.getState().setRoadGuidance({ kind: 'unlimited', limitKph: null }, null);
    expect(uplink.sendNavigationState.mock.lastCall?.[0].speedLimit).toStrictEqual({ kind: 'unlimited', limitKph: null });

    useNavStore.getState().setRoadGuidance(null, null);
    expect(uplink.sendNavigationState.mock.lastCall?.[0]).not.toHaveProperty('speedLimit');
  });

  it('hands engine announcements to the live assistant (swallowed while muted), and to local TTS without voice', async () => {
    expect(speechOwner.cueChannelLive?.()).toBe(true);
    expect(speechOwner.speakCue?.('100 公尺後左轉')).toBe(true);
    expect(uplink.sendNavigationCue).toHaveBeenCalledWith('100 公尺後左轉');
    useVoiceStore.setState({ isMuted: true });
    expect(speechOwner.speakCue?.('左轉')).toBe(true);
    expect(uplink.sendNavigationCue).toHaveBeenCalledTimes(1);
    useVoiceStore.setState({ isMuted: false });
    uplink.getStatus.mockReturnValue('idle');
    expect(speechOwner.cueChannelLive?.()).toBe(false);
    expect(speechOwner.speakCue?.('左轉')).toBe(false);
  });

  it('repeat re-sends the current step as a cue', async () => {
    await handleVoiceUiCommand({ action: 'start', routeToken: 'tok-walk' });
    useNavStore.getState().setInstructions([
      { text: '向北出發', type: 'depart', bearing: null, relativeDirection: null, distanceM: 40, streetName: null, legType: 'WALK', polylineIndex: 0 },
    ] as never, [], 0);
    expect(await handleVoiceUiCommand({ action: 'repeat' })).toEqual({ ok: true });
    expect(uplink.sendNavigationCue).toHaveBeenCalledWith('向北出發');
  });
});
