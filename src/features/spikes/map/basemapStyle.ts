// Spike A：驗證「同一份 style 內 2D/3D 交叉淡化」。移植自 Web src/lib/map/basemap3d.ts 的最小子集。
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

export const BUILDING_3D_ID = 'spike-building-3d';
const STYLE_BUILDING_3D_ID = 'building-3d';
const FLAT_BUILDING_MAX_ZOOM = 24;

function isStyleSpecification(value: unknown): value is StyleSpecification {
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
 * 取回 OpenFreeMap style，移除 liberty 內建的 building-3d（改由我們的圖層控制），
 * 並讓平面 building 在所有 zoom 都可見——與 Web basemap3d.ts 的做法一致。
 */
export async function loadBasemapStyle(theme: MapTheme): Promise<StyleSpecification> {
  const response = await fetch(MAP_STYLE_URLS[theme]);
  if (!response.ok) throw new Error(`style HTTP ${response.status}`);
  const json: unknown = await response.json();
  if (!isStyleSpecification(json)) throw new Error('style JSON 格式不符');
  return {
    ...json,
    layers: json.layers
      .filter((layer) => layer.id !== STYLE_BUILDING_3D_ID)
      .map((layer) =>
        layer.id === 'building' ? { ...layer, maxzoom: FLAT_BUILDING_MAX_ZOOM } : layer,
      ),
  };
}

const HEIGHT_EXPR: ExpressionSpecification = [
  'coalesce',
  ['get', 'render_height'],
  ['get', 'height'],
  3,
];

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
    'fill-extrusion-opacity': visible ? (theme === 'dark' ? 1 : 0.85) : 0,
    'fill-extrusion-opacity-transition': { duration: 600, delay: 0 },
  };
}
