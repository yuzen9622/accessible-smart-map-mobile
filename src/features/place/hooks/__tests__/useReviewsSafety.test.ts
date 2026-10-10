import { act, renderHook } from '@testing-library/react-native';
import { useAuthStore } from '@/features/auth';
import { flushPromises } from '@/shared/testing/flushPromises';
import { invalidateContentSafety } from '@/features/content-safety/store/contentSafetyStore';
import { useReviews } from '../useReviews';

const mockList = jest.fn();
const mockSummary = jest.fn();
jest.mock('../../api/reviews', () => ({ getPlaceReviews: (...args: unknown[]) => mockList(...args), getReviewSummary: (...args: unknown[]) => mockSummary(...args) }));
jest.mock('@/features/content-safety', () => jest.requireActual('@/features/content-safety/store/contentSafetyStore'));
jest.mock('@/features/auth', () => ({
  useAuthStore: jest.requireActual('zustand').create(() => ({})),
  selectIsLoggedIn: (state: { user: unknown; session?: { accessToken: string } }) => Boolean(state.user && state.session?.accessToken),
}));
function login(id: string) { useAuthStore.setState({ user: { _id: id, name: id, email: 'test@example.com', emailVerified: true, tokenVersion: 0, authProviders: ['local'] }, session: { accessToken: id } }); }
const row = { _id: 'review', userId: 'author', rating: 3, createdAt: '2026-10-10' };
const page = (items = [row]) => ({ data: { items, totalCount: items.length, totalPages: 2, page: 1 } });
beforeEach(() => { mockList.mockReset(); mockSummary.mockReset(); mockSummary.mockResolvedValue({ data: { summary: 'old summary' } }); login('A'); });
it('refetches list and summary after blocking, never restoring an old pagination response', async () => {
  let resolvePage!: (value: unknown) => void;
  mockList.mockResolvedValueOnce(page()).mockReturnValueOnce(new Promise(r => { resolvePage = r; })).mockResolvedValueOnce(page([]));
  const { result } = await renderHook(() => useReviews('place', 'google'));
  await act(flushPromises);
  await act(() => result.current.loadMore());
  mockSummary.mockResolvedValueOnce({ data: { summary: null } });
  await act(async () => { invalidateContentSafety(); await flushPromises(); });
  expect(result.current.reviews).toEqual([]);
  expect(result.current.summary?.summary).toBeNull();
  await act(async () => { resolvePage({ data: { items: [row], totalPages: 2, page: 2 } }); await flushPromises(); });
  expect(result.current.reviews).toEqual([]);
  expect(result.current.loadingMore).toBe(false);
});
it('clears the previous account content even when the new request fails', async () => {
  mockList.mockResolvedValueOnce(page()).mockRejectedValueOnce(new Error('offline'));
  const { result } = await renderHook(() => useReviews('place', 'google'));
  await act(flushPromises);
  expect(result.current.reviews).toHaveLength(1);
  await act(async () => { login('B'); await flushPromises(); });
  expect(result.current.reviews).toEqual([]);
  expect(result.current.summary).toBeNull();
  expect(result.current.error).toBe(true);
});
it('rejects a first-page response from the old account after A → B → A', async () => {
  let resolveOld!: (value: unknown) => void;
  mockList.mockReturnValueOnce(new Promise(r => { resolveOld = r; })).mockResolvedValue(page([]));
  const { result } = await renderHook(() => useReviews('place', 'google'));
  await act(async () => { login('B'); login('A'); await flushPromises(); });
  await act(async () => { resolveOld(page()); await flushPromises(); });
  expect(result.current.reviews).toEqual([]);
});
