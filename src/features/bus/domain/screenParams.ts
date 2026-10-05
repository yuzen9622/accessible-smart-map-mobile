import type { BusDirection } from '../types/transit';
import { isBusDirection } from './busDirections';

// Expo Router 的 search params 只有字串（或字串陣列）：集中在這裡收窄，畫面不直接信任外部輸入。

/** 取單一字串參數；缺值或陣列取第一個。 */
export function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export function parseFiniteParam(value: string | string[] | undefined): number | null {
  const raw = firstParam(value);
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** 站牌經過的路線清單以 JSON 字串陣列傳遞；壞資料回空陣列。 */
export function parseRouteListParam(value: string | string[] | undefined): string[] {
  const raw = firstParam(value);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((r): r is string => typeof r === 'string') : [];
  } catch {
    return [];
  }
}

/** 導覽方向參數：只接受 "0"、"1"、"2"、"10"、"255"；空字串與其他字串視為未選擇（不經 `Number('')` 變成 0）。 */
export function parseDirectionParam(value: string | string[] | undefined): BusDirection | null {
  const raw = firstParam(value);
  if (!/^(0|1|2|10|255)$/.test(raw)) return null;
  const n = Number(raw);
  return isBusDirection(n) ? n : null;
}
