import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { useEffect, useState } from 'react';

import { isAppLanguage, useAppTranslation } from '@/shared/i18n';

import { fetchBasemapStyle } from '../api/basemapStyle';
import type { MapTheme } from '../domain/basemap';

export type BasemapState =
  | { status: 'loading' }
  | { status: 'ready'; style: StyleSpecification }
  | { status: 'error'; error: string };

export function useBasemapStyle(theme: MapTheme, reloadKey: number): BasemapState {
  const { i18n } = useAppTranslation();
  const language = isAppLanguage(i18n.language) ? i18n.language : 'zh-TW';
  const [state, setState] = useState<BasemapState>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const style = await fetchBasemapStyle(theme, language, controller.signal);
        setState({ status: 'ready', style });
      } catch (error) {
        if (!controller.signal.aborted) setState({ status: 'error', error: String(error) });
      }
    };
    void load();
    return () => controller.abort();
  }, [theme, language, reloadKey]);
  return state;
}
