import { ApiError } from '@/shared/api';

import { getPublicSosSession } from '../../api/sosApi';
import {
  TRACKER_RATE_LIMIT_RETRY_MS,
  closeSosTracker,
  openSosTracker,
  useSosTrackerStore,
} from '../trackerController';

const mockFlyTo = jest.fn();

jest.mock('@/features/map', () => ({
  mapCamera: { flyTo: (...args: unknown[]) => mockFlyTo(...args) },
}));

jest.mock('../../api/sosApi', () => ({
  getPublicSosSession: jest.fn(),
}));

const mockGetPublicSosSession = jest.mocked(getPublicSosSession);
const token = 'ab'.repeat(16);

async function flush(): Promise<void> {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  closeSosTracker();
});

afterEach(() => {
  closeSosTracker();
  jest.useRealTimers();
});

describe('SOS public tracker polling', () => {
  it('handles a resolved response before storing or centering location data', async () => {
    mockGetPublicSosSession.mockResolvedValue({
      type: 'body',
      status: 'resolved',
      handlingStatus: 'resolved',
      resolvedAt: '2026-10-13T02:00:00.000Z',
    });

    openSosTracker(token);
    await flush();

    expect(useSosTrackerStore.getState()).toMatchObject({ phase: 'resolved', session: null });
    expect(mockFlyTo).not.toHaveBeenCalled();
  });

  it('waits before retrying a rate-limited request', async () => {
    mockGetPublicSosSession
      .mockRejectedValueOnce(new ApiError('Too many requests', 429))
      .mockResolvedValueOnce({
        type: 'body',
        status: 'active',
        lat: 25.033,
        lng: 121.5654,
        address: null,
        updatedAt: '2026-10-13T02:00:00.000Z',
        handlingStatus: 'notified',
      });

    openSosTracker(token);
    await flush();
    expect(mockGetPublicSosSession).toHaveBeenCalledTimes(1);
    expect(useSosTrackerStore.getState().phase).toBe('loading');

    jest.advanceTimersByTime(TRACKER_RATE_LIMIT_RETRY_MS - 1);
    await flush();
    expect(mockGetPublicSosSession).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1);
    await flush();
    expect(mockGetPublicSosSession).toHaveBeenCalledTimes(2);
    expect(useSosTrackerStore.getState().phase).toBe('active');
  });

  it('shows the invalid-or-reset state for a 404 response', async () => {
    mockGetPublicSosSession.mockRejectedValue(new ApiError('Not found', 404));

    openSosTracker(token);
    await flush();

    expect(useSosTrackerStore.getState()).toMatchObject({ phase: 'notFound', session: null });
    expect(mockFlyTo).not.toHaveBeenCalled();
  });
});
