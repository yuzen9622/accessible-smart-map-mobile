import { useAuthStore } from '@/features/auth';
import { invalidateContentSafety } from '@/features/content-safety/store/contentSafetyStore';
import { flushPromises } from '@/shared/testing/flushPromises';
import { refreshNearbyHazards, useHazardLayerStore } from '../hazardLayerController';
const mockNearby = jest.fn();
jest.mock('../../api/hazardApi', () => ({ getNearbyHazardReports: (...args: unknown[]) => mockNearby(...args) }));
jest.mock('@/features/map', () => ({ useUserLocationStore: { getState: () => ({ position: { lat: 25, lng: 121 } }) } }));
jest.mock('@/features/content-safety', () => jest.requireActual('@/features/content-safety/store/contentSafetyStore'));
jest.mock('@/features/auth', () => ({
  useAuthStore: jest.requireActual('zustand').create(() => ({})),
  selectIsLoggedIn: (state: { user: unknown; session?: { accessToken: string } }) => Boolean(state.user && state.session?.accessToken),
}));
const report = { _id: 'hazard', hazardType: 'obstacle', status: 'verified', reportedLocation: { type: 'Point', coordinates: [121, 25] } };
it('clears pins immediately on block changes and never restores an aborted response', async () => {
  let resolveOld!: (value: unknown) => void;
  mockNearby.mockReturnValueOnce(new Promise(r => { resolveOld = r; })).mockRejectedValueOnce(new Error('offline'));
  const old = refreshNearbyHazards(true);
  invalidateContentSafety();
  expect(useHazardLayerStore.getState().reports).toEqual([]);
  resolveOld([report]);
  await old;
  await flushPromises();
  expect(useHazardLayerStore.getState().reports).toEqual([]);
});
it('refetches on login and clears on logout', async () => {
  mockNearby.mockResolvedValueOnce([report]).mockRejectedValueOnce(new Error('offline'));
  useAuthStore.setState({ user: { _id: 'A', name: 'A', email: 'test@example.com', emailVerified: true, tokenVersion: 0, authProviders: ['local'] }, session: { accessToken: 'A' } });
  await flushPromises();
  expect(useHazardLayerStore.getState().reports).toEqual([report]);
  useAuthStore.setState({ user: null, session: null });
  expect(useHazardLayerStore.getState().reports).toEqual([]);
  await flushPromises();
  expect(useHazardLayerStore.getState().reports).toEqual([]);
});
