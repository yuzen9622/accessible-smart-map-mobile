import { weatherIcon } from '../weatherIcon';

it.each([
  ['晴', 'sun'],
  ['多雲', 'cloud'],
  ['陰', 'cloud'],
  ['多雲時晴', 'cloudSun'],
  ['晴時多雲', 'cloudSun'],
  ['陰短暫雨', 'cloudRain'],
  ['多雲短暫陣雨', 'cloudRain'],
  ['午後雷陣雨', 'cloudLightning'],
  ['陰有雷雨伴隨冰雹', 'cloudLightning'],
  ['冰雹', 'cloudHail'],
  ['雨夾雪', 'cloudSnow'],
  ['霰', 'cloudSnow'],
  ['晴有霧', 'cloudFog'],
  ['霾', 'cloudFog'],
  ['  多雲  ', 'cloud'],
  [null, null],
  ['', null],
  ['  ', null],
  ['未知', null],
])('%s maps to %s', (condition, expected) => {
  expect(weatherIcon(condition)).toBe(expected);
});
