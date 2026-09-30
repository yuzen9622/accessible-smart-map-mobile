// 移植自 Web `src/components/Voice/VoiceSessionHost.tsx:29-47`（`toNavInstruction`，commit f5027af），抽成純函式以便測試。
// 差異：Web 以 `as` 直接轉 `type`／`relativeDirection`；這裡只接受已知值，未知值退回推導值／null。
import type { NavInstruction, NavInstructionType, RelativeDirection } from '@/features/route/domain';

import type { VoiceNavStep } from './voiceSession';

const INSTRUCTION_TYPES: readonly NavInstructionType[] = ['turn', 'transit_board', 'transit_alight', 'facility', 'depart', 'arrive'];
const RELATIVE_DIRECTIONS: readonly Exclude<RelativeDirection, null>[] = ['正前方', '左前方', '右前方', '左側', '右側', '左後方', '右後方', '正後方'];

function isInstructionType(value: unknown): value is NavInstructionType {
  return typeof value === 'string' && INSTRUCTION_TYPES.some((type) => type === value);
}

function toRelativeDirection(value: unknown): RelativeDirection {
  return RELATIVE_DIRECTIONS.find((direction) => direction === value) ?? null;
}

/** 後端 `nav.start`／`nav.resume_ok`／`nav.route_replaced` 的 `NavStepDto` → 導航引擎的 `NavInstruction`。 */
export function toNavInstruction(step: VoiceNavStep): NavInstruction {
  return {
    text: step.instruction,
    type: isInstructionType(step.type) ? step.type : step.isTransit ? 'transit_board' : step.index === 0 ? 'depart' : 'turn',
    bearing: step.bearing ?? null,
    relativeDirection: toRelativeDirection(step.relativeDirection),
    distanceM: step.distanceM,
    streetName: step.streetName ?? null,
    legType: step.legType,
    // 語音指令沒有 polyline 索引；導航 controller 的 withSyntheticPolylineIndices 會補
    polylineIndex: null,
  };
}
