import type { AccessibleRoute } from '@/features/route/domain';
import { getRouteSessionSnapshot } from '@/features/route';
import { useRouteSessionStore } from '@/features/route/store/routeSessionStore';
import { useNavStore } from '@/features/navigation/store/navStore';
import { localRerouteCoordinator } from '@/features/navigation/controller/localRerouteCoordinator';
import { createNavigationController } from '@/features/navigation/controller/navigationController';
import { getNavigationSpeechOwner } from '@/features/navigation/controller/speechOwnerPort';
import { flushPromises } from '@/shared/testing/flushPromises';

import { beginNavigation, endNavigation } from '@/features/navigation';
import { useUserLocationStore } from '@/features/map';
import { useVoiceStore } from '../../store/voiceStore';
import { handleVoiceNavigationEvent, installVoiceNavigationBridge, onVoiceSessionTerminal } from '../voiceNavigationBridge';

jest.mock('@/features/ai', () => ({ closeChat: jest.requireActual('@/features/ai/controller/actionExecutor').closeChat }));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), dismiss: jest.fn(), dismissTo: jest.fn() } }));
jest.mock('@/shared/location', () => ({ startBackgroundLocation: async () => {}, stopBackgroundLocation: async () => {} }));

function route(id: string): AccessibleRoute {
  return {
    routeId: id, navigationId: id, routeVersion: 1, routeToken: `${id}-token`, routeName: id,
    totalMinutes: 10, transferCount: 0, accessibilityHighlights: [],
    legs: [{ type: 'WALK', from: 'A', to: 'B', distanceM: 500, minutesEst: 10, a11yFacilities: [], polyline: [[121.5, 25.05], [121.505, 25.05]] }],
  };
}

const uplink = {
  setNavigationRoute: jest.fn(),
  startNavigation: jest.fn(),
  sendNavigationPosition: jest.fn(),
  previewNavigationStep: jest.fn(),
  cancelNavigation: jest.fn(),
  setMuted: jest.fn(),
  getStatus: () => useVoiceStore.getState().status.status,
};

beforeAll(() => installVoiceNavigationBridge(uplink));

beforeEach(() => {
  useNavStore.getState().setIsNavigating(false);
  useNavStore.getState().reset();
  useVoiceStore.setState({ status: { status: 'idle' }, isMuted: false });
  jest.clearAllMocks();
});

it.each(['ready', 'listening', 'model-speaking', 'playback-blocked'] as const)(
  'manual beginNavigation hands speech to an already %s assistant before the local controller starts',
  async (status) => {
    const selected = route('manual');
    useRouteSessionStore.setState({ navigationRoute: null, selectRoute: { index: 0, route: selected }, computeRoutes: [selected] });
    useUserLocationStore.getState().setPosition({ lat: 25.05, lng: 121.5 });
    useVoiceStore.setState({ status: { status }, isMuted: true });
    const speech = { speak: jest.fn(), stop: jest.fn() };
    const fetchInstructions = jest.fn(async () => ({ ok: true, status: 'success' as const, code: 200, message: 'ok', data: { instructions: [], initialBearing: 90, totalSteps: 0, warnings: [] } }));
    const controller = createNavigationController({
      speech, reroute: localRerouteCoordinator,
      location: { getCurrent: async () => ({ lat: 25.05, lng: 121.5, heading: 90, accuracy: 5, speed: 1, timestamp: 0 }) },
      visibility: { isActive: () => true, subscribe: () => () => {} },
      language: () => 'zh-TW', arrivedText: () => '已抵達', fetchInstructions,
    });
    const unsubscribe = useNavStore.subscribe((state, previous) => {
      if (state.isNavigating && !previous.isNavigating) controller.start();
    });
    try {
      beginNavigation({ notificationTitle: '導航', notificationBody: '導航中' });
      await flushPromises();
      expect(useNavStore.getState()).toMatchObject({ isNavigating: true, navigationSource: 'voice', voiceEnabled: false });
      expect(uplink.startNavigation).toHaveBeenCalledWith('manual-token', { latitude: 25.05, longitude: 121.5 });
      expect(speech.speak).not.toHaveBeenCalled();
      expect(fetchInstructions).not.toHaveBeenCalled();
      expect(useVoiceStore.getState().isMuted).toBe(true);
      handleVoiceNavigationEvent({ type: 'nav.start', currentStepIndex: 0, totalSteps: 1, steps: [{ index: 0, instruction: '向東直走', legType: 'WALK', distanceM: 500, isTransit: false }] }, status);
      expect(uplink.startNavigation).toHaveBeenCalledTimes(1);
      endNavigation();
      expect(uplink.cancelNavigation).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
      controller.stop();
      endNavigation();
    }
  },
);

