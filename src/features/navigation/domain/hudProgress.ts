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
