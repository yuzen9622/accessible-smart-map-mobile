import { fetchRequest } from '@/shared/api';

import { fetchNearbyA11ySummary } from '../nearbyA11y';

jest.mock('@/shared/api', () => ({ fetchRequest: jest.fn() }));

const mockFetchRequest = jest.mocked(fetchRequest);

function respond(data: unknown) {
  mockFetchRequest.mockResolvedValue({ ok: true, data } as Awaited<ReturnType<typeof fetchRequest>>);
}

const summary = {
  elevator: { count: 4, nearestMeters: 24 },
  ramp: { count: 0, nearestMeters: null },
  toilet: { count: 4, nearestMeters: 42 },
};

describe('fetchNearbyA11ySummary', () => {
  beforeEach(() => mockFetchRequest.mockReset());

  it('sends the place extent as bbox and returns the summary', async () => {
    respond({ nearbyBathroom: [], nearbyMetroA11y: [], summary });
    const result = await fetchNearbyA11ySummary({ lat: 24.1372, lng: 120.6867 }, [120.6853, 24.1359, 120.6881, 24.1387]);
    const url = String(mockFetchRequest.mock.calls[0][0]);
    const query = new URLSearchParams(url.split('?')[1]);
    expect(url.startsWith('/api/v1/a11y/nearby-a11y?')).toBe(true);
    expect(query.get('lat')).toBe('24.1372');
    expect(query.get('lng')).toBe('120.6867');
    expect(query.get('bbox')).toBe('120.6853,24.1359,120.6881,24.1387');
    expect(result).toEqual(summary);
  });

  it('omits bbox without bounds and returns null when the backend has no summary', async () => {
    respond({ nearbyBathroom: [], nearbyMetroA11y: [] });
    const result = await fetchNearbyA11ySummary({ lat: 25, lng: 121.5 }, null);
    expect(String(mockFetchRequest.mock.calls[0][0])).not.toContain('bbox');
    expect(result).toBeNull();
  });

  it('rejects a malformed summary', async () => {
    respond({ summary: { elevator: { count: 'x' }, ramp: summary.ramp, toilet: summary.toilet } });
    expect(await fetchNearbyA11ySummary({ lat: 25, lng: 121.5 }, null)).toBeNull();
  });
});
