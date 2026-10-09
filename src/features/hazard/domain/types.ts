/**
 * 危險通報型別，移植自 Web `src/types/route.ts` 的 `HazardReport`（commit 58f1840 + 照片端點），形狀以後端
 * `hazard-report.view.ts` 的白名單 DTO 為準；補上 type guard。
 */
export type HazardType = 'obstacle' | 'construction' | 'data_error';
export type HazardSeverity = 'blocking' | 'difficult' | 'minor';
export type HazardStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export const HAZARD_TYPES: readonly HazardType[] = ['obstacle', 'construction', 'data_error'];
export const HAZARD_SEVERITIES: readonly HazardSeverity[] = ['minor', 'difficult', 'blocking'];

export type HazardReviewState = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type HazardReviewDecision = 'supported' | 'needs_evidence' | 'unsupported';
export type HazardRequiredEvidence = 'wider_view' | 'clearer_image' | 'matching_hazard' | 'map_reference';

/** AI 照片審核 v2（後端 `aiReview`）。 */
export interface HazardAiReview {
  state: HazardReviewState;
  decision?: HazardReviewDecision;
  reasonCode?: string;
  reason?: string;
  observations?: string[];
  limitations?: string[];
  visibleHazards?: string[];
  requiredEvidence?: HazardRequiredEvidence[];
  /** 後端判定 worker 逾時：停止自動刷新，不要無限轉圈。 */
  delayed?: boolean;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export function isHazardType(value: unknown): value is HazardType {
  return HAZARD_TYPES.some((t) => t === value);
}

export interface HazardReport {
  _id: string;
  /** 只有本人（`/reports/mine`、送出回應）才會帶；公開 GET 不帶。 */
  reporterId?: string;
  hazardType: HazardType;
  severity?: HazardSeverity;
  expectedUntil?: string | null;
  reportedLocation: { type: 'Point'; coordinates: [number, number] };
  description?: string;
  /** 照片端點 `GET /reports/:id/photo` 是否有圖；公開 DTO 不再給 Storage URL。 */
  hasPhoto?: boolean;
  status: HazardStatus;
  exifValidation?: { timestampFresh?: boolean; gpsPresent?: boolean; gpsMatchesClaimed?: boolean };
  aiReview?: HazardAiReview;
  aiVerification?: { verdict: 'verified' | 'suspicious' | 'rejected' | 'skipped'; confidence: number; reason: string };
  confirmCount?: number;
  denyCount?: number;
  createdAt?: string;
  updatedAt?: string;
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
  if (v.aiReview !== undefined && !isAiReview(v.aiReview)) return false;
  return optStr(v.description) && optStr(v.reporterId) && optNum(v.confirmCount) && optNum(v.denyCount) && optStr(v.createdAt);
}

const REVIEW_STATES: readonly HazardReviewState[] = ['queued', 'processing', 'completed', 'failed', 'cancelled'];

function isAiReview(v: unknown): v is HazardAiReview {
  return isRecord(v) && REVIEW_STATES.some((s) => s === v.state);
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : []);

/** 審核清單欄位去重、只留字串（後端是 LLM 產出，不信任形狀）。 */
export function reviewList(review: HazardAiReview | undefined, key: 'observations' | 'limitations' | 'visibleHazards' | 'requiredEvidence'): string[] {
  return review ? strings(review[key]) : [];
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

/** `hasPhoto: false` 優先；舊後端沒有 `hasPhoto` 時，只把殘留的 `photoUrl` 當成「有照片」的訊號（絕不直接請求它）。 */
export function reportHasPhoto(report: HazardReport & { photoUrl?: unknown }): boolean {
  return report.hasPhoto ?? typeof report.photoUrl === 'string';
}

export function reportLatLng(report: HazardReport): { lat: number; lng: number } {
  const [lng, lat] = report.reportedLocation.coordinates;
  return { lat, lng };
}
