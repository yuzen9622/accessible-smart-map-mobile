import { ApiError, fetchRequest, type ApiResponse } from '@/shared/api';
import { changeAppLanguage } from '@/shared/i18n';
import type { VenueRoute } from '@/shared/venue';

import { getAccessibleRoute } from '../../api/route';
import { venueHandoffFixture } from '../../domain/testing/venueHandoffFixture';
import { useRouteSessionStore } from '../../store/routeSessionStore';
import type { VenueEndpoint } from '../../types/route';
import { applyAiRoutePlan, computeRoute, endRouteSession, hasActiveRouteSession, setVenueEndpoint } from '../routeSessionPort';
import { routePlanFixture } from '@/features/ai/domain/testing/routePlanFixture';

jest.mock('@/features/map', () => ({
  mapCamera: { fitBounds: jest.fn() },
  useUserLocationStore: { getState: () => ({ position: null }) },
  PINNED_FACILITY_CATEGORIES: [],
}));
jest.mock('../../api/route', () => ({ getAccessibleRoute: jest.fn() }));
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), fetchRequest: jest.fn() }));

function endpoint(placeId: string): VenueEndpoint {
  return {
    venueId: 'test-venue', placeId, name: `Room ${placeId}`,
    position: { lat: 24.1, lng: 120.6 }, buildingId: 'info', levelRef: '2F', sourceVersion: 3,
  };
}
const from = endpoint('gate');
const to = endpoint('meeting');
const sourceRoute = (): VenueRoute => venueHandoffFixture().leg;
function response(route = sourceRoute()): ApiResponse<unknown> {
  return { ok: true, status: 'success', code: 200, message: '', data: route };
}
function deferred() {
  let resolve!: (value: ApiResponse<unknown>) => void;
  const promise = new Promise<ApiResponse<unknown>>((done) => { resolve = done; });
  return { promise, resolve };
}
const input = () => ({ originVenuePlace: from, destinationVenuePlace: to, mode: 'wheelchair' as const });

beforeEach(async () => {
  await changeAppLanguage('zh-TW');
  endRouteSession();
  jest.clearAllMocks();
  setVenueEndpoint('origin', from);
  setVenueEndpoint('destination', to);
});

it('plans two authored places without GPS using the real shared parser and no outdoor route', async () => {
  jest.mocked(fetchRequest).mockResolvedValue(response());
  const result = await computeRoute(input());
  expect(result).toEqual({ ok: true, routes: [], indoorRoute: sourceRoute() });
  expect(getAccessibleRoute).not.toHaveBeenCalled();
  expect(fetchRequest).toHaveBeenCalledWith('/api/v1/a11y/venues/test-venue/route', expect.objectContaining({
    method: 'POST', body: { fromPlaceId: 'gate', toPlaceId: 'meeting', mode: 'wheelchair', language: 'zh-TW' },
  }));
  expect(useRouteSessionStore.getState()).toMatchObject({
    originVenuePlace: from, destinationVenuePlace: to, indoorRoute: sourceRoute(), computeRoutes: null, selectRoute: null,
  });
  expect(hasActiveRouteSession()).toBe(true);
});

it('swaps room identities and metadata, clears the old route, then requests the reverse direction', async () => {
  jest.mocked(fetchRequest).mockResolvedValue(response());
  await computeRoute(input());
  useRouteSessionStore.getState().swapEndpoints();
  const state = useRouteSessionStore.getState();
  expect(state).toMatchObject({ originVenuePlace: to, destinationVenuePlace: from, originName: to.name, destinationName: from.name, indoorRoute: null });
  jest.mocked(fetchRequest).mockResolvedValue(response({ ...sourceRoute(), fromPlaceId: to.placeId, toPlaceId: from.placeId }));
  const result = await computeRoute({ originVenuePlace: state.originVenuePlace!, destinationVenuePlace: state.destinationVenuePlace!, mode: 'wheelchair' });
  expect(result.ok).toBe(true);
  expect(jest.mocked(fetchRequest).mock.calls.at(-1)?.[1]?.body).toEqual({
    fromPlaceId: 'meeting', toPlaceId: 'gate', mode: 'wheelchair', language: 'zh-TW',
  });
});

it.each(['origin', 'destination'] as const)('aborts the transport when clearing %s and rejects its late successful response', async (field) => {
  const waiting = deferred();
  jest.mocked(fetchRequest).mockReturnValue(waiting.promise);
  const running = computeRoute(input());
  const signal = jest.mocked(fetchRequest).mock.calls[0][1]?.signal;
  if (field === 'origin') useRouteSessionStore.getState().setOrigin(null);
  else useRouteSessionStore.getState().setDestination(null);
  expect(signal?.aborted).toBe(true);
  waiting.resolve(response());
  expect(await running).toEqual({ ok: false, failure: 'superseded' });
  expect(useRouteSessionStore.getState()).toMatchObject({ indoorRoute: null, computeRoutes: null, isLoading: false });
});

