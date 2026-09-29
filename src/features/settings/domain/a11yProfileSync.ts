import type { A11yProfile, A11ySituation } from '@/features/onboarding/domain';
import { deriveRouteMode, impliesStepFree } from '@/features/onboarding/domain';

/**
 * 本機需求輪廓（onboarding 的 `situations` 等）與後端 `GET|PUT /api/v1/user/a11y-profile` 的對照。
 * Web 版目前沒有同步（輪廓只在 localStorage）；原生新增，讓登入後 `POST /a11y/accessible-route`
 * 在沒帶偏好時也能套用伺服器端的預設（後端 FRONTEND_MIGRATION_A11Y_PROFILE.md）。
 *
 * 合併規則（登入後執行一次）：本機已有任何需求 → 本機為準、上傳；本機是空的且伺服器有資料 → 帶入本機。
 */

export type MobilityAid = 'manual_wheelchair' | 'power_wheelchair' | 'walker' | 'none';

export interface ServerA11yProfile {
  mobilityAid: MobilityAid | null;
  canUseStairs: boolean | null;
  maxSlopePercent: number | null;
  needsAccessibleToilet: boolean | null;
  needsElevator: boolean | null;
  needsHandrail: boolean | null;
  visualAssistance: boolean | null;
  preferredFontScale: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function boolOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function numOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseServerA11yProfile(value: unknown): ServerA11yProfile | null {
  if (!isRecord(value)) return null;
  const aid = value.mobilityAid;
  return {
    mobilityAid:
      aid === 'manual_wheelchair' || aid === 'power_wheelchair' || aid === 'walker' || aid === 'none' ? aid : null,
    canUseStairs: boolOrNull(value.canUseStairs),
    maxSlopePercent: numOrNull(value.maxSlopePercent),
    needsAccessibleToilet: boolOrNull(value.needsAccessibleToilet),
    needsElevator: boolOrNull(value.needsElevator),
    needsHandrail: boolOrNull(value.needsHandrail),
    visualAssistance: boolOrNull(value.visualAssistance),
    preferredFontScale: numOrNull(value.preferredFontScale),
  };
}

/** 伺服器沒有任何一個欄位有值＝從未設定。 */
export function isServerProfileEmpty(profile: ServerA11yProfile): boolean {
  return Object.values(profile).every((v) => v === null);
}

/** PUT body：只送本機能表達的欄位（其他欄位 undefined 不送，後端保留原值）。 */
export function toServerA11yProfile(profile: A11yProfile): Partial<ServerA11yProfile> {
  const s = profile.situations;
  const mobilityAid: MobilityAid = s.includes('wheelchair') ? 'manual_wheelchair' : s.includes('walker') ? 'walker' : 'none';
  return {
    mobilityAid,
    canUseStairs: !profile.avoidStairs,
    needsElevator: profile.requireElevator,
    visualAssistance: s.includes('vision'),
    needsAccessibleToilet: s.includes('wheelchair') ? true : null,
  };
}

export function fromServerA11yProfile(server: ServerA11yProfile, base: A11yProfile): A11yProfile {
  const situations: A11ySituation[] = [];
  if (server.mobilityAid === 'manual_wheelchair' || server.mobilityAid === 'power_wheelchair') situations.push('wheelchair');
  if (server.mobilityAid === 'walker') situations.push('walker');
  if (server.visualAssistance) situations.push('vision');
  const stepFree = impliesStepFree(situations);
  const explicitStairs = server.canUseStairs !== null || server.needsElevator !== null;
  return {
    ...base,
    situations,
    routeMode: deriveRouteMode(situations),
    routeModeAuto: true,
    avoidStairs: server.canUseStairs === null ? stepFree : !server.canUseStairs,
    requireElevator: server.needsElevator ?? stepFree,
    // 伺服器明確給了階梯／電梯偏好就固定住，之後改 situations 不要蓋掉
    stepFreeFlagsAuto: !explicitStairs,
  };
}

export type ProfileSyncDecision = { kind: 'push' } | { kind: 'pull'; profile: A11yProfile } | { kind: 'none' };

export function decideProfileSync(local: A11yProfile, server: ServerA11yProfile | null): ProfileSyncDecision {
  if (local.situations.length > 0) return { kind: 'push' };
  if (server && !isServerProfileEmpty(server)) {
    const pulled = fromServerA11yProfile(server, local);
    return pulled.situations.length > 0 || !pulled.stepFreeFlagsAuto ? { kind: 'pull', profile: pulled } : { kind: 'none' };
  }
  return { kind: 'none' };
}
