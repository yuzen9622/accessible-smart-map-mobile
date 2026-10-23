import type { AccessibleRoute } from '@/features/route/domain';
import { getRouteSessionSnapshot } from '@/features/route';
import { useRouteSessionStore } from '@/features/route/store/routeSessionStore';
import { useNavStore } from '@/features/navigation/store/navStore';
import { localRerouteCoordinator } from '@/features/navigation/controller/localRerouteCoordinator';
import { createNavigationController } from '@/features/navigation/controller/navigationController';
import { flushPromises } from '@/shared/testing/flushPromises';

import { handleVoiceNavigationEvent, onVoiceSessionTerminal } from '../voiceNavigationBridge';

jest.mock('@/features/ai', () => ({ closeChat: jest.requireActual('@/features/ai/controller/actionExecutor').closeChat }));

function route(id: string): AccessibleRoute {
  return {
    routeId: id, navigationId: id, routeVersion: 1, routeToken: `${id}-token`, routeName: id,
    totalMinutes: 10, transferCount: 0, accessibilityHighlights: [],
    legs: [{ type: 'WALK', from: 'A', to: 'B', distanceM: 500, minutesEst: 10, a11yFacilities: [], polyline: [[121.5, 25.05], [121.505, 25.05]] }],
  };
}

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
