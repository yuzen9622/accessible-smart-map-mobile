import { pointLabel } from '../routeDisplay';

describe('pointLabel', () => {
  it('keeps plain strings', () => {
    expect(pointLabel('台北車站')).toBe('台北車站');
  });

  it('reads name, then address, then label from point objects instead of printing [object Object]', () => {
    expect(pointLabel({ name: '市政府', lat: 25, lng: 121 })).toBe('市政府');
    expect(pointLabel({ address: '信義路五段7號', lat: 25, lng: 121 })).toBe('信義路五段7號');
    expect(pointLabel({ label: '停車場', lat: 25, lng: 121 })).toBe('停車場');
  });

  it('falls back for coordinate-only points and empty values', () => {
    expect(pointLabel({ lat: 25, lng: 121 }, '你的位置')).toBe('你的位置');
    expect(pointLabel({ name: '  ' }, '台北 101')).toBe('台北 101');
    expect(pointLabel('', '起點')).toBe('起點');
    expect(pointLabel(null)).toBe('');
  });
});
