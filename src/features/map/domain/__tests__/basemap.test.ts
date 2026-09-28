import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

import {
  applyLabelLanguage,
  buildingExtrusionPaint,
  isStyleSpecification,
  prepareBasemapStyle,
} from '../basemap';

const style: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: 'background', type: 'background' },
    { id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', maxzoom: 14 },
    { id: 'building-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building' },
  ],
};

describe('prepareBasemapStyle', () => {
  it('移除內建 building-3d，並讓平面 building 延伸到 z24，其他圖層不動', () => {
    const next = prepareBasemapStyle(style);
    expect(next.layers.map((layer) => layer.id)).toEqual(['background', 'building']);
    expect(next.layers[1]?.maxzoom).toBe(24);
    expect(style.layers).toHaveLength(3);
  });
});

describe('isStyleSpecification', () => {
  it('只接受有 version/sources/layers 陣列的物件', () => {
    expect(isStyleSpecification(style)).toBe(true);
    expect(isStyleSpecification({ version: 8, sources: {} })).toBe(false);
    expect(isStyleSpecification(null)).toBe(false);
  });
});

describe('buildingExtrusionPaint', () => {
  it('2D 時透明度為 0，3D 時淺色 0.85、深色 1，且都帶 transition', () => {
    expect(buildingExtrusionPaint('light', false)['fill-extrusion-opacity']).toBe(0);
    expect(buildingExtrusionPaint('light', true)['fill-extrusion-opacity']).toBe(0.85);
    expect(buildingExtrusionPaint('dark', true)['fill-extrusion-opacity']).toBe(1);
    expect(buildingExtrusionPaint('dark', true)['fill-extrusion-opacity-transition']).toEqual({
      duration: 600,
      delay: 0,
    });
  });
});

describe('applyLabelLanguage', () => {
  const labelled: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'place',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        layout: { 'text-field': '{name:latin}\n{name:nonlatin}' },
      },
      {
        id: 'housenumber',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'housenumber',
        layout: { 'text-field': '{housenumber}' },
      },
      { id: 'road', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation' },
    ],
  };

  it('zh-TW：含 name 的 symbol 圖層改成繁中優先', () => {
    const next = applyLabelLanguage(labelled, 'zh-TW');
    expect(next.layers[0]?.type === 'symbol' && next.layers[0].layout?.['text-field']).toEqual([
      'coalesce',
      ['get', 'name:zh-Hant'],
      ['get', 'name:zh'],
      ['get', 'name'],
    ]);
  });

  it('en：改成英文優先', () => {
    const next = applyLabelLanguage(labelled, 'en');
    expect(next.layers[0]?.type === 'symbol' && next.layers[0].layout?.['text-field']).toEqual([
      'coalesce',
      ['get', 'name:en'],
      ['get', 'name:latin'],
      ['get', 'name'],
    ]);
  });

  it('門牌號碼等不含 name 的標籤與非 symbol 圖層保持不變', () => {
    const next = applyLabelLanguage(labelled, 'zh-TW');
    expect(next.layers[1]).toBe(labelled.layers[1]);
    expect(next.layers[2]).toBe(labelled.layers[2]);
  });

  it('已是目標運算式的圖層不重建（相等判斷，避免無限重繪）', () => {
    const once = applyLabelLanguage(labelled, 'en');
    const twice = applyLabelLanguage(once, 'en');
    expect(twice.layers[0]).toBe(once.layers[0]);
  });
});
