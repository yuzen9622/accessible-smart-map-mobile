// 移植自 Web `src/components/Navigation/navStepIcon.ts`（commit 5eadc71），對應規則逐條保留。
// 差異：Web 直接回傳 lucide-react 元件；本 repo 的 `Icon` 以名稱取圖（`@/shared/ui` 是 lucide-react-native
// 的唯一入口），所以這裡回傳名稱，保持 domain 純淨。名稱與 Lucide 元件一一對應（`cornerUpRight` → `CornerUpRight`），
// HUD 接上時在 `shared/ui` 的 Icon 名稱表補上這些名稱。

import type { NavInstruction } from '@/features/route/domain';

import { isVehicleLegType } from './legMode';

export type NavStepIconName = 'arrowDown' | 'arrowUp' | 'arrowUpDown' | 'arrowUpLeft' | 'arrowUpRight' | 'bike' | 'bus' | 'car' | 'cornerUpLeft' | 'cornerUpRight' | 'flag' | 'navigation' | 'redo2' | 'squareParking' | 'tramFront' | 'undo2';

// Without userHeading the backend intentionally returns relativeDirection: null.
// Match only the leading maneuver in its bilingual templates, never a street name
// or a later instruction, so a known turn does not silently become a straight arrow.
const TEXT_DIRECTIONS: readonly [RegExp, NavStepIconName][] = [
  [/^(?:Turn slightly left\b|(?:請)?稍向左轉)/i, 'arrowUpLeft'],
  [/^(?:Turn slightly right\b|(?:請)?稍向右轉)/i, 'arrowUpRight'],
  [/^(?:Turn sharply left\b|(?:請)?大幅向左轉)/i, 'undo2'],
  [/^(?:Turn sharply right\b|(?:請)?大幅向右轉)/i, 'redo2'],
  [/^(?:Turn left\b|向左轉)/i, 'cornerUpLeft'],
  [/^(?:Turn right\b|向右轉)/i, 'cornerUpRight'],
  [/^(?:Make a U-turn\b|請迴轉)/i, 'arrowDown'],
];

/** Direction arrows, shared by every travel mode — a right turn looks the
 * same whether the user is walking or driving it.
 *
 * `step.text` wins over `relativeDirection` when both are present: `text` is
 * verbatim what the voice announcer speaks (`navigationController.speak(step.text)`),
 * so matching the icon to it guarantees the arrow and the spoken word always
 * agree. `relativeDirection` is a separate backend-computed field (bearing
 * math) and has been observed to disagree with `text` on some steps — e.g.
 * showing a left-turn arrow while the voice says "向右轉" — which is worse
 * than falling back to a coarser text-pattern match. */
function directionIcon(step: NavInstruction): NavStepIconName {
  const fromText = TEXT_DIRECTIONS.find(([pattern]) => pattern.test(step.text.trim()))?.[1];
  if (fromText) return fromText;
  if (step.relativeDirection == null) return 'arrowUp';
  switch (step.relativeDirection) {
    case '正前方':
    case 'ahead':
      return 'arrowUp';
    case '左前方':
    case 'ahead-left':
      return 'arrowUpLeft';
    case '右前方':
    case 'ahead-right':
      return 'arrowUpRight';
    case '左側':
    case 'left':
      return 'cornerUpLeft';
    case '右側':
    case 'right':
      return 'cornerUpRight';
    case '左後方':
    case 'behind-left':
      return 'undo2';
    case '右後方':
    case 'behind-right':
      return 'redo2';
    case '正後方':
    case 'behind':
      return 'arrowDown';
    default:
      return 'arrowUp';
  }
}

export function stepIcon(step: NavInstruction | undefined): NavStepIconName {
  if (!step) return 'arrowUp';

  // Vehicle legs get their own departure and end-of-leg glyphs: a driving leg
  // ends at a parking space, not at the door.
  if (isVehicleLegType(step.legType)) {
    switch (step.type) {
      case 'depart':
        return step.legType === 'MOTORCYCLE' ? 'bike' : 'car';
      case 'arrive':
      case 'facility':
        return 'squareParking';
      default:
        return directionIcon(step);
    }
  }

  switch (step.type) {
    case 'arrive':
      return 'flag';
    case 'depart':
      return 'navigation';
    case 'transit_board':
    case 'transit_alight':
      return step.legType === 'BUS' ? 'bus' : 'tramFront';
    case 'facility':
      return 'arrowUpDown';
    default:
      return directionIcon(step);
  }
}
