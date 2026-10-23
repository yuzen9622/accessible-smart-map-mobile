// 移植自 Web `src/lib/transit/departureCandidates.ts`（commit c8447f7）。
// 時刻固定以台灣時間（UTC+8、無日光節約）換算，不依賴裝置時區，也不依賴 Hermes 的 Intl 時區支援。
import type { BusDepartureCandidate, BusLeg } from '../types/route';

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/;

function instantMs(instant: string | null | undefined): number | null {
  if (!instant || !ISO_WITH_OFFSET.test(instant)) return null;
  const ms = Date.parse(instant);
  return Number.isFinite(ms) ? ms : null;
}

/** `HH:mm`（台灣時間）；沒有可信時刻時回 null。 */
export function formatRouteClock(instant: string | null | undefined): string | null {
  const ms = instantMs(instant);
  if (ms === null) return null;
  const local = new Date(ms + TAIPEI_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

/** 台灣日曆日的差（跨午夜的抵達顯示「+1」）。 */
export function routeDayOffset(instant: string | null | undefined, reference: string | null | undefined): number | null {
  const ms = instantMs(instant);
  const from = instantMs(reference);
  if (ms === null || from === null) return null;
  const day = (value: number) => Math.floor((value + TAIPEI_OFFSET_MS) / 86_400_000);
  return day(ms) - day(from);
}

/** 距離某時刻還有幾整分（已過回 0）；時刻不可信回 null。 */
export function minutesUntil(instant: string | null | undefined, now: number): number | null {
  const ms = instantMs(instant);
  return ms === null ? null : Math.max(0, Math.round((ms - now) / 60_000));
}

/** 顯示順序是後端的。查看別班不會選定那班。 */
export function resolveViewedCandidate(
  candidates: readonly BusDepartureCandidate[],
  viewedCandidateId?: string,
): BusDepartureCandidate | null {
  return candidates.find((c) => c.candidateId === viewedCandidateId) ?? candidates.find((c) => c.selected) ?? null;
}

/** 即時班次的 id 以上車時刻結尾，每次 ETA 刷新都會變；前面（子路線、方向、車牌）才是「同一班車」。 */
function serviceId(candidateId: string): string {
  const end = candidateId.lastIndexOf('|');
  return end < 0 ? candidateId : candidateId.slice(0, end);
}

/** 刷新後，先前查看的那班車對應到的新項目（那班車還在的話）。 */
export function followCandidate(
  candidates: readonly BusDepartureCandidate[],
  previous: BusDepartureCandidate,
): BusDepartureCandidate | undefined {
  const exact = candidates.find((c) => c.candidateId === previous.candidateId);
  if (exact) return exact;
  const before = Date.parse(previous.boardingTime ?? '');
  const gap = (c: BusDepartureCandidate) => Math.abs(Date.parse(c.boardingTime ?? '') - before) || 0;
  return candidates
    .filter((c) => serviceId(c.candidateId) === serviceId(previous.candidateId))
    .sort((a, b) => gap(a) - gap(b))[0];
}

/** 同一條路線的多個班次只佔一個徽章；沒有候選時退回規劃的路線名。 */
export function busRouteNames(leg: BusLeg, candidates = leg.departureCandidates): string[] {
  const names = [...new Set(candidates?.map((c) => c.routeName))];
  return names.length ? names : [leg.routeName];
}

export type CandidateDeparture =
  | { kind: 'live'; minutes: number; clock: string | null }
  | { kind: 'scheduled'; clock: string }
  | { kind: 'unknown' };

/**
 * 一班車「何時到上車站」：即時班次以上車時刻倒數（後端的 `estimatedWaitMinutes` 是查詢當下的值，
 * 畫面停留越久越不準），沒有時刻才用它；時刻表班次顯示發車時刻。
 */
export function candidateDeparture(candidate: BusDepartureCandidate, now: number): CandidateDeparture {
  const clock = formatRouteClock(candidate.boardingTime);
  if (candidate.boardingTimeSource === 'realtime') {
    const minutes =
      minutesUntil(candidate.boardingTime, now) ??
      (candidate.estimatedWaitMinutes === null ? null : Math.max(0, Math.round(candidate.estimatedWaitMinutes)));
    if (minutes !== null) return { kind: 'live', minutes, clock };
  }
  return clock ? { kind: 'scheduled', clock } : { kind: 'unknown' };
}

/** 規劃（導航採用）的班次；沒有就是 null。 */
export function plannedCandidate(leg: BusLeg): BusDepartureCandidate | null {
  return leg.departureCandidates?.find((c) => c.selected) ?? null;
}
