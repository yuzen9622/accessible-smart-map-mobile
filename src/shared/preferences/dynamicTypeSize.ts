import { FONT_SCALE, type FontSizeLevel } from './preferences';

// React Native 0.86 RCTAccessibilityManager's iOS category multipliers.
// SwiftUI uses discrete categories: choose the closest to system × app scale.
const SIZES = [
  ['xSmall', 0.823], ['small', 0.882], ['medium', 0.941], ['large', 1],
  ['xLarge', 1.118], ['xxLarge', 1.235], ['xxxLarge', 1.353],
  ['accessibility1', 1.786], ['accessibility2', 2.143], ['accessibility3', 2.643],
  ['accessibility4', 3.143], ['accessibility5', 3.571],
] as const;

export function preferredDynamicTypeSize(level: FontSizeLevel, systemScale: number) {
  // No override at the default preference: inherit the native environment exactly.
  if (level === 'medium') return undefined;
  const target = (Number.isFinite(systemScale) && systemScale > 0 ? systemScale : 1) * FONT_SCALE[level];
  return SIZES.reduce((best, size) => Math.abs(size[1] - target) < Math.abs(best[1] - target) ? size : best)[0];
}
