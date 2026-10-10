import { act, renderHook } from '@testing-library/react-native';
import { flushPromises } from '@/shared/testing/flushPromises';
import type { HazardReport } from '../../domain/types';
import { useReportReview } from '../useReportReview';

jest.mock('@/shared/polling', () => ({ appStateVisibility: {} }));
jest.mock('../../api/hazardApi', () => ({ fetchHazardReport: jest.fn() }));
jest.mock('../../domain/reviewPoller', () => ({
  createHazardReviewPoller: () => ({ dispose: jest.fn(), refresh: jest.fn() }),
}));

it('updates an existing review card when authenticated detail supplies a newer snapshot', async () => {
  const initial = { _id: 'owned-report', status: 'verified' } as HazardReport;
  const { result, rerender } = await renderHook(({ report }: { report: HazardReport }) => useReportReview(report._id, report), { initialProps: { report: initial } });
  expect(result.current.report?.status).toBe('verified');
  await rerender({ report: { ...initial, status: 'rejected' } });
  await act(flushPromises);
  expect(result.current.report?.status).toBe('rejected');
});
