/** 通知只提供導航識別；審核結果一律登入後重新查詢。 */
export type PushTarget =
  | { kind: 'sos'; sessionId: string | null }
  | { kind: 'hazard'; reportId: string | null; notificationId: string | null }
  | { kind: 'none' };

export function parsePushTarget(data: unknown): PushTarget {
  if (typeof data !== 'object' || data === null) return { kind: 'none' };
  const value = data as Record<string, unknown>;
  if (value.type === 'sos' || value.type === 'sos_update') {
    return { kind: 'sos', sessionId: typeof value.sessionId === 'string' ? value.sessionId : null };
  }
  if (value.type === 'hazard' || value.type === 'hazard_review') {
    const reportId = typeof value.reportId === 'string' && /^[a-f0-9]{24}$/i.test(value.reportId) ? value.reportId : null;
    const notificationId = reportId && typeof value.notificationId === 'string'
      && value.notificationId.length <= 128 && value.notificationId.startsWith(`${reportId}:`) && /^\d+$/.test(value.notificationId.slice(25))
      ? value.notificationId : null;
    return { kind: 'hazard', reportId, notificationId };
  }
  return { kind: 'none' };
}
