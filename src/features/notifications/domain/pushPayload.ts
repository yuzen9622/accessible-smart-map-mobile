/**
 * 推播 payload 的解讀（B-04 草案：後端以 Expo Push 送出，`data` 帶 `type` 與對應 id）。
 * 目前只處理 SOS 狀態變更：點擊後開 SOS 畫面（SDD §6.8）。
 */
export type PushTarget = { kind: 'sos'; sessionId: string | null } | { kind: 'hazard'; reportId: string | null } | { kind: 'none' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parsePushTarget(data: unknown): PushTarget {
  if (!isRecord(data)) return { kind: 'none' };
  const type = data.type;
  if (type === 'sos' || type === 'sos_status') {
    return { kind: 'sos', sessionId: typeof data.sessionId === 'string' ? data.sessionId : null };
  }
  if (type === 'hazard' || type === 'hazard_review') {
    return { kind: 'hazard', reportId: typeof data.reportId === 'string' ? data.reportId : null };
  }
  return { kind: 'none' };
}
