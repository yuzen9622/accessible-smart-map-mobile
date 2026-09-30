// 移植自 Web `src/lib/voice/navProgress.ts`（commit f5027af）。`EtaSource` 取自 navigation domain；
// `NavProgressUpdate`（Web 在 useNavStore 內宣告）在原生 navigation domain 沒有對應匯出，這裡定義只含實際用到欄位的結構型別。
import type { EtaSource } from '@/features/navigation/domain';
import type { VoiceNavigationEvent } from './voiceSession';

/** 導航進度／ETA 的增量更新（結構同 Web `NavProgressUpdate`）。 */
export interface NavProgressUpdate {
  remainingM?: number | null;
  remainingDurationSec?: number | null;
  estimatedArrivalAt?: number | null;
  etaSource?: EtaSource;
  distanceToNextM?: number | null;
}

const VALID_ETA_SOURCES: Set<string> = new Set([
  'schedule',
  'realtime',
  'free_flow',
  'estimated',
  'local',
]);

function isEtaSource(value: string): value is NonNullable<EtaSource> {
  return VALID_ETA_SOURCES.has(value);
}

function toNonNegativeNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, value);
}

/**
 * `nav.progress` and `nav.resume_ok` carry the same progress/ETA payload —
 * resume_ok simply makes every field optional — so both map through here.
 */
export function toNavProgressUpdate(
  event: Extract<VoiceNavigationEvent, { type: 'nav.progress' }>,
): NavProgressUpdate {
  const update: NavProgressUpdate = {};

  if ('remainingDistanceM' in event) {
    const remainingM = toNonNegativeNumber(event.remainingDistanceM);
    if (remainingM !== undefined) update.remainingM = remainingM;
  }
  if ('remainingDurationSec' in event) {
    const remainingDurationSec = toNonNegativeNumber(
      event.remainingDurationSec,
    );
    if (remainingDurationSec !== undefined)
      update.remainingDurationSec = remainingDurationSec;
  }
  if ('estimatedArrivalAt' in event) {
    if (event.estimatedArrivalAt === null) {
      update.estimatedArrivalAt = null;
    } else if (typeof event.estimatedArrivalAt === 'string') {
      const estimatedArrivalAt = Date.parse(event.estimatedArrivalAt);
      if (!Number.isNaN(estimatedArrivalAt))
        update.estimatedArrivalAt = estimatedArrivalAt;
    }
  }
  if (
    'etaSource' in event &&
    event.etaSource &&
    isEtaSource(event.etaSource)
  ) {
    update.etaSource = event.etaSource;
  } else if (
    'remainingDurationSec' in update ||
    'estimatedArrivalAt' in update
  ) {
    update.etaSource = 'estimated';
  }
  if ('distanceToNextM' in event) {
    const distanceToNextM = toNonNegativeNumber(event.distanceToNextM);
    if (distanceToNextM !== undefined) update.distanceToNextM = distanceToNextM;
  }

  return update;
}
