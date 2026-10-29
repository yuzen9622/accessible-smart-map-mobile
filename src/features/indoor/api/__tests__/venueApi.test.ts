import { ApiError, fetchRequest } from '@/shared/api';
import { loadVenue, loadVenues, planVenueRoute } from '../venueApi';
import { createVenueDetail, createVenueRoute } from '../../domain/fixtures/venueFixture';

jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), fetchRequest: jest.fn() }));
const mockFetch = jest.mocked(fetchRequest);
const envelope = (data: unknown) => ({ ok: true, status: 'success' as const, code: 200, message: 'OK', data });

beforeEach(() => mockFetch.mockReset());

test('場館清單解析data陣列，不假設包裝venues屬性', async () => {
  mockFetch.mockResolvedValue(envelope([]));
  expect(await loadVenues()).toEqual([]);
  expect(mockFetch).toHaveBeenCalledWith('/api/v1/a11y/venues', { signal: undefined });
});

test('詳細資料與選擇場館不一致時拒絕', async () => {
  mockFetch.mockResolvedValue(envelope(createVenueDetail()));
  await expect(loadVenue('other')).rejects.toMatchObject({ reason: 'INVALID_BACKEND_DATA' });
});

test('規劃只送後端strict白名單並傳遞取消signal', async () => {
  const route = createVenueRoute();
  mockFetch.mockResolvedValue(envelope(route));
  const controller = new AbortController();
  expect(await planVenueRoute(route, controller.signal)).toEqual(route);
  expect(mockFetch).toHaveBeenCalledWith('/api/v1/a11y/venues/test-venue/route', {
    method: 'POST', signal: controller.signal, timeoutMs: 15000,
    body: { fromPlaceId: 'start', toPlaceId: 'end', mode: 'wheelchair', language: 'zh-TW' },
  });
});

test('無障礙不可通行維持失敗，不改用normal重送', async () => {
  mockFetch.mockRejectedValue(new ApiError('無無障礙路線', 422, 'NO_ACCESSIBLE_ROUTE'));
  await expect(planVenueRoute(createVenueRoute())).rejects.toMatchObject({ reason: 'NO_ACCESSIBLE_ROUTE' });
  expect(mockFetch).toHaveBeenCalledTimes(1);
});
