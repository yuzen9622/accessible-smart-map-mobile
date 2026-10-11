import { act, renderHook } from '@testing-library/react-native';
import { useContentSafetyStore } from '@/features/content-safety';
import { flushPromises } from '@/shared/testing/flushPromises';
import { useHazardLayerStore } from '../../controller/hazardLayerController';
import type { HazardReport } from '../../domain/types';
import { useHazardDetail } from '../useHazardDetail';

const mockLoad = jest.fn();
let mockActive = true;
const mockListeners = new Set<(active: boolean) => void>();
jest.mock('@/shared/polling', () => ({ appStateVisibility: {
  isActive: () => mockActive,
  subscribe: (listener: (active: boolean) => void) => { mockListeners.add(listener); return () => mockListeners.delete(listener); },
} }));
jest.mock('@/features/auth', () => ({ useAuthStore: (selector: (state: { user: null }) => unknown) => selector({ user: null }) }));
jest.mock('@/features/map', () => ({ mapCamera: { flyTo: jest.fn() } }));
jest.mock('@/features/content-safety', () => ({ useContentSafetyStore: jest.requireActual('zustand').create(() => ({ revision: 0 })) }));
jest.mock('../../api/hazardApi', () => ({
  fetchHazardReport: (...args: unknown[]) => mockLoad(...args),
  getHazardReport: (...args: unknown[]) => mockLoad(...args),
  confirmHazardReport: jest.fn(),
}));
jest.mock('../../controller/hazardLayerController', () => {
  const store = jest.requireActual('zustand').create(() => ({ reports: [], votedIds: [] }));
  return {
    useHazardLayerStore: store,
    markVoted: jest.fn(),
    updateReport: (report: HazardReport) => store.setState((state: { reports: HazardReport[] }) => ({ reports: state.reports.map(r => r._id === report._id ? report : r) })),
  };
});

const NOW = Date.parse('2026-10-11T07:00:00Z');
const seed = (overrides: Partial<HazardReport> = {}): HazardReport => ({
  _id: 'report-one', hazardType: 'obstacle', status: 'pending', publicPhotoUrl: null,
  hasPhoto: true, reportedLocation: { type: 'Point', coordinates: [121, 25] },
  aiReview: { state: 'queued', queuedAt: new Date(NOW).toISOString() }, ...overrides,
});
const approved = () => seed({ status: 'verified', aiReview: { state: 'completed', decision: 'supported' }, publicPhotoUrl: '/api/v1/a11y/reports/report-one/photo/public' });

beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(NOW); mockLoad.mockReset(); mockActive = true; mockListeners.clear();
  useContentSafetyStore.setState({ revision: 0 });
  useHazardLayerStore.setState({ reports: [], votedIds: [] });
});
afterEach(() => jest.useRealTimers());

it('refreshes a cached pending report and acquires the public URL after AI approval', async () => {
  useHazardLayerStore.setState({ reports: [seed()] });
  mockLoad.mockResolvedValueOnce(seed()).mockResolvedValue(approved());
  const { result } = await renderHook(() => useHazardDetail('report-one'));
  await act(flushPromises);
  expect(mockLoad).toHaveBeenCalledTimes(1);
  expect(result.current.report?.publicPhotoUrl).toBeNull();
  await act(async () => { await jest.advanceTimersByTimeAsync(2000); });
  expect(result.current.report?.publicPhotoUrl).toContain('/photo/public');
  expect(useHazardLayerStore.getState().reports[0].publicPhotoUrl).toContain('/photo/public');
  const calls = mockLoad.mock.calls.length;
  await act(async () => { await jest.advanceTimersByTimeAsync(10_000); });
  expect(mockLoad).toHaveBeenCalledTimes(calls);
});

it('removes the displayed URL at the exact expiry boundary before a slow refresh resolves', async () => {
  const report = { ...approved(), expiredAt: new Date(NOW + 1000).toISOString() };
  useHazardLayerStore.setState({ reports: [report] });
  mockLoad.mockResolvedValueOnce(report).mockImplementation(() => new Promise(() => {}));
  const { result } = await renderHook(() => useHazardDetail('report-one'));
  await act(flushPromises);
  expect(result.current.report?.publicPhotoUrl).not.toBeNull();
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
  expect(result.current.report?.publicPhotoUrl).toBeNull();
  expect(result.current.canVote).toBe(false);
  expect(mockLoad).toHaveBeenCalledTimes(2);
});

it('refreshes on foreground and clears a revoked public URL', async () => {
  mockLoad.mockResolvedValueOnce(approved()).mockResolvedValue({ ...approved(), publicPhotoUrl: null });
  const { result } = await renderHook(() => useHazardDetail('report-one'));
  await act(flushPromises);
  expect(result.current.report?.publicPhotoUrl).not.toBeNull();
  await act(async () => { mockActive = false; mockListeners.forEach(fn => fn(false)); });
  await act(async () => { mockActive = true; mockListeners.forEach(fn => fn(true)); await flushPromises(); });
  expect(result.current.report?.publicPhotoUrl).toBeNull();
  expect(mockLoad).toHaveBeenCalledTimes(2);
});

it('ignores a late result after changing report id and aborts the old request', async () => {
  let resolve!: (report: HazardReport) => void;
  mockLoad.mockImplementationOnce(() => new Promise<HazardReport>(r => { resolve = r; })).mockResolvedValue(seed({ _id: 'report-two' }));
  const { result, rerender } = await renderHook(({ id }: { id: string }) => useHazardDetail(id), { initialProps: { id: 'report-one' } });
  const signal = mockLoad.mock.calls[0][1] as AbortSignal;
  await rerender({ id: 'report-two' });
  await act(flushPromises);
  expect(signal.aborted).toBe(true);
  await act(async () => { resolve(approved()); await flushPromises(); });
  expect(result.current.report?._id).toBe('report-two');
  expect(result.current.report?.publicPhotoUrl).toBeNull();
});

it('does not resurrect cached images when public detail becomes unavailable', async () => {
  useHazardLayerStore.setState({ reports: [approved()] });
  mockLoad.mockRejectedValue(Object.assign(new Error('gone'), { code: 404 }));
  const { result } = await renderHook(() => useHazardDetail('report-one'));
  await act(flushPromises);
  expect(result.current.report).toBeNull();
  expect(result.current.failure).toBe('notFound');
});
