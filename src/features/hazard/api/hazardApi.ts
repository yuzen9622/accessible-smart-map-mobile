import { ApiError, authenticatedRequest, fetchRequest, getAccessToken } from '@/shared/api';

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

/** `multipart/form-data`，單一檔案欄位 `photo`；200＝合併到附近既有回報、201＝新回報。 */
export async function createHazardReport(input: HazardReportInput): Promise<CreateHazardResult> {
  const form = new FormData();
  form.append('hazardType', input.hazardType);
  form.append('severity', input.severity);
  form.append('latitude', String(input.latitude));
  form.append('longitude', String(input.longitude));
  if (input.description) form.append('description', input.description);
  // RN 的 FormData 接受 { uri, name, type } 檔案描述（原生層讀檔上傳）
  form.append('photo', input.photo);
  const res = await fetchRequest(BASE, { method: 'POST', body: form, headers: optionalAuthHeaders() });
  if (!ok(res)) throw new ApiError(res.message, res.code);
  const data = isRecord(res.data) ? res.data : {};
  return { merged: data.merged === true, report: isHazardReport(data.report) ? data.report : null };
}

export async function getNearbyHazardReports(lat: number, lng: number, radius = 1000, signal?: AbortSignal): Promise<HazardReport[]> {
  const query = `lat=${lat}&lng=${lng}&radius=${Math.round(radius)}&limit=50`;
  const res = await fetchRequest(`${BASE}?${query}`, { method: 'GET', signal });
  if (!ok(res) || !isRecord(res.data) || !Array.isArray(res.data.reports)) return [];
  return res.data.reports.filter(isHazardReport);
}

export interface MyReportsPage {
  reports: HazardReport[];
  nextCursor: string | null;
}

export async function getMyHazardReports(cursor?: string | null): Promise<MyReportsPage> {
  const query = cursor ? `?limit=20&cursor=${encodeURIComponent(cursor)}` : '?limit=20';
  const res = await authenticatedRequest(`${BASE}/mine${query}`, { method: 'GET' });
  if (!ok(res)) throw new ApiError(res.message, res.code);
  if (!isRecord(res.data) || !Array.isArray(res.data.reports)) return { reports: [], nextCursor: null };
  return {
    reports: res.data.reports.filter(isHazardReport),
    nextCursor: typeof res.data.nextCursor === 'string' ? res.data.nextCursor : null,
  };
}

export async function getHazardReport(id: string, signal?: AbortSignal): Promise<HazardReport | null> {
  const res = await fetchRequest(`${BASE}/${encodeURIComponent(id)}`, { method: 'GET', signal });
  return ok(res) && isRecord(res.data) && isHazardReport(res.data.report) ? res.data.report : null;
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
