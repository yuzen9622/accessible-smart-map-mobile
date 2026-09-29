import { FONT_SCALE } from './preferences';
import { usePreferencesStore } from './preferencesStore';

/** App 內字級倍率（搭配 `shared/theme` 的 `scaledSize`）；系統 Dynamic Type 仍由 RN `Text` 自動套用。 */
export function useFontScale(): number {
  return FONT_SCALE[usePreferencesStore((s) => s.fontSize)];
}
