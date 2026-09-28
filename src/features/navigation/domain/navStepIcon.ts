// 移植自 Web `src/components/Navigation/navStepIcon.ts`（commit 5eadc71），對應規則逐條保留。
// 差異：Web 直接回傳 lucide-react 元件；本 repo 的 `Icon` 以名稱取圖（`@/shared/ui` 是 lucide-react-native
// 的唯一入口），所以這裡回傳名稱，保持 domain 純淨。名稱與 Lucide 元件一一對應（`cornerUpRight` → `CornerUpRight`），
// HUD 接上時在 `shared/ui` 的 Icon 名稱表補上這些名稱。

import type { NavInstruction } from '@/features/route/domain';

import { isVehicleLegType } from './legMode';

export type NavStepIconName = 'arrowDown' | 'arrowUp' | 'arrowUpDown' | 'arrowUpLeft' | 'arrowUpRight' | 'bike' | 'bus' | 'car' | 'cornerUpLeft' | 'cornerUpRight' | 'flag' | 'navigation' | 'redo2' | 'squareParking' | 'tramFront' | 'undo2';

/** Direction arrows, shared by every travel mode — a right turn looks the
 * same whether the user is walking or driving it. */
function directionIcon(step: NavInstruction): NavStepIconName {
  switch (step.relativeDirection) {
    case '正前方':
      return 'arrowUp';
    case '左前方':
      return 'arrowUpLeft';
    case '右前方':
      return 'arrowUpRight';
    case '左側':
      return 'cornerUpLeft';
    case '右側':
      return 'cornerUpRight';
    case '左後方':
      return 'undo2';
    case '右後方':
      return 'redo2';
    case '正後方':
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
