import { router } from 'expo-router';
import { changeAppLanguage } from '@/shared/i18n';
import { useRouteSessionStore } from '../../store/routeSessionStore';
import { act, renderHook } from '@testing-library/react-native';
import { routePlanFixture } from '@/features/ai/domain/testing/routePlanFixture';
import { getAccessibleRoute } from '../../api/route';
import { applyAiRoutePlan, endRouteSession } from '../../controller/routeSessionPort';
import { useRoutePlanViewModel } from '../useRoutePlanViewModel';
import { venueHandoffFixture } from '../../domain/testing/venueHandoffFixture';
import { planVenueRoute } from '@/shared/venue';
import { resolveVenuePlace } from '@/features/place/hooks/venuePlaceCatalog';
import { toVenuePlaceDetail } from '@/features/place/domain/venuePlace';
import { createVenueDetail, createVenueRoute } from '@/features/indoor/domain/fixtures/venueFixture';
import type { VenuePlaceDetail } from '@/features/place/types/place';

jest.mock('@/features/map', () => jest.requireActual('@/features/navigation/controller/testing/fakeMap').mapModule);
jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), push: jest.fn() } }));
jest.mock('@/features/place', () => ({ useAutocomplete: () => ({ suggestions: [], loading: false, resetSession: jest.fn() }) }));
jest.mock('@/features/onboarding', () => ({
  useOnboardingStore: (select: (state: unknown) => unknown) => select({ profile: { routeMode: 'normal', avoidStairs: false, requireElevator: false } }),
}));
jest.mock('@/shared/i18n', () => ({
  __esModule: true,
  ...jest.requireActual('@/shared/i18n'),
  useAppTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../api/route', () => ({ getAccessibleRoute: jest.fn() }));
jest.mock('@/shared/venue', () => ({ ...jest.requireActual('@/shared/venue'), planVenueRoute: jest.fn() }));
jest.mock('@/features/place/hooks/venuePlaceCatalog', () => ({ resolveVenuePlace: jest.fn() }));

beforeEach(async () => { await changeAppLanguage('zh-TW'); endRouteSession(); jest.clearAllMocks(); });

function indoorEndpoints() {
  const detail = createVenueDetail();
  return detail.places.map((place) => toVenuePlaceDetail(detail, place));
}

it('automatically plans indoor endpoints without GPS, hides outdoor controls and opens the existing detail route', async () => {
  const [origin, destination] = indoorEndpoints();
  useRouteSessionStore.getState().setVenueEndpoint('origin', origin);
  useRouteSessionStore.getState().setVenueEndpoint('destination', destination);
  jest.mocked(planVenueRoute).mockResolvedValue({ ...createVenueRoute(), mode: 'normal' });
  const { result } = await renderHook(() => useRoutePlanViewModel({}));
  expect(planVenueRoute).toHaveBeenCalledTimes(1);
  expect(getAccessibleRoute).not.toHaveBeenCalled();
  expect(result.current).toMatchObject({
    originLabel: origin.name, destinationLabel: destination.name, originIsMyLocation: false,
    isIndoorJourney: true, travelModes: [], facilityFilters: [], results: null,
    indoorRoute: { fromPlaceId: 'start', toPlaceId: 'end' },
  });
  await act(() => result.current.onOpenRouteDetail(0));
  expect(router.navigate).toHaveBeenCalledWith({ pathname: '/routes/[index]', params: { index: '0' } });
  await act(() => result.current.onSelectRouteMode('wheelchair'));
  expect(planVenueRoute).toHaveBeenCalledTimes(2);
  expect(planVenueRoute).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'wheelchair' }), expect.any(AbortSignal));
  await act(() => result.current.onClearDestination());
  expect(result.current.indoorRoute).toBeNull();
  expect(useRouteSessionStore.getState().originVenuePlace?.placeId).toBe('start');
});

it('resolves a venue deep link before planning and retains fresh floor/version metadata', async () => {
  const [origin, destination] = indoorEndpoints();
  useRouteSessionStore.getState().setVenueEndpoint('origin', origin);
  let resolve!: (place: VenuePlaceDetail | null) => void;
  jest.mocked(resolveVenuePlace).mockReturnValue(new Promise((done) => { resolve = done; }));
  jest.mocked(planVenueRoute).mockResolvedValue(createVenueRoute());
  const { result } = await renderHook(() => useRoutePlanViewModel({ venueId: destination.venueId, venuePlaceId: destination.placeId }));
  expect(result.current.loading).toBe(true);
  expect(planVenueRoute).not.toHaveBeenCalled();
  await act(() => resolve(destination));
  expect(useRouteSessionStore.getState().destinationVenuePlace).toMatchObject({ placeId: 'end', buildingId: 'a', levelRef: '2F', sourceVersion: 3 });
  expect(planVenueRoute).toHaveBeenCalledTimes(1);
});

it('replans when an incomplete origin is restored, while reselecting an unchanged room retains the result', async () => {
  const [origin, destination] = indoorEndpoints();
  useRouteSessionStore.getState().setVenueEndpoint('origin', origin);
  useRouteSessionStore.getState().setVenueEndpoint('destination', destination);
  jest.mocked(planVenueRoute).mockResolvedValue(createVenueRoute());
  const { result } = await renderHook(() => useRoutePlanViewModel({}));
  expect(planVenueRoute).toHaveBeenCalledTimes(1);
  await act(() => useRouteSessionStore.getState().setVenueEndpoint('destination', destination));
  expect(result.current.indoorRoute).not.toBeNull();
  expect(planVenueRoute).toHaveBeenCalledTimes(1);
  await act(() => result.current.onClearOrigin());
  expect(result.current.indoorRoute).toBeNull();
  await act(() => useRouteSessionStore.getState().setVenueEndpoint('origin', origin));
  expect(planVenueRoute).toHaveBeenCalledTimes(2);
  expect(result.current.indoorRoute).not.toBeNull();
});

