import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import NavigationSheet from '@/app/(sheet)/navigation';
import { loadVenue } from '@/features/indoor/api/venueApi';
import { createVenueDetail, createVenueRoute } from '@/features/indoor/domain/fixtures/venueFixture';
import { useIndoorStore } from '@/features/indoor/store/indoorStore';
import { stopNavigationForVenueHandoff } from '@/features/navigation';
import { endRouteSession, getVenueHandoff, selectRouteAt } from '@/features/route';
import { useRouteSessionStore } from '@/features/route/store/routeSessionStore';
import type { AccessibleRoute } from '@/features/route/types/route';
import type { VenueDetail } from '@/features/indoor/types/venue';
import { changeAppLanguage } from '@/shared/i18n';

jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), dismissTo: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: { Screen: () => null },
}));
jest.mock('@/features/map', () => ({ sheetController: { raiseTo: jest.fn() }, PINNED_FACILITY_CATEGORIES: ['elevator', 'toilet', 'ramp'] }));
jest.mock('@/features/indoor', () => ({
  useIndoorStore: jest.requireActual('@/features/indoor/store/indoorStore').useIndoorStore,
  IndoorNavigationContent: jest.requireActual('@/features/indoor/components/IndoorNavigationContent').default,
}));
jest.mock('@/features/navigation', () => ({
  NavigationStepsScreen: () => null,
  stopNavigationForVenueHandoff: jest.fn(),
}));
jest.mock('@/features/route', () => ({
  getRouteSessionSnapshot: () => jest.requireActual('@/features/route/store/routeSessionStore').useRouteSessionStore.getState(),
  useRouteSession: (selector: (state: unknown) => unknown) => jest.requireActual('@/features/route/store/routeSessionStore').useRouteSessionStore(selector),
  endRouteSession: jest.fn(() => jest.requireActual('@/features/route/store/routeSessionStore').useRouteSessionStore.getState().endRouteSession()),
  selectRouteAt: jest.fn((index: number) => jest.requireActual('@/features/route/store/routeSessionStore').useRouteSessionStore.getState().selectRouteIndex(index)),
  getVenueHandoff: jest.fn(),
}));
jest.mock('@/features/indoor/api/venueApi', () => ({ loadVenue: jest.fn(), loadVenues: jest.fn() }));
jest.mock('@/shared/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return { Button: ({ label, onPress }: { label: string; onPress: () => void }) => React.createElement(RN.Pressable, { onPress, accessibilityRole: 'button', accessibilityLabel: label }, React.createElement(RN.Text, null, label)) };
});

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(stopNavigationForVenueHandoff).mockReset();
  jest.mocked(getVenueHandoff).mockReset();
  jest.mocked(loadVenue).mockReset();
  useRouteSessionStore.setState(useRouteSessionStore.getInitialState());
  useIndoorStore.getState().exitVenue();
  jest.mocked(loadVenue).mockResolvedValue(createVenueDetail());
  jest.mocked(useLocalSearchParams).mockReturnValue({ indoor: 'start' });
  await act(async () => { await changeAppLanguage('zh-TW'); });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function handoffSession() {
  const leg = createVenueRoute();
  const routes: AccessibleRoute[] = [0, 1, 2].map((index) => ({
    routeId: `outdoor-${index}`, routeName: `route ${index}`, routeToken: `token-${index}`,
    legs: [], totalMinutes: index + 1, transferCount: 0, accessibilityHighlights: [],
  }));
  const handoff = {
    leg, destinationName: '終點空間',
    arrival: { venueId: leg.venueId, placeId: leg.toPlaceId, gateId: leg.fromPlaceId, gateLocation: { lat: 25, lng: 121 }, mode: leg.mode, venueVersion: leg.venueVersion },
  };
  useRouteSessionStore.setState({ computeRoutes: routes, selectRoute: { index: 0, route: routes[0] }, navigationRoute: { index: 2, route: routes[2] }, navigationVenueHandoff: handoff });
  jest.mocked(useLocalSearchParams).mockReturnValue({ indoor: 'handoff' });
  jest.mocked(getVenueHandoff).mockReturnValue(handoff);
  jest.mocked(stopNavigationForVenueHandoff).mockImplementation(() => {
    useRouteSessionStore.setState({ navigationRoute: null, navigationVenueHandoff: null });
    jest.mocked(getVenueHandoff).mockReturnValue({ ...handoff, leg: { ...leg, distanceM: 999 } });
  });
  return { leg, routes };
}

it('starts the route-session indoor result in the existing navigation screen and returns to its original details', async () => {
  const route = createVenueRoute();
  useRouteSessionStore.setState({ indoorRoute: route });
  const view = await render(<NavigationSheet />);
  await waitFor(() => expect(useIndoorStore.getState().guidance.status).toBe('guiding'));
  expect(useIndoorStore.getState().plan).toEqual({ status: 'ready', data: route });
  expect(router.navigate).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: '確認已在起點' }));
  expect(useIndoorStore.getState().guidance).toMatchObject({ stepIndex: 1 });
  await fireEvent.press(view.getByRole('button', { name: '結束導航' }));
  expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/routes/[index]', params: { index: '0' } });
  expect(useRouteSessionStore.getState().indoorRoute).toBe(route);
});

