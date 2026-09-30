// 新寫：aiResults（Web 沒有直接測試，只經 toolResultCards 間接涵蓋）。
import { a11yPlacesToMarkers, geoCoords, getLatLng, googlePlacesToMarkers } from '../aiResults';
import { t } from '../testing/translate';

describe('getLatLng', () => {
  it('依序嘗試多種欄位命名', () => {
    expect(getLatLng({ lat: 25, lng: 121 })).toEqual({ lat: 25, lng: 121 });
    expect(getLatLng({ geometry: { location: { lat: 1, lng: 2 } } })).toEqual({ lat: 1, lng: 2 });
    expect(getLatLng({ StopPosition: { PositionLat: '25.1', PositionLon: '121.2' } })).toEqual({ lat: 25.1, lng: 121.2 });
    expect(getLatLng({ 緯度: 25, 經度: 121 })).toEqual({ lat: 25, lng: 121 });
  });

  it('GeoJSON 座標為 [lng, lat]', () => {
    expect(getLatLng({ location: { coordinates: [121.5, 25.0] } })).toEqual({ lat: 25, lng: 121.5 });
  });

  it('沒有座標或不是物件 → null', () => {
    expect(getLatLng({ name: 'x' })).toBeNull();
    expect(getLatLng(null)).toBeNull();
    expect(getLatLng('x')).toBeNull();
    expect(getLatLng({ lat: 'abc', lng: 1 })).toBeNull();
  });
});

describe('geoCoords', () => {
  it('GeoJSON 優先，退回扁平欄位', () => {
    expect(geoCoords({ coordinates: [121, 25] })).toEqual({ lat: 25, lng: 121 });
    expect(geoCoords(undefined, '25', '121')).toEqual({ lat: 25, lng: 121 });
    expect(geoCoords(undefined)).toBeNull();
  });
});

describe('googlePlacesToMarkers', () => {
  it('轉成 place 標記；缺名稱用預設字串；沒座標的略過', () => {
    const markers = googlePlacesToMarkers(
      {
        places: [
          { formatted_address: '台北市信義區', place_id: 'p1', rating: 4.5, types: ['park'], lat: 25, lng: 121 },
          { lat: 25.1, lng: 121.1 },
          { name: '沒座標' },
        ],
      },
      t,
    );
    expect(markers).toEqual([
      {
        id: 'g_p1',
        position: { lat: 25, lng: 121 },
        title: '台北市信義區',
        subtitle: '台北市信義區',
        kind: 'place',
        googlePlaceId: 'p1',
        placeType: 'park',
        rating: 4.5,
      },
      {
        id: 'g_1',
        position: { lat: 25.1, lng: 121.1 },
        title: '地點',
        subtitle: '地點',
        kind: 'place',
        googlePlaceId: undefined,
        placeType: undefined,
        rating: undefined,
      },
    ]);
  });

  it('ok:false 或 status 非 OK → []', () => {
    expect(googlePlacesToMarkers({ ok: false, places: [] }, t)).toEqual([]);
    expect(googlePlacesToMarkers({ status: 'ZERO_RESULTS', places: [{ lat: 1, lng: 1 }] }, t)).toEqual([]);
    expect(googlePlacesToMarkers(null, t)).toEqual([]);
  });
});

describe('a11yPlacesToMarkers', () => {
  it('捷運出入口依名稱分電梯／坡道；廁所看尿布台；osm 用預設標題；並依 id 去重', () => {
    const markers = a11yPlacesToMarkers(
      {
        ok: true,
        places: {
          nearbyMetroA11y: [
            { _id: 'm1', '出入口電梯/無障礙坡道名稱': '1號出口電梯', 出入口編號: '1', 緯度: 25.0, 經度: 121.0 },
            { _id: 'm2', '出入口電梯/無障礙坡道名稱': '2號出口斜坡', location: { coordinates: [121.1, 25.1] } },
            { _id: 'skip', 緯度: 1, 經度: 1 },
          ],
          nearbyBathroom: [{ _id: 'b1', name: '廁所', latitude: 25.2, longitude: 121.2, diaper: false }],
          nearbyOsm: [{ id: 'o1', lat: 25.3, lng: 121.3 }, { id: 'o1', lat: 25.3, lng: 121.3 }],
          nearbyParking: [{ placeName: '停車場', address: '中山路', lat: 25.4, lng: 121.4 }],
        },
      },
      t,
    );
    expect(markers.map((m) => [m.id, m.kind, m.title, m.subtitle])).toEqual([
      ['m1', 'elevator', '1號出口電梯', '1'],
      ['m2', 'ramp', '2號出口斜坡', undefined],
      ['b1', 'restroom', '廁所', '無提供尿布台'],
      ['o1', 'facility', '無障礙設施', undefined],
      ['a_2', 'facility', '停車場', '中山路'],
    ]);
  });

  it('res 不 ok → []', () => {
    expect(a11yPlacesToMarkers({ ok: false }, t)).toEqual([]);
  });
});
