import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { useEffect, useState } from 'react';

import { isAppLanguage, useAppTranslation } from '@/shared/i18n';

import { fetchBasemapStyle } from '../api/basemapStyle';
import type { MapTheme } from '../domain/basemap';

export type BasemapState =
  | { status: 'loading' }
  | { status: 'ready'; style: StyleSpecification }
  | { status: 'error'; error: string };

/**
 * 以 `theme + language` 為 key 快取已抓到的 style，避免使用者切換系統深色模式時
 * （例如在控制中心切換）畫面要重新連網下載整份底圖，造成地圖短暫停在舊配色、
 * 和已經換色的其他 UI 不同步的卡頓（使用者回饋 2026-10-24 錄影）。
 * `reloadKey` 變動時代表呼叫端明確要求重抓（例如使用者手動重試），略過快取。
 */
const styleCache = new Map<string, StyleSpecification>();

export function useBasemapStyle(theme: MapTheme, reloadKey: number): BasemapState {
  const { i18n } = useAppTranslation();
  const language = isAppLanguage(i18n.language) ? i18n.language : 'zh-TW';
  const cacheKey = `${theme}:${language}`;
  const cached = reloadKey === 0 ? styleCache.get(cacheKey) : undefined;
  const [fetched, setFetched] = useState<BasemapState>({ status: 'loading' });

  useEffect(() => {
    if (reloadKey === 0 && styleCache.has(cacheKey)) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const style = await fetchBasemapStyle(theme, language, controller.signal);
        styleCache.set(cacheKey, style);
        setFetched({ status: 'ready', style });
      } catch (error) {
        if (!controller.signal.aborted) setFetched({ status: 'error', error: String(error) });
      }
    };
    void load();
    return () => controller.abort();
  }, [theme, language, reloadKey, cacheKey]);

  // 快取命中時直接在 render 時回傳，不經過 state／effect，才不會閃一下 loading。
  return cached ? { status: 'ready', style: cached } : fetched;
}
