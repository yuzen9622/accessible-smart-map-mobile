import type { IconName } from '@/shared/ui/Icon.types';
import type { WeatherInfo } from './environment';

/** 複合天氣先判斷降水；未知描述不猜測天氣。 */
export function weatherIcon(condition: WeatherInfo['condition']): IconName | null {
  if (!condition) return null;
  if (/雷/.test(condition)) return 'cloudLightning';
  if (/雹/.test(condition)) return 'cloudHail';
  if (/雪|霰/.test(condition)) return 'cloudSnow';
  if (/雨/.test(condition)) return 'cloudRain';
  if (/霧|霾/.test(condition)) return 'cloudFog';
  if (/晴/.test(condition) && /雲|陰/.test(condition)) return 'cloudSun';
  if (/雲|陰/.test(condition)) return 'cloud';
  if (/晴/.test(condition)) return 'sun';
  return null;
}
