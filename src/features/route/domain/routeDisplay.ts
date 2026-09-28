// 移植自 Web `src/types/route.ts`（commit 5eadc71）底部的 helper 與色彩 token，邏輯逐行保留。
// Web 把這些和型別放在同一檔；本 repo 型別放 `types/`、邏輯放 `domain/`，所以拆出來。
// `formatDistance` 在 `shared/geo`（Phase 1 移植、Phase 2 提到共用層），這裡不重複。

import type { A11yFeature, A11yLabel, DriveTrafficSegment, RouteLeg, TrafficLevel } from '../types/route';

export function getA11yLabelColor(label: A11yLabel): string {
  switch (label) {
    case 'excellent':
      return '#22c55e';
    case 'good':
      return '#84cc16';
    case 'fair':
      return '#eab308';
    case 'poor':
      return '#f97316';
    case 'critical':
      return '#ef4444';
  }
}

export function getA11yLabelText(label: A11yLabel, lang: string): string {
  if (lang === 'zh-TW') {
    switch (label) {
      case 'excellent':
        return '極佳';
      case 'good':
        return '良好';
      case 'fair':
        return '普通';
      case 'poor':
        return '較差';
      case 'critical':
        return '困難';
    }
  }
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function scoreToLabel(score: number): A11yLabel {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  if (score >= 20) return 'poor';
  return 'critical';
}

export function scoreToStars(score: number): number {
  if (score >= 85) return 5;
  if (score >= 70) return 4;
  if (score >= 50) return 3;
  if (score >= 30) return 2;
  return 1;
}

// 後端只分類、不評好壞。地圖圖層與路線卡圖例共用這一份，避免兩邊對不上——
// 圖例是唯一告訴使用者某個顏色代表什麼的地方。
export const A11Y_FEATURE_COLOR: Record<A11yFeature, string> = {
  stairs: '#dc2626',
  crossing: '#f59e0b',
  curb_ramp_crossing: '#16a34a',
  ramp: '#16a34a',
  elevator: '#2563eb',
  escalator: '#2563eb',
  moving_walkway: '#2563eb',
  fare_gate: '#7c3aed',
  exit_gate: '#7c3aed',
};

export const TRAFFIC_LEVEL_COLORS: Record<TrafficLevel, string> = {
  light: '#22C55E',
  moderate: '#F59E0B',
  heavy: '#EF4444',
  severe: '#991B1B',
  closed: '#4B5563',
  unknown: '#3B82F6',
};

export const TRAFFIC_BASE_COLOR = '#475569';

// "unknown" 不帶任何路況資訊，宣稱 unknown 的線段不得蓋掉底線、暗示這段路有量測過。
const VALID_TRAFFIC_LEVELS = new Set<TrafficLevel>(['light', 'moderate', 'heavy', 'severe', 'closed']);

export function visibleTrafficSegments(
  segments: DriveTrafficSegment[] | undefined,
  polylineLength: number,
): DriveTrafficSegment[] {
  if (!Array.isArray(segments) || !segments.length) return [];
  return segments
    .filter(
      (s): s is DriveTrafficSegment =>
        Boolean(s) &&
        VALID_TRAFFIC_LEVELS.has(s.trafficLevel) &&
        Number.isInteger(s.fromIndex) &&
        Number.isInteger(s.toIndex) &&
        s.fromIndex >= 0 &&
        s.toIndex < polylineLength &&
        s.fromIndex < s.toIndex,
    )
    .sort((a, b) => a.fromIndex - b.fromIndex);
}

const LEG_COLORS: Record<RouteLeg['type'], string> = {
  WALK: '#3b82f6',
  BUS: '#22c55e',
  METRO: '#FF6B35',
  THSR: '#f97316',
  TRA: '#003366',
  DRIVE: '#475569',
  MOTORCYCLE: '#dc2626',
};

export function getLegColor(leg: RouteLeg): string {
  return LEG_COLORS[leg.type] ?? LEG_COLORS.BUS;
}

export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes)) return '';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins} min`;
}

// 坡度來自 DEM，帶有物理上不可能的離群值——圖資裡有超過 6000% 的邊，API 也會回 1033.8。
// 超過這些上限的數字是雜訊，不代表路比較平或比較陡。
const SLOPE_PLAUSIBLE_MAX_STAIRS = 100;
const SLOPE_PLAUSIBLE_MAX_PATH = 35;

export function plausibleSlopePercent(value: number | null | undefined, hasStairs: boolean): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const limit = hasStairs ? SLOPE_PLAUSIBLE_MAX_STAIRS : SLOPE_PLAUSIBLE_MAX_PATH;
  return value > limit ? null : value;
}
