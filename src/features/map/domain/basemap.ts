// 移植自 Web src/lib/map/basemap3d.ts（5eadc71）的最小子集：同一份 style 內以透明度切 2D/3D，不 reload style。
import type {
  ExpressionSpecification,
  FillExtrusionLayerSpecification,
  StyleSpecification,
} from '@maplibre/maplibre-gl-style-spec';

export type MapTheme = 'light' | 'dark';

export const MAP_STYLE_URLS: Record<MapTheme, string> = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

/** OpenFreeMap style 的向量圖磚 source id */
export const BASEMAP_SOURCE_ID = 'openmaptiles';
export const BUILDING_3D_LAYER_ID = 'app-building-3d';
const STYLE_BUILDING_3D_ID = 'building-3d';
const FLAT_BUILDING_MAX_ZOOM = 24;

export function isStyleSpecification(value: unknown): value is StyleSpecification {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    'sources' in value &&
    'layers' in value &&
    Array.isArray(value.layers)
  );
}

/**
 * 移除 liberty 內建的 building-3d（改由 app 的圖層控制淡入淡出），
 * 並讓平面 building 在所有 zoom 都可見（liberty 原本 z14 以上交給 3D 圖層）。
 */
export function prepareBasemapStyle(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers
      .filter((layer) => layer.id !== STYLE_BUILDING_3D_ID)
      .map((layer) =>
        layer.id === 'building' ? { ...layer, maxzoom: FLAT_BUILDING_MAX_ZOOM } : layer,
      ),
  };
}

type LabelLanguage = 'zh-TW' | 'en';

function labelTextField(language: LabelLanguage): ExpressionSpecification {
  return language === 'zh-TW'
    ? ['coalesce', ['get', 'name:zh-Hant'], ['get', 'name:zh'], ['get', 'name']]
    : ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']];
}

/**
 * 移植 Web ClientMap.tsx:64-91 applyMapLanguage：OpenMapTiles 預設標籤是雙語
 * "{name:latin}\n{name:nonlatin}"，改成只跟隨 UI 語系。
 * 原生版在傳進地圖前改寫 style JSON（maplibre-react-native 沒有 setLayoutProperty），
 * 只動 text-field 含 "name" 的 symbol 圖層（門牌、路線編號等保持原樣），已相同時沿用原物件。
 */
export function applyLabelLanguage(style: StyleSpecification, language: LabelLanguage): StyleSpecification {
  const textField = labelTextField(language);
  const target = JSON.stringify(textField);
  return {
    ...style,
    layers: style.layers.map((layer) => {
      if (layer.type !== 'symbol') return layer;
      const current = layer.layout?.['text-field'];
      if (current === undefined) return layer;
      const serialized = JSON.stringify(current);
      if (!serialized.includes('name') || serialized === target) return layer;
      return { ...layer, layout: { ...layer.layout, 'text-field': textField } };
    }),
  };
}

const HEIGHT_EXPR: ExpressionSpecification = [
  'coalesce',
  ['get', 'render_height'],
  ['get', 'height'],
  3,
];

/** 深色底圖的建物是暗色疊暗色，半透明會糊掉，所以深色用不透明。 */
export function buildingExtrusionOpacity(theme: MapTheme): number {
  return theme === 'dark' ? 1 : 0.85;
}

export function buildingExtrusionPaint(
  theme: MapTheme,
  visible: boolean,
): NonNullable<FillExtrusionLayerSpecification['paint']> {
  const [low, high] =
    theme === 'dark'
      ? ['hsl(220,10%,17%)', 'hsl(220,12%,27%)']
      : ['hsl(35,10%,89%)', 'hsl(35,8%,77%)'];
  return {
    'fill-extrusion-height': HEIGHT_EXPR,
    'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
    'fill-extrusion-color': ['interpolate', ['linear'], HEIGHT_EXPR, 0, low, 60, high],
    'fill-extrusion-vertical-gradient': true,
    'fill-extrusion-opacity': visible ? buildingExtrusionOpacity(theme) : 0,
    'fill-extrusion-opacity-transition': { duration: 600, delay: 0 },
  };
}

export const MAP_PITCH_3D = 60;
