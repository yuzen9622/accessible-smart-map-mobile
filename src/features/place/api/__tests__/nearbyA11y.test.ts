import { fetchRequest } from '@/shared/api';

import { fetchNearbyA11y } from '../nearbyA11y';
import type { PlaceBounds } from '../../types/place';

jest.mock('@/shared/api', () => ({ fetchRequest: jest.fn() }));

const mockFetchRequest = jest.mocked(fetchRequest);
const bounds: PlaceBounds = [120.6825, 24.1483, 120.6852, 24.1511];

function respond(data: unknown) {
  mockFetchRequest.mockResolvedValue({ ok: true, data } as Awaited<ReturnType<typeof fetchRequest>>);
}

const summary = {
  elevator: { count: 4, nearestMeters: 24 },
  ramp: { count: 0, nearestMeters: null },
  toilet: { count: 4, nearestMeters: 42 },
};

describe('fetchNearbyA11y', () => {
  beforeEach(() => mockFetchRequest.mockReset());

  it('sends the place extent and language and returns facilities and summary from one request', async () => {
    const nearbyBathroom = [{ _id: 'toilet-1', name: '車站無障礙廁所', address: '站內', distanceMeters: 37 }];
    const nearbyMetroA11y = [{ '項次': 'ramp-1', '出入口電梯/無障礙坡道名稱': '無障礙坡道', distanceMeters: 15 }];
    respond({ nearbyBathroom, nearbyMetroA11y, summary });
    const controller = new AbortController();
    const result = await fetchNearbyA11y({ point: { lat: 24.1372, lng: 120.6867 }, bounds: [120.6853, 24.1359, 120.6881, 24.1387], lang: 'zh-TW', signal: controller.signal });
    const url = String(mockFetchRequest.mock.calls[0][0]);
    const query = new URLSearchParams(url.split('?')[1]);
    expect(url.startsWith('/api/v1/a11y/nearby-a11y?')).toBe(true);
    expect(query.get('lat')).toBe('24.1372');
    expect(query.get('lng')).toBe('120.6867');
    expect(query.get('bbox')).toBe('120.6853,24.1359,120.6881,24.1387');
    expect(query.get('lang')).toBe('zh-TW');
    expect(mockFetchRequest).toHaveBeenCalledTimes(1);
    expect(mockFetchRequest.mock.calls[0][1]).toEqual({ signal: controller.signal });
    expect(result).toEqual({ nearbyBathroom, nearbyMetroA11y, summary });
  });

  it('keeps facilities when the backend has no summary', async () => {
    const nearbyMetroA11y = [{ '項次': '1', '出入口電梯/無障礙坡道名稱': '無障礙電梯' }];
    respond({ nearbyBathroom: [], nearbyMetroA11y });
    const result = await fetchNearbyA11y({ point: { lat: 25, lng: 121.5 }, bounds });
    expect(result).toEqual({ nearbyBathroom: [], nearbyMetroA11y, summary: null });
  });

  it('rejects a malformed summary without losing valid facilities', async () => {
    respond({ nearbyBathroom: [{ name: '廁所' }], nearbyMetroA11y: [], summary: { elevator: { count: 'x' }, ramp: summary.ramp, toilet: summary.toilet } });
    expect(await fetchNearbyA11y({ point: { lat: 25, lng: 121.5 }, bounds })).toEqual({
      nearbyBathroom: [{ name: '廁所' }], nearbyMetroA11y: [], summary: null,
    });
  });

  it.each([
    { nearbyMetroA11y: [], summary },
    { nearbyBathroom: [], summary },
    { nearbyBathroom: {}, nearbyMetroA11y: [], summary },
    { nearbyBathroom: [], nearbyMetroA11y: 'invalid', summary },
  ])('preserves the valid summary when a facilities list is missing or malformed', async (data) => {
    respond(data);
    expect(await fetchNearbyA11y({ point: { lat: 25, lng: 121.5 }, bounds })).toEqual({
      nearbyBathroom: [], nearbyMetroA11y: [], summary,
    });
  });

  it('preserves the valid list even when another list is malformed', async () => {
    const facilities = [{ name: '電梯', distanceMeters: 30 }];
    respond({ nearbyBathroom: 'invalid', nearbyMetroA11y: facilities, summary });
    expect(await fetchNearbyA11y({ point: { lat: 25, lng: 121.5 }, bounds })).toEqual({
      nearbyBathroom: [], nearbyMetroA11y: facilities, summary,
    });
  });

  it.each([null, [], 'invalid'])('rejects a malformed response body', async (data) => {
    respond(data);
    await expect(fetchNearbyA11y({ point: { lat: 25, lng: 121.5 }, bounds })).rejects.toThrow('Invalid nearby accessibility facilities response');
  });

  it.each([undefined, null, [], [120, 24, Number.NaN, 25]])('queries around the point without bbox when bounds are missing or invalid', async (invalid) => {
    respond({ nearbyBathroom: [], nearbyMetroA11y: [], summary });
    await fetchNearbyA11y({ point: { lat: 25, lng: 121.5 }, bounds: invalid as unknown as PlaceBounds });
    const query = new URLSearchParams(String(mockFetchRequest.mock.calls[0][0]).split('?')[1]);
    expect(query.get('lat')).toBe('25');
    expect(query.get('lng')).toBe('121.5');
    expect(query.has('bbox')).toBe(false);
  });

  it('propagates request errors so callers can distinguish failures from empty results', async () => {
    mockFetchRequest.mockRejectedValue(new Error('offline'));
    await expect(fetchNearbyA11y({ point: { lat: 25, lng: 121.5 }, bounds })).rejects.toThrow('offline');
  });
});
