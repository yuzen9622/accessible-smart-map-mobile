import { act, renderHook } from '@testing-library/react-native';
import { useAuthStore } from '@/features/auth';
import { flushPromises } from '@/shared/testing/flushPromises';
import { findMyReport, refreshMyReports, useMyReports } from '../useMyReports';
import { useMyReportDetail } from '../useMyReportDetail';

const mockMine = jest.fn();
const mockPublic = jest.fn();
jest.mock('../../api/hazardApi', () => ({
  getMyHazardReports: (...args: unknown[]) => mockMine(...args),
  getHazardReport: (...args: unknown[]) => mockPublic(...args),
}));
jest.mock('@/features/auth', () => ({
  useAuthStore: jest.requireActual('zustand').create(() => ({})),
  selectIsLoggedIn: (s: { user: unknown; session?: { accessToken: string } }) => Boolean(s.user && s.session?.accessToken),
}));
jest.mock('@/features/map', () => ({ mapCamera: {} }));
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn() },
  useNavigation: () => ({}),
  useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]),
}));
const report = { _id: 'report', hazardType: 'obstacle', status: 'verified', reportedLocation: { type: 'Point', coordinates: [121, 25] }, createdAt: '2026-10-10T00:00:00Z' };
function login(id = 'A') {
  useAuthStore.setState({ restored: true, user: { _id: id } as never, session: { accessToken: id } });
}
beforeEach(() => { mockMine.mockReset(); mockPublic.mockReset(); login(); });
it('finds an owned report on page two using authenticated pagination only', async () => {
  mockMine.mockResolvedValueOnce({ reports: [], nextCursor: 'second' }).mockResolvedValueOnce({ reports: [report], nextCursor: null });
  expect(await findMyReport('report', useAuthStore.getState().session!, new AbortController().signal)).toEqual(report);
  expect(mockMine.mock.calls.map((call) => call[0])).toEqual([null, 'second']);
  expect(mockPublic).not.toHaveBeenCalled();
});
it('only reports missing after all pages and preserves network failures', async () => {
  mockMine.mockResolvedValueOnce({ reports: [], nextCursor: 'second' }).mockResolvedValueOnce({ reports: [], nextCursor: null });
  expect(await findMyReport('report', useAuthStore.getState().session!, new AbortController().signal)).toBeNull();
  mockMine.mockRejectedValueOnce(new Error('offline'));
  await expect(findMyReport('report', useAuthStore.getState().session!, new AbortController().signal)).rejects.toThrow('offline');
});
it('rejects a stale response after an account or session change', async () => {
  let resolve!: (v: unknown) => void;
  mockMine.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  const lookup = findMyReport('report', useAuthStore.getState().session!, new AbortController().signal);
  login('B');
  resolve({ reports: [report], nextCursor: null });
  await expect(lookup).rejects.toThrow('superseded');
});
it('rejects repeated cursors instead of falsely reporting missing', async () => {
  mockMine.mockResolvedValue({ reports: [], nextCursor: 'same' });
  await expect(findMyReport('report', useAuthStore.getState().session!, new AbortController().signal)).rejects.toThrow('Repeated');
});
it('refreshes an already focused list and cancels a previous request', async () => {
  let resolve!: (v: unknown) => void;
  mockMine.mockReturnValueOnce(new Promise((r) => { resolve = r; })).mockResolvedValue({ reports: [report], nextCursor: null });
  const { result } = await renderHook(useMyReports);
  await act(async () => { refreshMyReports(); await flushPromises(); });
  expect(result.current.rows).toHaveLength(1);
  expect(mockMine.mock.calls[0][1].aborted).toBe(true);
  await act(async () => { resolve({ reports: [], nextCursor: null }); await flushPromises(); });
  expect(result.current.rows).toHaveLength(1);
});
it('detail re-fetches on a foreground refresh and hides previous account data', async () => {
  mockMine.mockResolvedValue({ reports: [report], nextCursor: null });
  const { result } = await renderHook(() => useMyReportDetail('report'));
  await act(flushPromises);
  expect(result.current.status).toBe('ready');
  mockMine.mockResolvedValue({ reports: [{ ...report, status: 'rejected' }], nextCursor: null });
  await act(async () => { refreshMyReports(); await flushPromises(); });
  expect(result.current.status === 'ready' && result.current.report.status).toBe('rejected');
  mockMine.mockResolvedValue({ reports: [], nextCursor: null });
  await act(async () => { login('B'); await flushPromises(); });
  expect(result.current.status).toBe('notFound');
  expect(mockPublic).not.toHaveBeenCalled();
});
it('changing report id cannot display the prior report', async () => {
  mockMine.mockResolvedValue({ reports: [report], nextCursor: null });
  const { result, rerender } = await renderHook(({ id }: { id: string }) => useMyReportDetail(id), { initialProps: { id: 'report' } });
  await act(flushPromises);
  await rerender({ id: 'other' });
  await act(flushPromises);
  expect(result.current.status).toBe('notFound');
});
