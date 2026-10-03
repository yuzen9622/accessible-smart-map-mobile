import { formatTaiwanAddress } from '../formatTaiwanAddress';

describe('formatTaiwanAddress', () => {
  it('reorders an OSM display_name into Taiwanese order and drops village, district area, postcode and country', () => {
    expect(formatTaiwanAddress('7, 信義路五段, 西村里, 信義區, 信義商圈, 臺北市, 11049, 臺灣')).toBe('臺北市信義區信義路五段7號');
  });

  it('keeps lane and alley order from large to small', () => {
    expect(formatTaiwanAddress('3, 5弄, 120巷, 忠孝東路四段, 大安區, 臺北市, 106, 臺灣')).toBe('臺北市大安區忠孝東路四段120巷5弄3號');
  });

  it('treats a county-administered city as the district', () => {
    expect(formatTaiwanAddress('10, 光明六路, 竹北市, 新竹縣, 302, 臺灣')).toBe('新竹縣竹北市光明六路10號');
  });

  it('does not append 號 twice', () => {
    expect(formatTaiwanAddress('7號, 信義路五段, 信義區, 臺北市')).toBe('臺北市信義區信義路五段7號');
  });

  it('cleans a Google formatted address and drops the village like the comma format', () => {
    expect(formatTaiwanAddress('110台灣臺北市信義區西村里信義路五段No. 7號')).toBe('臺北市信義區信義路五段7號');
  });

  it('keeps districts whose names contain 里', () => {
    expect(formatTaiwanAddress('412台灣台中市大里區中興路一段100號')).toBe('台中市大里區中興路一段100號');
    expect(formatTaiwanAddress('207台灣新北市萬里區萬里路1號')).toBe('新北市萬里區萬里路1號');
  });

  it('keeps a 3-digit house number that looks like a postcode', () => {
    expect(formatTaiwanAddress('101, 市府路, 信義區, 臺北市, 110, 臺灣')).toBe('臺北市信義區市府路101號');
  });

  it('keeps 之 numbers and floors', () => {
    expect(formatTaiwanAddress('7之1, 信義路五段, 信義區, 臺北市')).toBe('臺北市信義區信義路五段7之1號');
    expect(formatTaiwanAddress('7號3樓, 信義路五段, 信義區, 臺北市')).toBe('臺北市信義區信義路五段7號3樓');
  });

  it('skips science parks and planning areas when picking the district', () => {
    expect(formatTaiwanAddress('1, 瑞光路, 內湖科技園區, 內湖區, 臺北市')).toBe('臺北市內湖區瑞光路1號');
  });

  it('returns the original when any part is unrecognised instead of dropping it', () => {
    expect(formatTaiwanAddress('7, Xinyi Rd Sec 5, 信義區, 臺北市')).toBe('7, Xinyi Rd Sec 5, 信義區, 臺北市');
    expect(formatTaiwanAddress('7F, 信義路五段, 信義區, 臺北市')).toBe('7F, 信義路五段, 信義區, 臺北市');
  });

  it('does not mistake a night market for a city', () => {
    expect(formatTaiwanAddress('101, 基河路, 士林夜市, 士林區, 臺北市')).toBe('臺北市士林區基河路101號');
  });

  it('returns the original when no city or road can be recognised', () => {
    expect(formatTaiwanAddress('信義商圈, 西村里')).toBe('信義商圈, 西村里');
  });

  it('leaves non-Chinese addresses untouched', () => {
    expect(formatTaiwanAddress('1600 Amphitheatre Pkwy, Mountain View, CA')).toBe('1600 Amphitheatre Pkwy, Mountain View, CA');
  });
});