it('an abandoned venue deep link cannot overwrite a later endpoint or revive an ended session', async () => {
  const [, destination] = indoorEndpoints();
  let resolve!: (place: VenuePlaceDetail | null) => void;
  jest.mocked(resolveVenuePlace).mockReturnValue(new Promise((done) => { resolve = done; }));
  const { result } = await renderHook(() => useRoutePlanViewModel({ venueId: destination.venueId, venuePlaceId: destination.placeId }));
  const signal = jest.mocked(resolveVenuePlace).mock.calls[0][1];
  await act(() => endRouteSession());
  expect(signal?.aborted).toBe(true);
  await act(() => resolve(destination));
  expect(useRouteSessionStore.getState().destinationVenuePlace).toBeNull();
  expect(result.current.indoorRoute).toBeNull();
  expect(planVenueRoute).not.toHaveBeenCalled();
});

it('replans the same indoor destination by identity after changing the origin', async () => {
  const plan = routePlanFixture();
  const { arrival, leg, destinationName } = venueHandoffFixture();
  useRouteSessionStore.setState({
    origin: plan.origin, destination: arrival.gateLocation, destinationName,
    destinationVenuePlace: { venueId: arrival.venueId, placeId: arrival.placeId },
  });
  jest.mocked(getAccessibleRoute).mockResolvedValue({ ok: true, status: 'success', code: 200, message: '',
    data: { ...plan, destination: arrival.gateLocation, venueArrival: arrival, venueLeg: leg } });
  const { result } = await renderHook(() => useRoutePlanViewModel({}));
  expect(result.current.destinationLabel).toBe(destinationName);
  expect(result.current.swapDisabled).toBe(false);
  expect(result.current.venueHandoff?.leg).toBe(leg);
  await act(() => useRouteSessionStore.getState().setOrigin({ lat: 24.14, lng: 120.67 }, '新起點'));
  expect(getAccessibleRoute).toHaveBeenLastCalledWith(expect.objectContaining({
    origin: { latitude: 24.14, longitude: 120.67 },
    destinationVenuePlace: { venueId: arrival.venueId, placeId: arrival.placeId },
  }), expect.any(AbortSignal));
  expect(jest.mocked(getAccessibleRoute).mock.calls.at(-1)?.[0].destination).toBeUndefined();
});

it.each(['origin', 'destination'] as const)('opens a separate search sheet for %s', async (field) => {
  const { result } = await renderHook(() => useRoutePlanViewModel({}));
  await act(() => result.current.onEdit(field));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/route-location-search', params: { field } });
});

it('stores locale in the result key but retains the selected route without automatic translation replanning', async () => {
  const plan = routePlanFixture();
  useRouteSessionStore.getState().setOrigin(plan.origin, 'Origin');
  useRouteSessionStore.getState().setDestination(plan.destination, 'Destination');
  jest.mocked(getAccessibleRoute).mockResolvedValue({ ok: true, status: 'success', code: 200, message: '', data: plan });
  const { result, rerender } = await renderHook(() => useRoutePlanViewModel({}));
  expect(useRouteSessionStore.getState().computedFor).toContain('language:zh-TW');
  expect(result.current.results?.routes).toEqual(plan.routes);
  const selected = useRouteSessionStore.getState().selectRoute;
  await act(async () => { await changeAppLanguage('en'); });
  await rerender({});
  expect(getAccessibleRoute).toHaveBeenCalledTimes(1);
  expect(useRouteSessionStore.getState().selectRoute).toBe(selected);
  expect(result.current.results?.routes).toEqual(plan.routes);
  await act(() => result.current.onStart());
  expect(getAccessibleRoute).toHaveBeenCalledTimes(2);
  expect(jest.mocked(getAccessibleRoute).mock.calls[1][0].language).toBe('en');
  expect(useRouteSessionStore.getState().computedFor).toContain('language:en');
});

it('opening an AI plan preserves the selected candidate and conditions without planning again', async () => {
  const plan = routePlanFixture();
  applyAiRoutePlan(plan);
  const { result } = await renderHook(() => useRoutePlanViewModel({}));
  expect(result.current.results).toEqual({ routes: plan.routes, selectedIndex: 1 });
  expect(result.current.originLabel).toBe(plan.origin.name);
  expect(result.current.routeModes.find((mode) => mode.selected)?.value).toBe('wheelchair');
  expect(getAccessibleRoute).not.toHaveBeenCalled();
});

it('only the explicit replan action requests a new route', async () => {
  const plan = routePlanFixture();
  applyAiRoutePlan(plan);
  jest.mocked(getAccessibleRoute).mockResolvedValue({ ok: true, status: 'success', code: 200, message: '', data: plan });
  const { result } = await renderHook(() => useRoutePlanViewModel({}));
  await act(() => result.current.onStart());
  expect(getAccessibleRoute).toHaveBeenCalledTimes(1);
  expect(getAccessibleRoute).toHaveBeenCalledWith(expect.objectContaining({
    mode: 'wheelchair', travelMode: 'transit', avoidStairs: true,
    transitPreference: plan.effectivePreferences.transitPreference,
    departureTime: plan.effectivePreferences.departureTime,
    maxTransfers: plan.effectivePreferences.maxTransfers,
  }), expect.any(AbortSignal));
});
