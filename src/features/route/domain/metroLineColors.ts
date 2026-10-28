import { METRO_LINE_FILL, METRO_LINE_INK } from '@/shared/theme/palettes';

export interface MetroLineColors {
  /** 官方線色：徽章底色、地圖線、時間軸軌道。 */
  fill: string;
  /** `fill` 上的文字／圖示色（白或深色取對比高者），也是淺色線在白底上的外框色。 */
  fg: string;
}

/** 捷運線色；不是捷運、沒有 lineKey、或線不在表內時回 null（沿用模式色）。 */
export function metroLineColors(type: string, lineKey: string | undefined): MetroLineColors | null {
  if (type !== 'METRO' || !lineKey) return null;
  const fill = METRO_LINE_FILL[lineKey];
  const fg = METRO_LINE_INK[lineKey];
  return fill && fg ? { fill, fg } : null;
}
