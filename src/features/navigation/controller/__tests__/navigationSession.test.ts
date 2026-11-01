import { router } from 'expo-router';

import { sheetNavigation } from '@/features/map';
import { fitSelectedRoute, getRouteSessionSnapshot, type RouteSessionView } from '@/features/route';

import { beginNavigation, endNavigation, stopNavigationForVenueHandoff } from '../navigationSession';
import { useNavStore } from '../../store/navStore';
import { stopNavigation } from '../navigationLifecycle';
import { localRerouteCoordinator } from '../localRerouteCoordinator';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), dismiss: jest.fn(), dismissTo: jest.fn() } }));
jest.mock('@/features/map', () => ({
  ...jest.requireActual('@/features/map/controller/sheetNavigation'),
  mapCamera: { stopFollow: () => {} },
}));
jest.mock('@/features/route', () => ({ fitSelectedRoute: jest.fn(), getRouteSessionSnapshot: jest.fn() }));
jest.mock('@/shared/location', () => ({ startBackgroundLocation: async () => {}, stopBackgroundLocation: async () => {} }));
jest.mock('@/shared/logger', () => ({ logger: { warn: () => {} } }));
jest.mock('../localRerouteCoordinator', () => ({ localRerouteCoordinator: { stopSession: jest.fn() } }));
jest.mock('../navigationLifecycle', () => {
  const setNavigating = (isNavigating: boolean) => {
    const { useNavStore: store }: typeof import('../../store/navStore') = jest.requireActual('../../store/navStore');
    store.setState({ isNavigating });
  };
  return {
    startNavigation: () => {
      setNavigating(true);
      return true;
    },
    stopNavigation: jest.fn(() => setNavigating(false)),
  };
});

const texts = { notificationTitle: 'title', notificationBody: 'body' };
const navigatedRoute = { routeName: 'second' };

/** 結果裡有兩條路線、導航用第二條（只放 `endNavigation` 讀的欄位）。 */
function withSelectedRoute(): void {
  const snapshot = { computeRoutes: [{ routeName: 'first' }, navigatedRoute], selectRoute: { index: 1, route: navigatedRoute } };
  jest.mocked(getRouteSessionSnapshot).mockReturnValue(snapshot as unknown as RouteSessionView);
}

function withoutRoute(): void {
  const snapshot = { computeRoutes: null, selectRoute: null };
  jest.mocked(getRouteSessionSnapshot).mockReturnValue(snapshot as unknown as RouteSessionView);
}

beforeEach(() => {
  useNavStore.getState().reset();
  jest.mocked(stopNavigation).mockClear();
  jest.mocked(localRerouteCoordinator.stopSession).mockClear();
  jest.mocked(router.navigate).mockClear();
  jest.mocked(router.dismiss).mockClear();
  jest.mocked(router.dismissTo).mockClear();
  jest.mocked(fitSelectedRoute).mockClear();
  withSelectedRoute();
});

it('shows the navigation panel, then lands on the detail of the navigated route and keeps it on the map', () => {
  sheetNavigation.setVisible(true);
  beginNavigation(texts);
  endNavigation();

  expect(router.navigate).toHaveBeenCalledWith('/navigation');
  expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/routes/[index]', params: { index: '1' } });
  expect(fitSelectedRoute).toHaveBeenCalledTimes(1);
});

it('stops outdoor navigation for an indoor handoff without dismissing the new screen or moving its camera', () => {
  sheetNavigation.setVisible(true);
  beginNavigation(texts);
  jest.mocked(router.navigate).mockClear();
  stopNavigationForVenueHandoff();
  stopNavigationForVenueHandoff();
  expect(router.navigate).not.toHaveBeenCalled();
  expect(router.dismiss).not.toHaveBeenCalled();
  expect(router.dismissTo).not.toHaveBeenCalled();
  expect(fitSelectedRoute).not.toHaveBeenCalled();
});

it('only pops the navigation panel when the navigated route is not among the results', () => {
  withoutRoute();
  sheetNavigation.setVisible(true);
  beginNavigation(texts);
  endNavigation();

  expect(router.dismiss).toHaveBeenCalledTimes(1);
  expect(router.dismissTo).not.toHaveBeenCalled();
});

it('navigates back only once when navigation is ended twice', () => {
  sheetNavigation.setVisible(true);
  beginNavigation(texts);
  endNavigation();
  endNavigation();

  expect(router.dismissTo).toHaveBeenCalledTimes(1);
});

it('stays on the current screen after the modal closes when the navigation panel was never shown', () => {
  sheetNavigation.setVisible(false);
  beginNavigation(texts);
  endNavigation();
  expect(router.navigate).not.toHaveBeenCalled();

  sheetNavigation.setVisible(true);
  expect(router.navigate).not.toHaveBeenCalled();
  expect(router.dismiss).not.toHaveBeenCalled();
  expect(router.dismissTo).not.toHaveBeenCalled();
});


it('stops outdoor tracking at a voice venue step while retaining the voice navigation identity and instructions', () => {
  useNavStore.setState({ isNavigating: true, navigationSource: 'voice', navigationId: 'voice-trip', routeVersion: 4,
    currentStepIndex: 1, instructions: [
      { text: '前往校門', type: 'turn', legType: 'WALK', distanceM: 20, legIndex: 0, bearing: null,
        relativeDirection: null, streetName: null, polylineIndex: null },
      { text: '進入建築', type: 'turn', legType: 'VENUE', distanceM: 5, legIndex: 0, bearing: null,
        relativeDirection: null, streetName: null, polylineIndex: null, driver: 'manual', venueStepType: 'enter' },
    ],
  });
  const instructions = useNavStore.getState().instructions;
  stopNavigationForVenueHandoff();
  expect(useNavStore.getState()).toMatchObject({ isNavigating: false, navigationSource: 'voice', navigationId: 'voice-trip', routeVersion: 4 });
  expect(useNavStore.getState().instructions).toBe(instructions);
  expect(stopNavigation).not.toHaveBeenCalled();
  expect(localRerouteCoordinator.stopSession).toHaveBeenCalledTimes(1);
});
