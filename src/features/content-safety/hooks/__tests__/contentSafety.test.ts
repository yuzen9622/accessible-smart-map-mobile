import { act, renderHook } from '@testing-library/react-native';
import { useAuthStore } from '@/features/auth';
import { flushPromises } from '@/shared/testing/flushPromises';
import { useContentReport } from '../useContentReport';
import { useBlockedUsers } from '../useBlockedUsers';
import { captureContentOwner, useContentSafetyStore } from '../../store/contentSafetyStore';
import { validReport } from '../../domain/types';

const mockSubmit = jest.fn();
const mockList = jest.fn();
const mockUnblock = jest.fn();
jest.mock('../../api/contentSafetyApi', () => ({
  submitContentReport: (...args: unknown[]) => mockSubmit(...args),
  getBlockedUsers: (...args: unknown[]) => mockList(...args),
  unblockUser: (...args: unknown[]) => mockUnblock(...args),
}));
jest.mock('@/features/auth', () => ({
  useAuthStore: jest.requireActual('zustand').create(() => ({})),
  selectIsLoggedIn: (state: { user: unknown; session?: { accessToken: string } }) => Boolean(state.user && state.session?.accessToken),
}));
jest.mock('@/shared/i18n', () => ({
  useAppTranslation: () => ({ t: (key: string) => key }),
  getAppLanguage: () => 'en',
}));
function login(id: string) {
  useAuthStore.setState({ user: { _id: id, name: id, email: 'test@example.com', emailVerified: true, tokenVersion: 0, authProviders: ['local'] }, session: { accessToken: id } });
}
const target = { targetType: 'review', targetId: '111111111111111111111111' } as const;
const receipt = { caseNumber: 'CR-test', receivedAt: '2026-10-10T00:00:00Z', confirmationEmail: 'queued', duplicate: false };
beforeEach(() => { mockSubmit.mockReset(); mockList.mockReset(); mockUnblock.mockReset(); login('A'); });

it('requires details for other and applies the 1000 character boundary', () => {
  expect(validReport('', '')).toBe(false);
  expect(validReport('other', '  ')).toBe(false);
  expect(validReport('other', 'Context')).toBe(true);
  expect(validReport('spam', 'x'.repeat(1000))).toBe(true);
  expect(validReport('spam', 'x'.repeat(1001))).toBe(false);
});
it('preserves failed draft, retries once and prevents double submission', async () => {
  mockSubmit.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(receipt);
  const { result } = await renderHook(() => useContentReport(target));
  await act(() => { result.current.setReason('other'); result.current.setDetails('Context'); });
  await act(async () => { result.current.submit(); result.current.submit(); await flushPromises(); });
  expect(mockSubmit).toHaveBeenCalledTimes(1);
  expect(result.current.error).toBe('contentActionFailed');
  expect(result.current.details).toBe('Context');
  await act(async () => { result.current.submit(); await flushPromises(); });
  expect(result.current.receipt).toEqual(receipt);
  expect(mockSubmit).toHaveBeenLastCalledWith({ ...target, reason: 'other', details: 'Context', language: 'en' });
  await act(() => result.current.submit());
  expect(mockSubmit).toHaveBeenCalledTimes(2);
});
it('does not commit a late receipt across an A → B → A account switch', async () => {
  let resolve!: (result: unknown) => void;
  mockSubmit.mockReturnValue(new Promise(r => { resolve = r; }));
  const { result } = await renderHook(() => useContentReport(target));
  await act(() => result.current.setReason('spam'));
  await act(() => result.current.submit());
  await act(() => { login('B'); login('A'); });
  await act(async () => { resolve(receipt); await flushPromises(); });
  expect(result.current.receipt).toBeNull();
});
it('keeps owner identity through token refresh, but invalidates it after logout', () => {
  const current = captureContentOwner();
  useAuthStore.setState({ session: { accessToken: 'refreshed' } });
  expect(current()).toBe(true);
  useAuthStore.setState({ session: null });
  expect(current()).toBe(false);
});
it('keeps queued and unavailable email states distinct', async () => {
  mockSubmit.mockResolvedValue({ ...receipt, confirmationEmail: 'unavailable' });
  const { result } = await renderHook(() => useContentReport(target));
  await act(() => result.current.setReason('spam'));
  await act(async () => { result.current.submit(); await flushPromises(); });
  expect(result.current.receipt?.confirmationEmail).toBe('unavailable');
});
it('retries failed block list and removes an unblocked entry while invalidating content', async () => {
  const item = { blockId: 'block-1', label: 'hazard_report', createdAt: '2026-10-10' };
  mockList.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([item]);
  mockUnblock.mockResolvedValue(undefined);
  const { result } = await renderHook(useBlockedUsers);
  await act(flushPromises);
  expect(result.current.error).toBe(true);
  await act(async () => { result.current.retry(); await flushPromises(); });
  expect(result.current.items).toEqual([item]);
  const revision = useContentSafetyStore.getState().revision;
  await act(async () => { result.current.unblock(item.blockId); result.current.unblock(item.blockId); await flushPromises(); });
  expect(mockUnblock).toHaveBeenCalledTimes(1);
  expect(result.current.items).toEqual([]);
  expect(useContentSafetyStore.getState().revision).toBe(revision + 1);
});
it('does not disclose a late block list to another account', async () => {
  let resolve!: (result: unknown) => void;
  mockList.mockReturnValue(new Promise(r => { resolve = r; }));
  const { result } = await renderHook(useBlockedUsers);
  await act(() => login('B'));
  await act(async () => { resolve([{ blockId: 'A-private', label: 'review', createdAt: '2026-10-10' }]); await flushPromises(); });
  expect(result.current.items).toEqual([]);
});
