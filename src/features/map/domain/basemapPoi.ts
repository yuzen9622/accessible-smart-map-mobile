import type { ExpressionSpecification, LayerSpecification, StyleSpecification, SymbolLayerSpecification } from '@maplibre/maplibre-gl-style-spec';

import { BASEMAP_SOURCE_ID, type MapTheme } from './basemap';

/**
 * 底圖上「可以點」的店家／景點：只有 OpenFreeMap liberty 這幾個 POI symbol 圖層（依 rank 分 zoom 出現，
 * 加上大眾運輸）。點地圖時只查這些圖層「目前畫出來」的 feature，所以哪些 POI 可點跟著 zoom 與碰撞避讓走，
 * 點空白處、道路、建物都不開地點面板（對齊 Apple／Google 地圖）。
 */
export const BASEMAP_POI_LAYER_IDS = ['poi_r20', 'poi_r7', 'poi_r1', 'poi_transit'] as const;

/** 點擊容錯（pt）：圖示約 15–19pt，四周放寬一點方便手指點中，但不要大到點空白也選到店家。 */
export const POI_HIT_SLOP = 10;

const POINT_FILTER: ExpressionSpecification = ['match', ['geometry-type'], ['MultiPoint', 'Point'], true, false];

const DARK_POI_PAINT: NonNullable<SymbolLayerSpecification['paint']> = {
  'icon-opacity': 0.8,
  'text-color': 'hsl(0,0%,62%)',
  'text-halo-blur': 0.5,
  'text-halo-color': 'rgba(0,0,0,0.8)',
  'text-halo-width': 1,
};

function poiRankLayer(id: string, minzoom: number, rank: [number, number?]): SymbolLayerSpecification {
  const [min, max] = rank;
  return {
    id,
    type: 'symbol',
    source: BASEMAP_SOURCE_ID,
    'source-layer': 'poi',
    minzoom,
    filter: max === undefined
      ? ['all', POINT_FILTER, ['>=', ['get', 'rank'], min]]
      : ['all', POINT_FILTER, ['>=', ['get', 'rank'], min], ['<', ['get', 'rank'], max]],
    layout: {
      'icon-image': ['match', ['get', 'subclass'], ['florist', 'furniture'], ['get', 'subclass'], ['get', 'class']],
      'text-anchor': 'top',
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-max-width': 9,
      'text-offset': [0, 0.6],
      'text-size': 12,
    },
    paint: DARK_POI_PAINT,
  };
}

/** liberty 的 POI 圖層定義（zoom、rank、圖示規則照搬），配色改成深色底圖用。 */
function darkPoiLayers(): SymbolLayerSpecification[] {
  return [
    poiRankLayer('poi_r20', 17, [20]),
    poiRankLayer('poi_r7', 16, [7, 20]),
    poiRankLayer('poi_r1', 15, [1, 7]),
    {
      id: 'poi_transit',
      type: 'symbol',
      source: BASEMAP_SOURCE_ID,
      'source-layer': 'poi',
      filter: ['match', ['get', 'class'], ['airport', 'bus', 'rail'], true, false],
      layout: {
        'icon-image': ['to-string', ['get', 'class']],
        'icon-size': 0.7,
        'text-anchor': 'left',
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 9,
        'text-offset': [0.9, 0],
        'text-size': 12,
      },
      paint: { ...DARK_POI_PAINT, 'text-color': 'hsl(210,35%,62%)' },
    },
  ];
}

/**
 * OpenFreeMap dark 沒有任何 POI 圖層（只有 liberty 有），深色模式就沒有可點的店家。
 * 兩套 style 共用同一份 sprite，所以缺 POI 時把 liberty 的定義補進去，插在地名標籤之前
 * （地名壓在 POI 上面，同 liberty 的疊放順序）。已有 POI 圖層的 style 原樣回傳。
 */
export function ensurePoiLayers(style: StyleSpecification, theme: MapTheme): StyleSpecification {
  const ids = new Set(style.layers.map((layer) => layer.id));
  if (BASEMAP_POI_LAYER_IDS.some((id) => ids.has(id)) || theme !== 'dark') return style;
  const insertAt = style.layers.findIndex(
    (layer) => layer.type === 'symbol' && 'source-layer' in layer && layer['source-layer'] === 'place',
  );
  const at = insertAt === -1 ? style.layers.length : insertAt;
  const layers: LayerSpecification[] = [...style.layers.slice(0, at), ...darkPoiLayers(), ...style.layers.slice(at)];
  return { ...style, layers };
}

const OSM_TYPE_BY_CODE: Record<number, 'node' | 'way' | 'relation'> = { 1: 'node', 2: 'way', 3: 'relation' };

/**
 * OpenFreeMap（planetiler-openmaptiles）的 POI feature id 是 `OSM id × 10 + 型別碼`（1 node、2 way、
 * 3 relation；2026-10-27 以台北圖磚對照 OSM API 核實）。轉成 App 的地點 id `osm:<type>:<id>`，
 * 可以直接走 `/place/[id]` 拿後端完整詳情；格式不符時回 `null`。
 */
export function osmPlaceIdFromFeatureId(id: unknown): string | null {
  const value = typeof id === 'number' ? id : typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : Number.NaN;
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  const type = OSM_TYPE_BY_CODE[value % 10];
  const osmId = Math.floor(value / 10);
  return type && osmId > 0 ? `osm:${type}:${osmId}` : null;
}

export interface BasemapPoiHit {
  /** `osm:<type>:<id>`；圖磚沒帶可用 id 時為 `null`（改用座標開面板） */
  placeId: string | null;
  position: { lat: number; lng: number };
}

interface QueriedFeature {
  id?: string | number;
  geometry: { type: string; coordinates?: unknown } | null;
}

function pointOf(feature: QueriedFeature): { lng: number; lat: number } | null {
  const geometry = feature.geometry;
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  const coords: unknown = geometry.type === 'MultiPoint' ? geometry.coordinates[0] : geometry.coordinates;
  if (!Array.isArray(coords)) return null;
  const [lng, lat]: unknown[] = coords;
  return typeof lng === 'number' && typeof lat === 'number' ? { lng, lat } : null;
}

/** 容錯範圍內可能同時點到好幾個 POI：取離點擊位置最近的那個。 */
export function pickPoiHit(features: readonly QueriedFeature[], tap: { lng: number; lat: number }): BasemapPoiHit | null {
  const scale = Math.cos((tap.lat * Math.PI) / 180);
  let best: { hit: BasemapPoiHit; distance: number } | null = null;
  for (const feature of features) {
    const point = pointOf(feature);
    if (!point) continue;
    const distance = ((point.lng - tap.lng) * scale) ** 2 + (point.lat - tap.lat) ** 2;
    if (best && best.distance <= distance) continue;
    best = { hit: { placeId: osmPlaceIdFromFeatureId(feature.id), position: point }, distance };
  }
  return best?.hit ?? null;
}