it('captures the outdoor-to-indoor leg before stopping GPS, then continues in the same screen', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ indoor: 'handoff' });
  const route = createVenueRoute();
  jest.mocked(getVenueHandoff).mockReturnValue({
    leg: route, destinationName: '終點空間',
    arrival: { venueId: route.venueId, placeId: route.toPlaceId, gateId: route.fromPlaceId, gateLocation: { lat: 25, lng: 121 }, mode: route.mode, venueVersion: route.venueVersion },
  });
  jest.mocked(stopNavigationForVenueHandoff).mockImplementation(() => { jest.mocked(getVenueHandoff).mockReturnValue(null); });
  await render(<NavigationSheet />);
  await waitFor(() => expect(useIndoorStore.getState().guidance.status).toBe('guiding'));
  expect(stopNavigationForVenueHandoff).toHaveBeenCalledTimes(1);
  expect(useIndoorStore.getState().plan).toEqual({ status: 'ready', data: route });
  expect(router.navigate).not.toHaveBeenCalled();
});

it('invalidates stale results and endpoints before returning to planning on a changed building version', async () => {
  useRouteSessionStore.setState({ indoorRoute: createVenueRoute(), computedFor: 'old-version',
    originVenuePlace: { venueId: 'test-venue', placeId: 'start', sourceVersion: 3 },
    destinationVenuePlace: { venueId: 'test-venue', placeId: 'end', sourceVersion: 3 },
  });
  jest.mocked(loadVenue).mockResolvedValue({ ...createVenueDetail(), version: 4 });
  const view = await render(<NavigationSheet />);
  await waitFor(() => expect(view.getByText('建築資料已更新，請重新規劃路線。')).toBeTruthy());
  expect(useIndoorStore.getState().guidance.status).toBe('idle');
  expect(router.navigate).not.toHaveBeenCalled();
  expect(view.queryByRole('button', { name: '重試' })).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: '重新選擇起訖' }));
  expect(endRouteSession).toHaveBeenCalledTimes(1);
  expect(useRouteSessionStore.getState()).toMatchObject({ indoorRoute: null, computedFor: null, originVenuePlace: null, destinationVenuePlace: null });
  expect(router.dismissTo).toHaveBeenCalledWith('/plan');
});

it('retries the captured pinned handoff and returns to its navigated route, not the visible candidate', async () => {
  const { leg, routes } = handoffSession();
  jest.mocked(loadVenue).mockRejectedValueOnce(new Error('offline'));
  const view = await render(<NavigationSheet />);
  await waitFor(() => expect(view.getByRole('button', { name: '重試' })).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: '重試' }));
  await waitFor(() => expect(useIndoorStore.getState().guidance.status).toBe('guiding'));
  expect(useIndoorStore.getState().plan).toEqual({ status: 'ready', data: leg });
  expect(stopNavigationForVenueHandoff).toHaveBeenCalledTimes(1);
  expect(endRouteSession).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: '結束導航' }));
  expect(selectRouteAt).toHaveBeenCalledWith(2);
  expect(useRouteSessionStore.getState().selectRoute?.route).toBe(routes[2]);
  expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/routes/[index]', params: { index: '2' } });
});

it('returns to planning when the navigated outdoor route is no longer in the current results', async () => {
  const { routes } = handoffSession();
  const view = await render(<NavigationSheet />);
  await waitFor(() => expect(useIndoorStore.getState().guidance.status).toBe('guiding'));
  await act(async () => { useRouteSessionStore.setState({ computeRoutes: [routes[0]] }); });
  await fireEvent.press(view.getByRole('button', { name: '結束導航' }));
  expect(selectRouteAt).not.toHaveBeenCalled();
  expect(router.dismissTo).toHaveBeenCalledWith('/plan');
});

it.each(['cancel', 'replace'] as const)('does not adopt or start an old route after a pending session is %s', async (action) => {
  const pending = deferred<VenueDetail>();
  useRouteSessionStore.setState({ indoorRoute: createVenueRoute() });
  jest.mocked(loadVenue).mockReturnValueOnce(pending.promise);
  const view = await render(<NavigationSheet />);
  if (action === 'cancel') {
    await fireEvent.press(view.getByRole('button', { name: '取消' }));
    expect(router.dismissTo).toHaveBeenCalledWith('/plan');
    await view.unmount();
  } else {
    await act(async () => { useRouteSessionStore.setState((state) => ({ requestSeq: state.requestSeq + 1, indoorRoute: { ...createVenueRoute(), distanceM: 999 } })); });
    expect(view.getByText('這條路線已變更，請重新規劃。')).toBeTruthy();
  }
  await act(async () => { pending.resolve(createVenueDetail()); await pending.promise; });
  expect(useIndoorStore.getState()).toMatchObject({ plan: { status: 'idle' }, guidance: { status: 'idle' } });
});

it('aborts adoption when the navigation screen unmounts before the detail response', async () => {
  const pending = deferred<VenueDetail>();
  useRouteSessionStore.setState({ indoorRoute: createVenueRoute() });
  jest.mocked(loadVenue).mockReturnValueOnce(pending.promise);
  const view = await render(<NavigationSheet />);
  await view.unmount();
  await act(async () => { pending.resolve(createVenueDetail()); await pending.promise; });
  expect(useIndoorStore.getState()).toMatchObject({ plan: { status: 'idle' }, guidance: { status: 'idle' } });
});
