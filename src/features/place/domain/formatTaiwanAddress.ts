/**
 * 把地點詳情副標題的地址整理成台灣習慣的書寫順序（縣市 → 鄉鎮市區 → 路段巷弄 → 號）。
 *
 * 後端搜尋回來的 `fullAddress` 有兩種常見形狀：
 * - OSM `display_name`：由小到大、逗號分隔，夾雜村里、商圈、郵遞區號、國名
 *   （「7, 信義路五段, 西村里, 信義區, 信義商圈, 臺北市, 11049, 臺灣」）
 * - Google formatted address：已是台灣順序，但前面黏著郵遞區號與國名、門牌寫成「No. 7號」
 *   （「110台灣臺北市信義區西村里信義路五段No. 7號」）
 *
 * 原則是寧可醜也不要丟資訊：逗號格式的每一段都必須認得出是哪一類，只要有一段認不出來
 * （英文路名、樓層寫法、夜市名……）就原樣回傳。刻意省略的只有村里、商圈／園區這類片區、
 * 郵遞區號與國名——一般寫地址不寫，地點名稱已在標題。
 */
const CJK = /[一-鿿]/;
const COUNTRY = /^(臺灣|台灣|中華民國|Taiwan)$/i;
const POSTCODE = /^\d{3,6}$/;
/** 片區名稱常以「區」「市」結尾，必須先排除，否則會被當成行政區或縣市 */
const AREA = /(商圈|園區|計畫區|工業區|商業區|特區|重劃區|夜市|超市|市場)$/;
const VILLAGE = /(里|村|鄰)$/;
const CITY = /(市|縣)$/;
const DISTRICT = /(區|鄉|鎮)$/;
const ROAD = /(路|街|大道|段|巷|弄|衖)$/;
/** 門牌：7、7-1、7之1、7號、7號3樓、7號3樓之2 */
const HOUSE_NUMBER = /^\d+(?:[-之]\d+)?號?(?:\d+樓(?:之\d+)?)?$/;

type PartKind = 'drop' | 'city' | 'district' | 'road' | 'number';

export function formatTaiwanAddress(address: string): string {
  const trimmed = address.trim();
  if (!CJK.test(trimmed)) return trimmed;
  return /[,，]/.test(trimmed) ? formatCommaSeparated(trimmed) : formatGoogleStyle(trimmed);
}

function formatCommaSeparated(address: string): string {
  const parts = address
    .split(/[,，]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const kinds: (PartKind | null)[] = parts.map((part, index) => classify(part, index));
  if (kinds.some((kind) => kind === null)) return address;

  const pick = (kind: PartKind) => parts.filter((_, index) => kinds[index] === kind);
  // 片段由小到大：最後一個 市／縣 是直轄市或縣；前面還有 市 的話是縣轄市（如「竹北市」），算鄉鎮市區
  const cities = pick('city');
  const city = cities.at(-1) ?? '';
  const district = pick('district').at(-1) ?? (cities.length > 1 ? cities[0] : '');
  const roads = pick('road').reverse();
  const houseNumber = pick('number')[0] ?? '';

  if (!city || roads.length === 0) return address;
  const number = houseNumber && !houseNumber.includes('號') ? `${houseNumber}號` : houseNumber;
  return `${city}${district}${roads.join('')}${number}`;
}

/** 回傳 null 代表認不出來，整串地址保留原樣 */
function classify(part: string, index: number): PartKind | null {
  // OSM 的門牌一定在第一段；之後的純數字才是郵遞區號（「101, 市府路…」的 101 是門牌）
  if (index === 0 && HOUSE_NUMBER.test(part)) return 'number';
  if (COUNTRY.test(part) || POSTCODE.test(part) || AREA.test(part) || VILLAGE.test(part)) return 'drop';
  if (DISTRICT.test(part)) return 'district';
  if (CITY.test(part)) return 'city';
  if (ROAD.test(part)) return 'road';
  return null;
}

function formatGoogleStyle(address: string): string {
  return (
    address
      .replace(/^\d{3,6}\s*/, '')
      .replace(/^(臺灣|台灣)\s*/, '')
      .replace(/No\.\s*(\d)/gi, '$1')
      // 「信義區西村里信義路」→「信義區信義路」：跟逗號格式一樣不寫村里。
      // 錨點不含「市」，「里」後面也不能直接接行政區或路名字尾：否則「大里區」「萬里區」「萬里路」會被吃掉
      .replace(/([區鄉鎮])[^區鄉鎮市路街道段\d]{1,4}[里村](?![區鄉鎮市路街道段巷])(?=\S+?[路街道段])/, '$1')
  );
}
