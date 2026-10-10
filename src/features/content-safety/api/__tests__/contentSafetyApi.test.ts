import { submitContentReport, blockContentAuthor, getBlockedUsers, unblockUser } from '../contentSafetyApi';
const mockRequest = jest.fn();
jest.mock('@/shared/api', () => ({
  authenticatedRequest: (...args: unknown[]) => mockRequest(...args),
  ApiError: class extends Error {},
}));
jest.mock('../../store/contentSafetyStore', () => ({ captureContentOwner: () => () => true }));
beforeEach(() => mockRequest.mockReset());
it('sends only a target, reason, details and UI language; requires a valid receipt', async () => {
  const input = { targetType: 'review', targetId: 'target', reason: 'spam', details: '', language: 'en' } as const;
  const receipt = { caseNumber: 'CR-1', receivedAt: '2026-10-10', confirmationEmail: 'queued', duplicate: false };
  mockRequest.mockResolvedValueOnce({ ok: true, data: receipt });
  expect(await submitContentReport(input)).toEqual(receipt);
  expect(mockRequest).toHaveBeenLastCalledWith('/api/v1/content-reports', { method: 'POST', body: input, isCurrent: expect.any(Function) });
  mockRequest.mockResolvedValueOnce({ ok: true, data: { caseNumber: 'CR-1' } });
  await expect(submitContentReport(input)).rejects.toThrow('Invalid report receipt');
});
it('resolves author server-side and deletes only the opaque block ID', async () => {
  mockRequest.mockResolvedValue({ success: true });
  await blockContentAuthor({ targetType: 'hazard_report', targetId: 'hazard' });
  expect(mockRequest).toHaveBeenLastCalledWith('/api/v1/user/blocks', { method: 'PUT', body: { targetType: 'hazard_report', targetId: 'hazard' }, isCurrent: expect.any(Function) });
  await unblockUser('opaque/id');
  expect(mockRequest).toHaveBeenLastCalledWith('/api/v1/user/blocks/opaque%2Fid', { method: 'DELETE', isCurrent: expect.any(Function) });
});
it('rejects untrusted block entries instead of rendering author information', async () => {
  mockRequest.mockResolvedValue({ ok: true, data: { items: [{ userId: 'private-author', name: 'secret' }] } });
  await expect(getBlockedUsers()).rejects.toThrow('Invalid block entry');
});
it('does not treat a failed authenticated response as success', async () => {
  mockRequest.mockResolvedValue({ ok: false, code: 401, message: 'Unauthorized' });
  await expect(blockContentAuthor({ targetType: 'review', targetId: 'target' })).rejects.toThrow('Unauthorized');
});
