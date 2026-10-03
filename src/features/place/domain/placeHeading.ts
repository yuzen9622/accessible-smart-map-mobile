import { formatTaiwanAddress } from './formatTaiwanAddress';

export interface PlaceHeading {
  title: string;
  /** 「類別 · 距離 · 地址」；三者都沒有時為 null */
  subtitle: string | null;
}

/**
 * 地點詳情標頭：標題用地名，沒有地名（反查座標點）就用整理後的地址；副標題「類別 · 距離 · 地址」。
 *
 * 先去掉地址開頭重複的地名再整理格式：Nominatim 的 fullAddress 常以地名開頭
 * （「安侯建業…, 7, 信義路五段…」），地名那段不是地址片段，留著會讓 `formatTaiwanAddress` 放棄整理。
 */
export function buildPlaceHeading(input: {
  name: string | null;
  address: string | null;
  typeLabel: string | null;
  distanceText: string | null;
}): PlaceHeading {
  const { name, typeLabel, distanceText } = input;
  const raw = input.address?.trim() || null;
  const withoutName = raw && name && raw.startsWith(name) ? raw.slice(name.length).replace(/^[\s,，、]+/, '') : raw;
  const address = withoutName ? formatTaiwanAddress(withoutName) : null;
  const title = name || address || '';
  const subtitle =
    [typeLabel, distanceText, address && address !== title ? address : null]
      .filter((part): part is string => Boolean(part))
      .join(' · ') || null;
  return { title, subtitle };
}