it('a newer room selection survives an old request even when the old response succeeds', async () => {
  const waiting = deferred();
  jest.mocked(fetchRequest).mockReturnValueOnce(waiting.promise);
  const old = computeRoute(input());
  setVenueEndpoint('destination', endpoint('another-room'));
  const newer = { ...sourceRoute(), toPlaceId: 'another-room' };
  jest.mocked(fetchRequest).mockResolvedValueOnce(response(newer));
  expect((await computeRoute({ ...input(), destinationVenuePlace: endpoint('another-room') })).ok).toBe(true);
  waiting.resolve(response());
  expect(await old).toEqual({ ok: false, failure: 'superseded' });
  expect(useRouteSessionStore.getState().indoorRoute?.toPlaceId).toBe('another-room');
});

it('changing the route mode aborts the previous transport before accepting the new profile result', async () => {
  useRouteSessionStore.getState().setRouteMode('normal');
  const waiting = deferred();
  jest.mocked(fetchRequest).mockReturnValueOnce(waiting.promise);
  const old = computeRoute({ ...input(), mode: 'normal' });
  const oldSignal = jest.mocked(fetchRequest).mock.calls[0][1]?.signal;
  useRouteSessionStore.getState().setRouteMode('wheelchair');
  expect(oldSignal?.aborted).toBe(true);
  jest.mocked(fetchRequest).mockResolvedValueOnce(response());
  expect((await computeRoute(input())).ok).toBe(true);
  waiting.resolve(response({ ...sourceRoute(), mode: 'normal' }));
  expect(await old).toEqual({ ok: false, failure: 'superseded' });
  expect(useRouteSessionStore.getState().indoorRoute?.mode).toBe('wheelchair');
});

it('does not silently drop an explicit avoid-stairs preference on normal mode', async () => {
  const normal = { ...sourceRoute(), mode: 'normal' as const, stairFlights: 1 };
  normal.steps[1] = { ...normal.steps[1], type: 'stairs' };
  jest.mocked(fetchRequest).mockResolvedValue(response(normal));
  expect(await computeRoute({ ...input(), mode: 'normal', avoidStairs: true }))
    .toEqual({ ok: false, failure: 'no-accessible-route' });
  expect(useRouteSessionStore.getState().indoorRoute).toBeNull();
});

it('cancels an indoor plan on language change and sends the current language on explicit retry', async () => {
  const waiting = deferred();
  jest.mocked(fetchRequest).mockReturnValueOnce(waiting.promise);
  const running = computeRoute(input());
  await changeAppLanguage('en');
  expect(jest.mocked(fetchRequest).mock.calls[0][1]?.signal?.aborted).toBe(true);
  waiting.resolve(response());
  expect(await running).toEqual({ ok: false, failure: 'superseded' });
  jest.mocked(fetchRequest).mockResolvedValueOnce(response());
  await computeRoute(input());
  expect(jest.mocked(fetchRequest).mock.calls.at(-1)?.[1]?.body).toMatchObject({ language: 'en' });
});

it('external cancellation does not erase endpoints or resurrect a result', async () => {
  const waiting = deferred();
  const abort = new AbortController();
  jest.mocked(fetchRequest).mockReturnValueOnce(waiting.promise);
  const running = computeRoute({ ...input(), signal: abort.signal });
  abort.abort();
  expect(jest.mocked(fetchRequest).mock.calls[0][1]?.signal?.aborted).toBe(true);
  waiting.resolve(response());
  expect(await running).toEqual({ ok: false, failure: 'superseded' });
  expect(useRouteSessionStore.getState()).toMatchObject({ originVenuePlace: from, destinationVenuePlace: to, indoorRoute: null });
});

it('fails closed for a stale version, mismatched route identity, or inaccessible route while preserving inputs', async () => {
  jest.mocked(fetchRequest).mockResolvedValueOnce(response({ ...sourceRoute(), venueVersion: 4 }));
  expect(await computeRoute(input())).toEqual({ ok: false, failure: 'stale-venue' });
  jest.mocked(fetchRequest).mockResolvedValueOnce(response({ ...sourceRoute(), toPlaceId: 'wrong-room' }));
  expect(await computeRoute(input())).toEqual({ ok: false, failure: 'failed' });
  jest.mocked(fetchRequest).mockRejectedValueOnce(new ApiError('no accessible path', 422, 'NO_ACCESSIBLE_ROUTE'));
  expect(await computeRoute(input())).toEqual({ ok: false, failure: 'no-accessible-route' });
  expect(useRouteSessionStore.getState()).toMatchObject({ originVenuePlace: from, destinationVenuePlace: to, indoorRoute: null });
});

it('never turns an indoor origin into an outdoor coordinate or crosses venues', async () => {
  expect(await computeRoute({ originVenuePlace: from, destination: { lat: 25, lng: 121 } }))
    .toEqual({ ok: false, failure: 'unsupported-venue-direction' });
  expect(await computeRoute({ ...input(), destinationVenuePlace: { ...to, venueId: 'other' } }))
    .toEqual({ ok: false, failure: 'different-venues' });
  expect(fetchRequest).not.toHaveBeenCalled();
  expect(getAccessibleRoute).not.toHaveBeenCalled();
});

it('AI adoption and ending a session clear indoor planning state', async () => {
  jest.mocked(fetchRequest).mockResolvedValue(response());
  await computeRoute(input());
  applyAiRoutePlan(routePlanFixture());
  expect(useRouteSessionStore.getState()).toMatchObject({ indoorRoute: null, originVenuePlace: null, destinationVenuePlace: null });
  endRouteSession();
  expect(hasActiveRouteSession()).toBe(false);
});