it('lets the assistant read a far route as a preview and switches to live once the user is near', async () => {
  const selected = route('far');
  useRouteSessionStore.setState({ navigationRoute: null, selectRoute: { index: 0, route: selected }, computeRoutes: [selected] });
  useUserLocationStore.getState().setPosition({ lat: 24.15, lng: 120.68 });
  useVoiceStore.setState({ status: { status: 'listening' } });
  const speech = { speak: jest.fn(), stop: jest.fn() };
  const controller = createNavigationController({
    speech, reroute: localRerouteCoordinator,
    location: { getCurrent: async () => ({ lat: 24.15, lng: 120.68, heading: 90, accuracy: 5, speed: 1, timestamp: 0 }) },
    visibility: { isActive: () => true, subscribe: () => () => {} },
    language: () => 'zh-TW', arrivedText: () => '已抵達', fetchInstructions: jest.fn(),
    geminiOwnsSpeech: () => getNavigationSpeechOwner().geminiOwnsSpeech(),
  });
  const unsubscribe = useNavStore.subscribe((state, previous) => {
    if (state.isNavigating && !previous.isNavigating) controller.start();
  });
  try {
    beginNavigation({ notificationTitle: '導航', notificationBody: '導航中' });
    await flushPromises();
    expect(useNavStore.getState()).toMatchObject({ navigationSource: 'voice', stepMode: 'preview' });
    expect(uplink.startNavigation).toHaveBeenCalledWith('far-token', { latitude: 24.15, longitude: 120.68 });
    handleVoiceNavigationEvent({ type: 'nav.start', currentStepIndex: 0, totalSteps: 2, steps: [
      { index: 0, instruction: '向東直走', legType: 'WALK', distanceM: 300, isTransit: false },
      { index: 1, instruction: '抵達B', legType: 'WALK', distanceM: 200, isTransit: false },
    ] }, 'listening');
    expect(useNavStore.getState()).toMatchObject({ remainingM: 500, routeTotalM: 500, remainingDurationSec: null });

    useNavStore.getState().selectPreviewStep(1);
    expect(useNavStore.getState().currentStepIndex).toBe(1);
    expect(uplink.previewNavigationStep).toHaveBeenCalledWith(1);
    expect(speech.speak).not.toHaveBeenCalled();

    useUserLocationStore.getState().setPosition({ lat: 25.05, lng: 121.502 });
    await flushPromises();
    expect(useNavStore.getState().stepMode).toBe('live');
    useNavStore.getState().selectPreviewStep(0);
    expect(useNavStore.getState().currentStepIndex).toBe(1);
  } finally {
    unsubscribe();
    controller.stop();
    endNavigation();
    useUserLocationStore.getState().setPosition({ lat: 25.05, lng: 121.5 });
  }
});

it.each(['idle', 'ended', 'error', 'needs-login', 'connecting', 'reconnecting'] as const)(
  'manual navigation keeps system speech when the assistant is %s', (status) => {
    const selected = route('local');
    useRouteSessionStore.setState({ navigationRoute: null, selectRoute: { index: 0, route: selected }, computeRoutes: [selected] });
    useVoiceStore.setState({ status: { status } });
    beginNavigation({ notificationTitle: '導航', notificationBody: '導航中' });
    expect(useNavStore.getState()).toMatchObject({ isNavigating: true, navigationSource: 'local', voiceEnabled: true });
    expect(uplink.startNavigation).not.toHaveBeenCalled();
    endNavigation();
  },
);

