import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

import {
  MAP_STYLE_URLS,
  applyLabelLanguage,
  isStyleSpecification,
  prepareBasemapStyle,
  type MapTheme,
} from '../domain/basemap';
import type { AppLanguage } from '@/shared/i18n';

/** 取回 OpenFreeMap style（外部圖磚服務，非本專案 API，所以不走 shared/api）。 */
export async function fetchBasemapStyle(
  theme: MapTheme,
  language: AppLanguage,
  signal?: AbortSignal,
): Promise<StyleSpecification> {
  const response = await fetch(MAP_STYLE_URLS[theme], { signal });
  if (!response.ok) throw new Error(`basemap style HTTP ${response.status}`);
  const json: unknown = await response.json();
  if (!isStyleSpecification(json)) throw new Error('basemap style JSON 格式不符');
  return applyLabelLanguage(prepareBasemapStyle(json), language);
}
