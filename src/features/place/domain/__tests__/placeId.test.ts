import { isCoordPlaceId, toPlaceId } from '../placeId';

// 移植自 Web `src/components/ClientMap.tsx:44-59` `toPlaceId`（commit 5eadc71）。

describe('toPlaceId', () => {
  it('accepts current-format ids unchanged', () => {
    expect(toPlaceId('osm:node:123')).toBe('osm:node:123');
    expect(toPlaceId('osm:way:456')).toBe('osm:way:456');
    expect(toPlaceId('osm:relation:789')).toBe('osm:relation:789');
    expect(toPlaceId('google:ChIJ123')).toBe('google:ChIJ123');
  });

  it('converts legacy type_id (and abbreviated) forms to the current osm: format', () => {
    expect(toPlaceId('node_123')).toBe('osm:node:123');
    expect(toPlaceId('way_456')).toBe('osm:way:456');
    expect(toPlaceId('relation_789')).toBe('osm:relation:789');
    expect(toPlaceId('n_123')).toBe('osm:node:123');
    expect(toPlaceId('w_456')).toBe('osm:way:456');
    expect(toPlaceId('r_789')).toBe('osm:relation:789');
  });

  it('rejects coord: ids and anything else unrecognized', () => {
    expect(toPlaceId('coord:25.03,121.56')).toBeNull();
    expect(toPlaceId('bogus')).toBeNull();
    expect(toPlaceId('node_abc')).toBeNull();
    expect(toPlaceId(null)).toBeNull();
    expect(toPlaceId(undefined)).toBeNull();
    expect(toPlaceId('')).toBeNull();
  });
});

describe('isCoordPlaceId', () => {
  it('flags coord: prefixed ids only', () => {
    expect(isCoordPlaceId('coord:25.03,121.56')).toBe(true);
    expect(isCoordPlaceId('osm:node:123')).toBe(false);
  });
});
