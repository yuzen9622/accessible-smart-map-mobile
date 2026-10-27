import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

import { applyLabelLanguage } from '../basemap';
import { BASEMAP_POI_LAYER_IDS, ensurePoiLayers, osmPlaceIdFromFeatureId, pickPoiHit } from '../basemapPoi';

const darkStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: 'background', type: 'background' },
    { id: 'highway_name_other', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name' },
    { id: 'place_other', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place' },
    { id: 'place_city', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place' },
  ],
};

describe('ensurePoiLayers', () => {
  it('深色 style 缺 POI 時補上，插在地名標籤之前', () => {
    const next = ensurePoiLayers(darkStyle, 'dark');
    expect(next.layers.map((layer) => layer.id)).toEqual([
      'background',
      'highway_name_other',
      ...BASEMAP_POI_LAYER_IDS,
      'place_other',
      'place_city',
    ]);
    expect(darkStyle.layers).toHaveLength(4);
  });

  it('補上的 POI 標籤也會被語系改寫', () => {
    const next = applyLabelLanguage(ensurePoiLayers(darkStyle, 'dark'), 'en');
    const poi = next.layers.find((layer) => layer.id === 'poi_r1');
    expect(poi?.type === 'symbol' ? poi.layout?.['text-field'] : undefined).toEqual([
      'coalesce',
      ['get', 'name:en'],
      ['get', 'name:latin'],
      ['get', 'name'],
    ]);
  });

  it('已有 POI 圖層（liberty）或淺色主題時原樣回傳', () => {
    const liberty: StyleSpecification = {
      ...darkStyle,
      layers: [...darkStyle.layers, { id: 'poi_r1', type: 'symbol', source: 'openmaptiles', 'source-layer': 'poi' }],
    };
    expect(ensurePoiLayers(liberty, 'dark')).toBe(liberty);
    expect(ensurePoiLayers(darkStyle, 'light')).toBe(darkStyle);
  });
});

describe('osmPlaceIdFromFeatureId', () => {
  it('末位型別碼 1/2/3 對應 node/way/relation', () => {
    expect(osmPlaceIdFromFeatureId(77288404471)).toBe('osm:node:7728840447');
    expect(osmPlaceIdFromFeatureId(2796847852)).toBe('osm:way:279684785');
    expect(osmPlaceIdFromFeatureId('52572723')).toBe('osm:relation:5257272');
  });

  it('沒有 id 或型別碼不合法時回 null', () => {
    expect(osmPlaceIdFromFeatureId(undefined)).toBeNull();
    expect(osmPlaceIdFromFeatureId(12345)).toBeNull();
    expect(osmPlaceIdFromFeatureId('abc1')).toBeNull();
    expect(osmPlaceIdFromFeatureId(1)).toBeNull();
    expect(osmPlaceIdFromFeatureId(-11)).toBeNull();
  });
});

describe('pickPoiHit', () => {
  const tap = { lng: 121.5, lat: 25.04 };
  const point = (id: number | undefined, lng: number, lat: number) => ({
    id,
    geometry: { type: 'Point', coordinates: [lng, lat] },
  });

  it('沒點到 POI 回 null', () => {
    expect(pickPoiHit([], tap)).toBeNull();
  });

  it('多個候選取最近的，並轉出地點 id 與座標', () => {
    expect(pickPoiHit([point(111, 121.5003, 25.04), point(221, 121.5001, 25.0401)], tap)).toEqual({
      placeId: 'osm:node:22',
      position: { lng: 121.5001, lat: 25.0401 },
    });
  });

  it('沒有可用 id 時仍回座標，MultiPoint 取第一點，無幾何的略過', () => {
    expect(
      pickPoiHit(
        [{ id: undefined, geometry: null }, { id: undefined, geometry: { type: 'MultiPoint', coordinates: [[121.5, 25.04]] } }],
        tap,
      ),
    ).toEqual({ placeId: null, position: { lng: 121.5, lat: 25.04 } });
  });
});
