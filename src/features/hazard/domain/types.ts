/**
 * 危險通報型別，移植自 Web `src/types/route.ts` 的 `HazardReport`（commit f82cda8），形狀以後端
 * `hazard-report.schema.ts` 為準；補上 type guard。
 */
export type HazardType = 'obstacle' | 'construction' | 'data_error';
export type HazardSeverity = 'blocking' | 'difficult' | 'minor';
export type HazardStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export const HAZARD_TYPES: readonly HazardType[] = ['obstacle', 'construction', 'data_error'];
export const HAZARD_SEVERITIES: readonly HazardSeverity[] = ['minor', 'difficult', 'blocking'];

export interface HazardReport {
  _id: string;
  reporterId?: string;
  hazardType: HazardType;
  severity?: HazardSeverity;
  expectedUntil?: string | null;
  reportedLocation: { type: 'Point'; coordinates: [number, number] };
  description?: string;
  photoUrl?: string;
  status: HazardStatus;
  aiVerification?: { verdict: 'verified' | 'suspicious' | 'rejected' | 'skipped'; confidence: number; reason: string };
  confirmCount?: number;
  denyCount?: number;
  createdAt?: string;
  expiredAt?: string;
}

export interface HazardVoteResult {
  reportId: string;
  action: 'confirm' | 'deny';
  confirmCount: number;
  denyCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const optStr = (v: unknown) => v === undefined || typeof v === 'string';
const optNum = (v: unknown) => v === undefined || (typeof v === 'number' && Number.isFinite(v));

export function isHazardReport(v: unknown): v is HazardReport {
  if (!isRecord(v) || typeof v._id !== 'string') return false;
  if (!HAZARD_TYPES.some((t) => t === v.hazardType)) return false;
  if (v.severity !== undefined && !HAZARD_SEVERITIES.some((s) => s === v.severity)) return false;
  if (!(v.status === 'pending' || v.status === 'verified' || v.status === 'rejected' || v.status === 'expired')) return false;
  const loc = v.reportedLocation;
  if (!isRecord(loc) || !Array.isArray(loc.coordinates) || loc.coordinates.length < 2) return false;
  const [lng, lat] = loc.coordinates;
  if (typeof lng !== 'number' || typeof lat !== 'number') return false;
  return optStr(v.description) && optStr(v.photoUrl) && optStr(v.reporterId) && optNum(v.confirmCount) && optNum(v.denyCount) && optStr(v.createdAt);
}

export function isHazardVoteResult(v: unknown): v is HazardVoteResult {
  return (
    isRecord(v) &&
    typeof v.reportId === 'string' &&
    (v.action === 'confirm' || v.action === 'deny') &&
    typeof v.confirmCount === 'number' &&
    typeof v.denyCount === 'number'
  );
}

export function reportLatLng(report: HazardReport): { lat: number; lng: number } {
  const [lng, lat] = report.reportedLocation.coordinates;
  return { lat, lng };
}
