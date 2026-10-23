import { FACILITY } from '@/shared/theme/palettes';

import type { PinnedFacilityCategory } from './facilities';

/**
 * 類別色：三色在淺／深底圖上都要可辨識，且不只靠顏色區分（詳情與清單都有文字類別）。
 * 白色外框讓點在建物與道路上仍清楚。
 */
export const FACILITY_COLORS: Record<PinnedFacilityCategory, string> = {
  elevator: FACILITY.elevator.line,
  ramp: FACILITY.ramp.line,
  toilet: FACILITY.toilet.line,
};

export const FACILITY_CLUSTER_COLOR = FACILITY.cluster.line;
