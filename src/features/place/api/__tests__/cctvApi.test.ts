import { fetchRequest } from '@/shared/api';

import { fetchNearbyCctv } from '../cctvApi';

jest.mock('@/shared/api', () => ({ fetchRequest: jest.fn() }));

const mockFetchRequest = jest.mocked(fetchRequest);

function respond(data: unknown) {
  mockFetchRequest.mockResolvedValue({ ok: true, data } as Awaited<ReturnType<typeof fetchRequest>>);
}

describe('fetchNearbyCctv', () => {
  beforeEach(() => mockFetchRequest.mockReset());

  it('maps backend cameras to the screen model, nearest first as served', async () => {
    respond({
      status: 'ok',
      cameras: [
        {
          id: 'txg-000046',
          name: '三民路/五權路/崇德路(右側車流往北屯路)',
          location: { lat: 24.1545, lng: 120.6859 },
          distanceM: 12,
          snapshotUrl: 'https://c01.twipcam.com/cam/snapshot/txg-000046.jpg',
          streamUrl: 'https://tcnvr3.taichung.gov.tw/45d41920',
        },
        { id: 'no-snapshot', name: '沒有快照', distanceM: 40, snapshotUrl: null, streamUrl: null },
        { id: 'no-stream', name: '沒有串流', distanceM: 80, snapshotUrl: 'https://c01.twipcam.com/x.jpg', streamUrl: null },
        { id: 'snapshot-only', name: '只有快照', distanceM: 90, snapshotUrl: 'https://c01.twipcam.com/y.jpg', streamUrl: 'https://c01.twipcam.com/y.jpg' },
      ],
    });

    const cameras = await fetchNearbyCctv(24.1544, 120.686);

    expect(mockFetchRequest).toHaveBeenCalledWith('/api/v1/a11y/cctv?lat=24.1544&lng=120.686', { signal: undefined });
    expect(cameras).toEqual([
      {
        id: 'txg-000046',
        name: '三民路/五權路/崇德路(右側車流往北屯路)',
        imageUrl: 'https://c01.twipcam.com/cam/snapshot/txg-000046.jpg',
        streamUrl: 'https://tcnvr3.taichung.gov.tw/45d41920',
        distanceMeters: 12,
      },
      { id: 'no-stream', name: '沒有串流', imageUrl: 'https://c01.twipcam.com/x.jpg', streamUrl: undefined, distanceMeters: 80 },
      { id: 'snapshot-only', name: '只有快照', imageUrl: 'https://c01.twipcam.com/y.jpg', streamUrl: undefined, distanceMeters: 90 },
    ]);
  });

  it('returns an empty list when the area has no cameras', async () => {
    respond({ status: 'ok', cameras: [] });
    await expect(fetchNearbyCctv(25, 121)).resolves.toEqual([]);
  });

  it('throws when the source is unavailable so the screen shows the error state', async () => {
    respond({ status: 'unavailable', reason: 'UPSTREAM_TIMEOUT' });
    await expect(fetchNearbyCctv(25, 121)).rejects.toThrow();
  });
});
