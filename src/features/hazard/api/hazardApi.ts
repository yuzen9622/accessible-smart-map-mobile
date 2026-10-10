import { captureContentContext } from '@/features/content-safety';
import { File } from 'expo-file-system';

import { ApiError, authenticatedRequest, fetchRequest, getAccessToken, getAuthPort, timedFetch } from '@/shared/api';
import { getAppConfig } from '@/shared/config';

import { isHazardReport, isHazardVoteResult, type HazardReport, type HazardSeverity, type HazardType, type HazardVoteResult } from '../domain/types';

/**
 * 移植自 Web `src/lib/api/a11y.ts` 的通報 API（commit f82cda8）。
 * 通報與投票是「選擇性登入」：有 token 才帶 Authorization（後端壞 token 會默默退回匿名、不回 401）。
 */

const BASE = '/api/v1/a11y/reports';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function ok(res: { ok?: boolean; success?: boolean }): boolean {
  return res.ok === true || res.success === true;
}

function optionalAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface HazardReportInput {
  hazardType: HazardType;
  severity: HazardSeverity;
  latitude: number;
  longitude: number;
  description?: string;
  photo: { uri: string; name: string; type: string };
}

export type CreateHazardResult = { merged: boolean; report: HazardReport | null };

/** 後端在寫入結果不確定時（`REPORT_COMMIT_UNCERTAIN`）可能附上回報編號，讓前端改查詢而不是重送。 */
export function uncertainReportId(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.reason !== 'REPORT_COMMIT_UNCERTAIN' || !isRecord(error.data)) return null;
  return typeof error.data.reportId === 'string' ? error.data.reportId : null;
}

/** `multipart/form-data`，單一檔案欄位 `photo`；200＝合併到附近既有回報、201＝新回報。 */
export async function createHazardReport(input: HazardReportInput): Promise<CreateHazardResult> {
  const form = new FormData();
  form.append('hazardType', input.hazardType);
  form.append('severity', input.severity);
  form.append('latitude', String(input.latitude));
  form.append('longitude', String(input.longitude));
  if (input.description) form.append('description', input.description);
  // Expo 57 的 fetch 不接受 RN 的 URI 描述物件；File 提供原始 bytes，保留照片與 EXIF。
  form.append('photo', new File(input.photo.uri));
  const res = await fetchRequest(BASE, { method: 'POST', body: form, headers: optionalAuthHeaders() });
  if (!ok(res)) throw new ApiError(res.message, res.code);
  const data = isRecord(res.data) ? res.data : {};
  return { merged: data.merged === true, report: isHazardReport(data.report) ? data.report : null };
}

export async function getNearbyHazardReports(lat: number, lng: number, radius = 1000, signal?: AbortSignal): Promise<HazardReport[]> {
  const query = `lat=${lat}&lng=${lng}&radius=${Math.round(radius)}&limit=50`;
  const res = await fetchRequest(`${BASE}?${query}`, { method: 'GET', signal, requireAuth: Boolean(getAccessToken()), isCurrent: captureContentContext() });
  if (!ok(res) || !isRecord(res.data) || !Array.isArray(res.data.reports)) return [];
  return res.data.reports.filter(isHazardReport);
}

export interface MyReportsPage {
  reports: HazardReport[];
  nextCursor: string | null;
}

/** 本人的回報（新到舊、含過期與未採用），cursor 分頁。 */
export async function getMyHazardReports(cursor?: string | null, signal?: AbortSignal): Promise<MyReportsPage> {
  const query = cursor ? `?limit=20&cursor=${encodeURIComponent(cursor)}` : '?limit=20';
  const res = await authenticatedRequest(`${BASE}/mine${query}`, { method: 'GET', signal });
  if (!ok(res)) throw new ApiError(res.message, res.code);
  if (!isRecord(res.data) || !Array.isArray(res.data.reports) || !res.data.reports.every(isHazardReport)
    || (res.data.nextCursor != null && typeof res.data.nextCursor !== 'string')) {
    throw new ApiError('Invalid owned reports response', 502);
  }
  return {
    reports: res.data.reports.filter(isHazardReport),
    nextCursor: typeof res.data.nextCursor === 'string' ? res.data.nextCursor : null,
  };
}

/** 公開單筆查詢（不帶 reporterId）。查無回 null；網路或其他錯誤照常拋出。 */
export async function getHazardReport(id: string, signal?: AbortSignal): Promise<HazardReport | null> {
  try {
    return await fetchHazardReport(id, signal);
  } catch (error) {
    if (error instanceof ApiError && (error.code === 404 || error.code === 410)) return null;
    throw error;
  }
}

/** 同上，但查無也拋 `ApiError`（審核輪詢靠 404／410 判斷「回報不存在」）。 */
export async function fetchHazardReport(id: string, signal?: AbortSignal): Promise<HazardReport> {
  const res = await fetchRequest(`${BASE}/${encodeURIComponent(id)}`, { method: 'GET', signal, requireAuth: Boolean(getAccessToken()), isCurrent: captureContentContext() });
  // 非 2xx 已由 fetchRequest 拋出（含 404／410）；這裡只剩「回應形狀不符」，當成暫時錯誤而不是「回報不存在」
  if (!ok(res) || !isRecord(res.data) || !isHazardReport(res.data.report)) throw new ApiError(res.message || 'Invalid report response', 502);
  return res.data.report;
}

/**
 * 回報照片：`GET /reports/:id/photo` 直接串流圖片 bytes（JPEG／PNG／WebP），只開放本人與管理者，需要 Bearer token。
 * 交給 expo-image 帶 header 下載；私人照片不進磁碟快取（後端 `Cache-Control: private, no-store`）。
 * 不提供 Storage URL 備援，也不請求舊資料殘留的 `photoUrl`。
 */
export function hazardPhotoSource(id: string): { uri: string; headers: Record<string, string> } | null {
  const token = getAccessToken();
  if (!token || !id || id === '.' || id === '..') return null;
  return {
    uri: `${getAppConfig().apiBaseUrl}${BASE}/${encodeURIComponent(id)}/photo`,
    headers: { Authorization: `Bearer ${token}`, Accept: 'image/jpeg, image/png, image/webp' },
  };
}

export async function confirmHazardReport(id: string, action: 'confirm' | 'deny'): Promise<HazardVoteResult> {
  const res = await fetchRequest(`${BASE}/${encodeURIComponent(id)}/confirm`, {
    method: 'POST',
    body: { action },
    headers: optionalAuthHeaders(),
  });
  if (!ok(res) || !isHazardVoteResult(res.data)) throw new ApiError(res.message, res.code);
  return res.data;
}

/**
 * 照片載入失敗後的補救（Web `getHazardPhoto` 的 401 → refresh → 重試一次）：expo-image 的 onError 看不到狀態碼，
 * 先用 HEAD 問一次——200 代表只是 token 舊了，換成目前 token 重載；401 才觸發 refresh；其他（404、403…）就是真的沒有圖。
 */
export async function recoverHazardPhotoSource(id: string): Promise<{ uri: string; headers: Record<string, string> } | null> {
  const source = hazardPhotoSource(id);
  if (!source) return null;
  const response = await timedFetch(source.uri, { method: 'HEAD', headers: source.headers });
  if (response.ok) return source;
  if (response.status !== 401) return null;
  const port = getAuthPort();
  const token = await port.refresh(port.getSession());
  return token ? hazardPhotoSource(id) : null;
}
