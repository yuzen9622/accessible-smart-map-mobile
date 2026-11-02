import type { PlanStop } from '../hooks/useRoutePlanViewModel';

export interface StopListLabels {
  removeStop: string;
  moveUp: string;
  moveDown: string;
  /** 拖曳把手的 VoiceOver 提示。 */
  reorderHint: string;
}

/** 起訖點之間的停靠點列：每列上方自帶虛線分隔，可以拖曳排序（Apple 地圖：長按整列拖曳）。 */
export interface StopListProps {
  stops: PlanStop[];
  labels: StopListLabels;
  /**
   * `to` 是移除 `from` 之後的插入位置（跟 `RouteSessionState.moveStop` 一致）。
   * Android 的把手在手勢開始時就記住這個函式，所以它要直接寫 store、不能依賴當下 render 的閉包。
   */
  onMove: (from: number, to: number) => void;
}
