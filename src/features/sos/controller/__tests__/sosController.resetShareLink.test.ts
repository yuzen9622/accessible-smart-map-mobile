import { INITIAL_SOS_STATE, useSosStore } from '../../store/sosStore';
import type { SosSnapshot } from '../../domain/types';
import { refreshSosSnapshot, resetSosShareLink } from '../sosController';

const mockGetSosSession = jest.fn();
const mockRotateSosShareToken = jest.fn();

jest.mock('../../api/sosApi', () => ({
  getSosSession: (...args: unknown[]) => mockGetSosSession(...args),
  rotateSosShareToken: (...args: unknown[]) => mockRotateSosShareToken(...args),
}));

jest.mock('@/features/auth', () => ({
  useAuthStore: { getState: () => ({ user: { _id: 'owner-1' } }) },
}));

jest.mock('@/features/map', () => ({
  useUserLocationStore: { getState: () => ({ position: null }), subscribe: () => () => {} },
}));

jest.mock('@/features/place', () => ({ reverseGeocodeLabel: jest.fn() }));
jest.mock('@/features/notifications', () => ({ requestPushPermission: jest.fn(), syncPushToken: jest.fn() }));
jest.mock('@/shared/location', () => ({
  getLocationPort: jest.fn(),
  startBackgroundLocation: jest.fn(),
  stopBackgroundLocation: jest.fn(),
}));
jest.mock('../sosAlarm', () => ({ startSosAlarm: jest.fn(), stopSosAlarm: jest.fn() }));

const snapshot: SosSnapshot = {
  sessionId: 'session-1',
  status: 'active',
  handlingStatus: 'notified',
  claimedBy: null,
  claimedByName: null,
  claimedAt: null,
  acknowledgements: [],
  timeline: [],
  location: { lat: 25, lng: 121, address: null, updatedAt: '2026-10-13T02:00:00Z' },
  viewers: [{ firstSeenAt: '2026-10-13T02:00:00Z', lastSeenAt: '2026-10-13T02:01:00Z' }],
  activeViewerCount: 1,
  viewerActiveWindowSeconds: 180,
  resolvedAt: null,
  updatedAt: '2026-10-13T02:01:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  useSosStore.setState({
    ...INITIAL_SOS_STATE,
    phase: 'active',
    sessionId: 'session-1',
    shareToken: 'a'.repeat(32),
    snapshot,
  });
});

afterEach(() => useSosStore.setState(INITIAL_SOS_STATE));

describe('resetSosShareLink', () => {
  it('stores the returned token and clears viewer state without overwriting a newer snapshot', async () => {
    let finishRequest: (value: { sessionId: string; shareToken: string }) => void = () => {};
    mockRotateSosShareToken.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRequest = resolve;
        }),
    );

    const resetting = resetSosShareLink();
    useSosStore.setState({ snapshot: { ...snapshot, handlingStatus: 'en_route' } });
    finishRequest({ sessionId: 'session-1', shareToken: 'b'.repeat(32) });

    await expect(resetting).resolves.toBe(true);
    expect(useSosStore.getState()).toMatchObject({
      shareToken: 'b'.repeat(32),
      snapshot: { handlingStatus: 'en_route', viewers: [], activeViewerCount: 0 },
    });
  });

  it('does not revive or persist a link after the SOS resolves during the request', async () => {
    let finishRequest: (value: { sessionId: string; shareToken: string }) => void = () => {};
    mockRotateSosShareToken.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRequest = resolve;
        }),
    );

    const resetting = resetSosShareLink();
    useSosStore.setState({ phase: 'resolved' });
    finishRequest({ sessionId: 'session-1', shareToken: 'b'.repeat(32) });

    await expect(resetting).resolves.toBe(false);
    expect(useSosStore.getState().shareToken).toBe('a'.repeat(32));
  });

  it('ignores a pre-rotation viewer refresh that finishes after the link reset', async () => {
    let finishRefresh: (value: SosSnapshot) => void = () => {};
    mockGetSosSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRefresh = resolve;
        }),
    );
    mockRotateSosShareToken.mockResolvedValue({
      sessionId: 'session-1',
      shareToken: 'b'.repeat(32),
    });

    const refreshing = refreshSosSnapshot();
    await expect(resetSosShareLink()).resolves.toBe(true);
    finishRefresh(snapshot);
    await refreshing;

    expect(useSosStore.getState().snapshot).toMatchObject({
      viewers: [],
      activeViewerCount: 0,
    });
  });
});