it('preserves rejection of a tokenless route and does not request AI navigation', () => {
  const selected = { ...route('legacy'), routeToken: undefined };
  useRouteSessionStore.setState({ navigationRoute: null, selectRoute: { index: 0, route: selected }, computeRoutes: [selected] });
  useVoiceStore.setState({ status: { status: 'listening' } });
  beginNavigation({ notificationTitle: '導航', notificationBody: '導航中' });
  expect(useNavStore.getState()).toMatchObject({ isNavigating: false, navigationSource: 'local', voiceEnabled: false });
  expect(uplink.startNavigation).not.toHaveBeenCalled();
});

it('returns a rejected manual AI start to system navigation without ending the route', () => {
  const selected = route('rejected');
  useRouteSessionStore.setState({ navigationRoute: null, selectRoute: { index: 0, route: selected }, computeRoutes: [selected] });
  useVoiceStore.setState({ status: { status: 'listening' } });
  beginNavigation({ notificationTitle: '導航', notificationBody: '導航中' });
  handleVoiceNavigationEvent({ type: 'nav.error', code: 'NAV_ROUTE_INVALID', message: '路線失效' }, 'listening');
  expect(useNavStore.getState()).toMatchObject({ isNavigating: true, navigationSource: 'local', voiceEnabled: true });
  endNavigation();
});

it('resumes active A while viewing B through the real route store and returns speech to the real local controller', async () => {
  const active = route('A');
  const viewed = route('B');
  useRouteSessionStore.setState({ navigationRoute: { index: 0, route: active }, selectRoute: { index: 1, route: viewed }, computeRoutes: [active, viewed] });
  useNavStore.getState().reset();
  useNavStore.setState({ isNavigating: true, navigationSource: 'voice', navigationId: 'A', routeVersion: 1, voiceEnabled: false });
  handleVoiceNavigationEvent({
    type: 'nav.resume_ok', navigationId: 'A', routeVersion: 1, routeToken: 'renewed-A', currentStepIndex: 0, totalSteps: 1, onVehicle: false,
    steps: [{ index: 0, legIndex: 0, instruction: '向東直走', type: 'depart', legType: 'WALK', distanceM: 500, isTransit: false }],
  }, 'listening');
  expect(getRouteSessionSnapshot().navigationRoute?.route.routeToken).toBe('renewed-A');
  expect(getRouteSessionSnapshot().selectRoute?.route).toBe(viewed);
  expect(getRouteSessionSnapshot().computeRoutes?.map((r) => r.routeToken)).toEqual(['renewed-A', 'B-token']);

  const speech = { speak: jest.fn(), stop: jest.fn() };
  const controller = createNavigationController({
    speech,
    reroute: localRerouteCoordinator,
    location: { getCurrent: async () => ({ lat: 25.05, lng: 121.5, heading: 90, accuracy: 5, speed: 1, timestamp: 0 }) },
    visibility: { isActive: () => true, subscribe: () => () => {} },
    language: () => 'zh-TW', arrivedText: () => '已抵達',
    fetchInstructions: jest.fn(async () => ({ ok: true, status: 'success' as const, code: 200, message: 'ok', data: { instructions: useNavStore.getState().instructions, initialBearing: 90, totalSteps: 1, warnings: [] } })),
  });
  controller.start();
  try {
    await flushPromises();
    handleVoiceNavigationEvent({ type: 'nav.step', currentStepIndex: 0, instruction: '向東直走', remainingM: 500 }, 'listening');
    expect(speech.speak).not.toHaveBeenCalled();
    onVoiceSessionTerminal();
    await flushPromises();
    expect(useNavStore.getState()).toMatchObject({ isNavigating: true, navigationSource: 'local', voiceEnabled: true });
    expect(speech.speak).toHaveBeenCalled();
  } finally {
    controller.stop();
  }
});
