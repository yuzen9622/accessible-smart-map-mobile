import type { PinnedFacilityCategory } from './facilities';

/**
 * 類別色：三色在淺／深底圖上都要可辨識，且不只靠顏色區分（詳情與清單都有文字類別）。
 * 白色外框讓點在建物與道路上仍清楚。
 */
export const FACILITY_COLORS: Record<PinnedFacilityCategory, string> = {
  elevator: '#1B7F3B',
  ramp: '#C45A00',
  toilet: '#6A1B9A',
};

export const FACILITY_CLUSTER_COLOR = '#1565C0';
