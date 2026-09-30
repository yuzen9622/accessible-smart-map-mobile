// HUD 底部列的剩餘時間與 ETA，移植自 Web `src/components/Navigation/NavigationHUD.tsx`（commit 5eadc71）。

import type { NavRerouteReason } from './types';

export interface HudProgressInput {
  remainingDurationSec: number | null;
  remainingM: number | null;
  routeTotalM: number | null;
  routeTotalMinutes: number | null;
  estimatedArrivalAt: number | null;
  now: number;
}

export interface HudProgress {
  /** 至少 1 分鐘；無從推估時為 null。 */
  remainMinutes: number | null;
  /** 預計抵達（epoch ms）。 */
  arrivalAt: number | null;
}

export function hudProgress(input: HudProgressInput): HudProgress {
  let remainMinutes: number | null = null;
  if (input.remainingDurationSec != null && Number.isFinite(input.remainingDurationSec)) {
    remainMinutes = Math.max(1, Math.round(input.remainingDurationSec / 60));
  } else if (
    input.routeTotalMinutes != null &&
    input.remainingM != null &&
    input.routeTotalM != null &&
    input.routeTotalM > 0
  ) {
    remainMinutes = Math.max(1, Math.round((input.routeTotalMinutes * input.remainingM) / input.routeTotalM));
  } else if (input.routeTotalMinutes != null && Number.isFinite(input.routeTotalMinutes)) {
    // 引擎還沒算出第一筆進度（剛開始導航、定位還沒更新）：先顯示整條路線的時間，而不是空白。
    remainMinutes = Math.max(1, Math.round(input.routeTotalMinutes));
  }
  const arrivalAt =
    input.estimatedArrivalAt ?? (remainMinutes != null ? input.now + remainMinutes * 60_000 : null);
  return { remainMinutes, arrivalAt };
}

export const REROUTE_REASON_KEY: Record<NavRerouteReason, string> = {
  OFF_ROUTE: 'rerouteReasonOffRoute',
  FACILITY_OUTAGE: 'rerouteReasonFacilityOutage',
  CONFIRMED_HAZARD: 'rerouteReasonHazard',
  TRANSIT_DISRUPTION: 'rerouteReasonTransitDisruption',
  MANUAL: 'rerouteReasonManual',
};

/** 重算列文字（Web：rerouteError ?? pending 時的原因 ?? offRoute）。回傳 i18n key 或原文。 */
export function rerouteStripText(args: {
  rerouteError: string | null;
  rerouteStatus: 'idle' | 'pending' | 'error';
  lastRerouteReason: NavRerouteReason | null;
}): { key: string } | { text: string } {
  if (args.rerouteError) return { text: args.rerouteError };
  if (args.rerouteStatus === 'pending') {
    return { key: args.lastRerouteReason ? REROUTE_REASON_KEY[args.lastRerouteReason] : 'recalculate' };
  }
  return { key: 'offRoute' };
}

// 「約 110 公尺」「for about 110 m」這類距離片語；橫幅已用大字顯示即時距離，指示文字再寫一次會打架。
const ZH_NUM = String.raw`約?\s*[\d.,]+\s*(?:公尺|公里|米)`;
const EN_NUM = String.raw`(?:for\s+)?(?:about\s+|approximately\s+|approx\.\s+)?[\d.,]+\s*(?:m|meters?|metres?|km|kilometers?|kilometres?)\b`;
// 整個子句只是「動詞＋距離」（「，續行約 130 公尺」「, then continue for 40 m」）：連逗號一起拿掉，不留半截動詞。
const ZH_CLAUSE = new RegExp(String.raw`[，,]\s*[^，,。]{0,3}?${ZH_NUM}\s*(?=[，,。]|$)`, 'g');
const EN_CLAUSE = new RegExp(String.raw`,\s*(?:then\s+)?(?:continue|walk|go|keep going)\s+${EN_NUM}\s*(?=[,.]|$)`, 'gi');
const ZH_DISTANCE = new RegExp(ZH_NUM, 'g');
const EN_DISTANCE = new RegExp(String.raw`\s*\b${EN_NUM}`, 'gi');

/** 指示文字：拿掉步驟文字裡寫死的距離（橫幅大字距離會隨定位即時更新，「接著」卡另有距離欄）。 */
export function stripStepDistance(text: string): string {
  const stripped = text
    .replace(ZH_CLAUSE, '')
    .replace(EN_CLAUSE, '')
    .replace(ZH_DISTANCE, '')
    .replace(EN_DISTANCE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return stripped || text;
}
