// 移植自 Web `BusPanel.tsx` 的 `CityNameMap`（commit 5eadc71），並加上依縣市分組的純函式。

export const BUS_CITY_NAMES: Readonly<Record<string, string>> = {
  Taipei: '台北市',
  NewTaipei: '新北市',
  Taoyuan: '桃園市',
  Taichung: '台中市',
  Tainan: '台南市',
  Kaohsiung: '高雄市',
  Keelung: '基隆市',
  Hsinchu: '新竹市',
  HsinchuCounty: '新竹縣',
  MiaoliCounty: '苗栗縣',
  ChanghuaCounty: '彰化縣',
  NantouCounty: '南投縣',
  YunlinCounty: '雲林縣',
  ChiayiCounty: '嘉義縣',
  Chiayi: '嘉義市',
  PingtungCounty: '屏東縣',
  YilanCounty: '宜蘭縣',
  HualienCounty: '花蓮縣',
  TaitungCounty: '台東縣',
  KinmenCounty: '金門縣',
  PenghuCounty: '澎湖縣',
  LienchiangCounty: '連江縣',
  InterCity: '公路公車',
};

/** 城市代碼轉顯示名；未知代碼原樣顯示（不捏造名稱）。 */
export function busCityLabel(city: string): string {
  return BUS_CITY_NAMES[city] ?? city;
}

export interface BusCityGroup<T> {
  city: string;
  label: string;
  items: T[];
}

/** 依城市分組，組與組內項目都保留 API 回傳（已依距離／相關度排序）的先後順序。 */
export function groupByCity<T extends { city: string }>(items: readonly T[]): BusCityGroup<T>[] {
  const groups = new Map<string, BusCityGroup<T>>();
  for (const item of items) {
    const existing = groups.get(item.city);
    if (existing) existing.items.push(item);
    else groups.set(item.city, { city: item.city, label: busCityLabel(item.city), items: [item] });
  }
  return [...groups.values()];
}
