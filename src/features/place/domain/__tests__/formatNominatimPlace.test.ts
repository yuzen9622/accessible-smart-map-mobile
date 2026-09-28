import { formatNominatimPlace } from '../formatNominatimPlace';

describe('formatNominatimPlace', () => {
  const taipeiStation = {
    display_name: '3, 北平西路, 黎明里, 中正區, 台北站前, 臺北市, 100, 臺灣',
    address: {
      house_number: '3',
      road: '北平西路',
      village: '黎明里',
      suburb: '中正區',
      city: '臺北市',
      postcode: '100',
      country: '臺灣',
      country_code: 'tw',
    },
  };

  it('台灣地址依 縣市→區→里→路→號 組合，並補「號」', () => {
    const result = formatNominatimPlace(taipeiStation, 'zh-TW');
    expect(result.display_name).toBe('臺北市中正區黎明里北平西路3號');
  });

  it('沒有 POI 欄位時名稱取 display_name 第一段', () => {
    expect(formatNominatimPlace(taipeiStation, 'zh-TW').name).toBe('3');
  });

  it('有 POI 欄位（例如 tourism）時優先當作名稱', () => {
    const result = formatNominatimPlace(
      { ...taipeiStation, address: { ...taipeiStation.address, tourism: '台北101觀景台' } },
      'zh-TW',
    );
    expect(result.name).toBe('台北101觀景台');
  });

  it('不改動傳入的物件', () => {
    const input = { ...taipeiStation };
    formatNominatimPlace(input, 'zh-TW');
    expect(input.display_name).toBe(taipeiStation.display_name);
  });

  it('沒有 address 時從 display_name 過濾郵遞區號後反轉組合（台灣）', () => {
    expect(formatNominatimPlace({ display_name: '北平西路, 中正區, 100, 臺北市' }, 'zh-TW').display_name).toBe(
      '臺北市中正區',
    );
  });
});
