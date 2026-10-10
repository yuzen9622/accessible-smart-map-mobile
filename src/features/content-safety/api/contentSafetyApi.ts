import { ApiError, authenticatedRequest, type ApiResponse } from '@/shared/api';
import type { AppLanguage } from '@/shared/i18n';
import { captureContentOwner } from '../store/contentSafetyStore';
import type { BlockedUser, ContentTarget, ReportReason, ReportReceipt } from '../domain/types';

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function data(response: ApiResponse<unknown>): unknown {
  if (!(response.ok || response.success)) throw new ApiError(response.message, response.code);
  return response.data;
}
export async function submitContentReport(input: ContentTarget & { reason: ReportReason; details: string; language: AppLanguage }): Promise<ReportReceipt> {
  const result = data(await authenticatedRequest('/api/v1/content-reports', { method: 'POST', body: input, isCurrent: captureContentOwner() }));
  if (!record(result) || typeof result.caseNumber !== 'string' || typeof result.receivedAt !== 'string' || typeof result.duplicate !== 'boolean'
    || (result.confirmationEmail !== 'queued' && result.confirmationEmail !== 'unavailable')) throw new ApiError('Invalid report receipt', 502);
  return { caseNumber: result.caseNumber, receivedAt: result.receivedAt, duplicate: result.duplicate, confirmationEmail: result.confirmationEmail };
}
export async function blockContentAuthor(target: ContentTarget): Promise<void> {
  data(await authenticatedRequest('/api/v1/user/blocks', { method: 'PUT', body: target, isCurrent: captureContentOwner() }));
}
export async function getBlockedUsers(signal?: AbortSignal): Promise<BlockedUser[]> {
  const result = data(await authenticatedRequest('/api/v1/user/blocks', { signal, isCurrent: captureContentOwner() }));
  if (!record(result) || !Array.isArray(result.items)) throw new ApiError('Invalid block list', 502);
  return result.items.map((item: unknown) => {
    if (!record(item) || typeof item.blockId !== 'string' || typeof item.label !== 'string' || typeof item.createdAt !== 'string') throw new ApiError('Invalid block entry', 502);
    return { blockId: item.blockId, label: item.label, createdAt: item.createdAt };
  });
}
export async function unblockUser(blockId: string): Promise<void> {
  data(await authenticatedRequest(`/api/v1/user/blocks/${encodeURIComponent(blockId)}`, { method: 'DELETE', isCurrent: captureContentOwner() }));
}
