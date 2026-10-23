// 路線詳情頁的逐步時間軸（參考設計圖三：每個步驟旁邊有實際時鐘時間，不是只有相對分鐘數）。
//
// 大眾運輸 leg（公車／捷運／高鐵／台鐵）後端已經給 "HH:mm" 格式的 `departureTime`／`arrivalTime`
// （純字串，呼叫端直接印，不是 ISO 時間戳——`LegDetail.tsx` 既有程式碼就是直接字串插值，沒有
// `new Date()` 解析）；步行／開車沒有這兩個欄位，只有估計分鐘數。這裡把兩種資料併成同一條時間軸：
// 有真實時刻的 leg 直接採用（順便把游標對齊，補上等車空檔），其餘用估計分鐘數往下推。

import { driveLegMinutes } from './routeCard';
import type { RouteLeg } from '../types/route';

export interface LegClockEntry {
  /** 這段開始的時鐘時間（"HH:mm"）。 */
  departureLabel: string;
  /** 這段結束的時鐘時間（"HH:mm"）。 */
  arrivalLabel: string;
}

/** 把 "HH:mm" 解析成當天的分鐘數；格式不對回 null（資料不乾淨時整段放棄排時間軸，不瞎猜）。 */
function parseClockMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatClockMinutes(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function legDurationMinutes(leg: RouteLeg): number {
  switch (leg.type) {
    case 'WALK':
      return leg.minutesEst;
    case 'DRIVE':
    case 'MOTORCYCLE':
      return driveLegMinutes(leg);
    case 'BUS':
      return leg.rideMinutes ?? 0;
    case 'METRO':
    case 'THSR':
    case 'TRA':
      return leg.rideMinutes;
  }
}

/** 有真實時刻的 leg 類型才可能帶 `departureTime`／`arrivalTime`；步行與開車沒有這兩個欄位。 */
function realClock(leg: RouteLeg): { departure: string; arrival: string } | null {
  if (leg.type !== 'BUS' && leg.type !== 'METRO' && leg.type !== 'THSR' && leg.type !== 'TRA') return null;
  if (!leg.departureTime || !leg.arrivalTime) return null;
  return { departure: leg.departureTime, arrival: leg.arrivalTime };
}

/**
 * 從 `startMinutes`（出發時刻，當天分鐘數，一般是現在時間或規劃時選的出發時間）往下推算每段的
 * 時鐘時間。大眾運輸 leg 用後端給的真實時刻校正游標（含等車空檔），步行／開車用估計分鐘數累加。
 * 回傳陣列長度一定等於 `legs.length`；單一 leg 解析失敗時該筆退回累加估計，不中斷整條時間軸。
 */
export function computeLegClock(legs: readonly RouteLeg[], startMinutes: number): LegClockEntry[] {
  const out: LegClockEntry[] = [];
  let cursor = startMinutes;
  for (const leg of legs) {
    const real = realClock(leg);
    const departureParsed = real ? parseClockMinutes(real.departure) : null;
    const arrivalParsed = real ? parseClockMinutes(real.arrival) : null;
    if (departureParsed != null && arrivalParsed != null) {
      out.push({ departureLabel: formatClockMinutes(departureParsed), arrivalLabel: formatClockMinutes(arrivalParsed) });
      // 真實到站時刻可能比估計的游標晚（等車空檔），一律對齊到真實時刻，不讓後面的 leg 延用舊游標。
      cursor = arrivalParsed >= departureParsed ? arrivalParsed : arrivalParsed + 1440;
      continue;
    }
    const departure = cursor;
    const arrival = departure + Math.round(legDurationMinutes(leg));
    out.push({ departureLabel: formatClockMinutes(departure), arrivalLabel: formatClockMinutes(arrival) });
    cursor = arrival;
  }
  return out;
}

/** 現在時間的「當天分鐘數」；沒有指定出發時間時，時間軸從「現在出發」起算。 */
export function nowClockMinutes(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}
