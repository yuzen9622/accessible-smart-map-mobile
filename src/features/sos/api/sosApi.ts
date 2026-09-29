import { ApiError, authenticatedRequest, fetchRequest, getAccessToken, streamSse } from '@/shared/api';
import { getAppConfig } from '@/shared/config';

import type { SosStreamHandlers } from '../domain/sosLifecycle';
import {
  isCreateContactResult,
  isCreateSosSessionResult,
  isEmergencyContact,
  isSosPublicSession,
  isSosSnapshot,
  normalizeContact,
  type CreateEmergencyContactResult,
  type CreateSosSessionInput,
  type CreateSosSessionResult,
  type EmergencyContact,
  type SosPublicSession,
  type SosSnapshot,
} from '../domain/types';

/** 移植自 Web `src/lib/api/sos.ts`（commit f82cda8），回應改以 type guard 收窄。 */

const CONTACTS = '/api/v1/user/emergency-contacts';
const SOS = '/api/v1/sos/sessions';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function ok(res: { ok?: boolean; success?: boolean }): boolean {
  return res.ok === true || res.success === true;
}

export async function getEmergencyContacts(): Promise<EmergencyContact[]> {
  const res = await authenticatedRequest(CONTACTS, { method: 'GET' });
  if (!ok(res)) throw new ApiError(res.message, res.code);
  const list = isRecord(res.data) && Array.isArray(res.data.contacts) ? res.data.contacts : [];
  return list.filter(isEmergencyContact).map(normalizeContact);
}

export async function createEmergencyContact(name: string): Promise<CreateEmergencyContactResult> {
  const res = await authenticatedRequest(CONTACTS, { method: 'POST', body: { name } });
  if (!ok(res) || !isCreateContactResult(res.data)) throw new ApiError(res.message, res.code);
  return { ...res.data, contact: normalizeContact(res.data.contact) };
}

export async function deleteEmergencyContact(id: string): Promise<void> {
  const res = await authenticatedRequest(`${CONTACTS}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!ok(res)) throw new ApiError(res.message, res.code);
}

/** `existing: true`＝伺服器已有進行中的求救（HTTP 200，不會重新通知家人），回傳的就是那一筆。 */
export async function createSosSession(input: CreateSosSessionInput): Promise<CreateSosSessionResult & { existing: boolean }> {
  const res = await authenticatedRequest(SOS, { method: 'POST', body: input });
  if (!ok(res) || !isCreateSosSessionResult(res.data)) throw new ApiError(res.message, res.code);
  return { ...res.data, existing: res.code === 200 };
}

export async function updateSosLocation(sessionId: string, body: { lat: number; lng: number; address?: string }): Promise<void> {
  const res = await authenticatedRequest(`${SOS}/${encodeURIComponent(sessionId)}/location`, { method: 'PATCH', body });
  if (!ok(res)) throw new ApiError(res.message, res.code);
}

/** 冪等：重複解除仍回 200（`data.reason: ALREADY_RESOLVED`）。 */
export async function resolveSosSession(sessionId: string): Promise<void> {
  const res = await authenticatedRequest(`${SOS}/${encodeURIComponent(sessionId)}/resolve`, { method: 'PATCH' });
  if (!ok(res)) throw new ApiError(res.message, res.code);
}

/** 只有發起者能讀的完整快照：首次載入、輪詢備援、重啟復原都用它。 */
export async function getSosSession(sessionId: string, signal?: AbortSignal): Promise<SosSnapshot | null> {
  const res = await authenticatedRequest(`${SOS}/${encodeURIComponent(sessionId)}`, { method: 'GET', signal });
  if (!ok(res)) throw new ApiError(res.message, res.code);
  return isSosSnapshot(res.data) ? res.data : null;
}

/** 不需登入的公開追蹤（以 shareToken 為 key）。404／410 由呼叫端以 `ApiError.code` 區分。 */
export async function getPublicSosSession(shareToken: string, signal?: AbortSignal): Promise<SosPublicSession | null> {
  const res = await fetchRequest(`${SOS}/${encodeURIComponent(shareToken)}/public`, { method: 'GET', signal });
  return ok(res) && isSosPublicSession(res.data) ? res.data : null;
}

/**
 * 訂閱 `GET /sessions/:id/stream`（SSE、必須帶 Bearer，所以不能用原生 EventSource，ADR-07）。
 * 事件只有 `update`（完整快照 JSON）；`: ping` 心跳是註解、parser 會略過。每次連線都重新讀當下的 token。
 */
export async function openSosStream(sessionId: string, handlers: SosStreamHandlers, signal: AbortSignal): Promise<void> {
  const token = getAccessToken();
  await streamSse(
    `${getAppConfig().apiBaseUrl}${SOS}/${encodeURIComponent(sessionId)}/stream`,
    { method: 'GET', headers: token ? { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' } : { Accept: 'text/event-stream' } },
    {
      signal,
      onOpen: ({ ok: opened, status }) => {
        if (!opened) throw new Error(`SSE open failed: ${status}`);
        handlers.onOpen();
      },
      onEvent: (event) => {
        if (event.event !== 'update' || !event.data) return;
        try {
          const parsed: unknown = JSON.parse(event.data);
          if (isSosSnapshot(parsed)) handlers.onSnapshot(parsed);
        } catch {
          // 壞掉的 frame：忽略，下一個事件或輪詢會修正
        }
      },
    },
  );
}
