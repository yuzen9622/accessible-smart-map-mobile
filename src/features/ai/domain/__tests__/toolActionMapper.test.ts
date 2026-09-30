// 新寫（Web 的 toolActionMapper 沒有測試）。
import { mapToolToActions } from '../toolActionMapper';
import { t } from '../testing/translate';

const ORIGIN = { lat: 25.04, lng: 121.51 };
const DEST = { lat: 25.03, lng: 121.56 };
const drawableRoute = { routeId: 'r1', legs: [{ polyline: [[121.51, 25.04]] }] };

describe('mapToolToActions', () => {
  it('findA11yPlaces → show-markers（標記由結果轉出）', () => {
    const result = {
      ok: true,
      places: { nearbyBathroom: [{ _id: 'b1', name: '公園廁所', latitude: 25.03, longitude: 121.53, diaper: true }] },
    };
    const actions = mapToolToActions('findA11yPlaces', result, undefined, t);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: 'show-markers' });
    if (actions[0].type !== 'show-markers') throw new Error('unreachable');
    expect(actions[0].markers).toEqual([
      {
        id: 'b1',
        position: { lat: 25.03, lng: 121.53 },
        title: '公園廁所',
        subtitle: '有提供尿布台',
        kind: 'restroom',
      },
    ]);
  });

  it('findGooglePlaces → show-markers', () => {
    const result = {
      status: 'OK',
      places: [{ name: '大安森林公園', place_id: 'abc', location: { lat: 25.03, lng: 121.53 } }],
    };
    const actions = mapToolToActions('findGooglePlaces', result, undefined, t);
    expect(actions[0]).toMatchObject({ type: 'show-markers' });
    if (actions[0].type !== 'show-markers') throw new Error('unreachable');
    expect(actions[0].markers[0]).toMatchObject({ id: 'g_abc', title: '大安森林公園', kind: 'place', googlePlaceId: 'abc' });
  });

  it('planAccessibleRoute 有可繪製的 routes → [show-route, switch-panel]', () => {
    const result = { origin: ORIGIN, destination: DEST, routes: [drawableRoute] };
    expect(mapToolToActions('planAccessibleRoute', result, undefined, t)).toEqual([
      { type: 'show-route', origin: ORIGIN, destination: DEST, routes: [drawableRoute] },
      { type: 'switch-panel', sheet: 'route' },
    ]);
  });

  it('plan_route 別名同樣處理', () => {
    const result = { origin: ORIGIN, destination: DEST, routes: [drawableRoute] };
    expect(mapToolToActions('plan_route', result, undefined, t).map((a) => a.type)).toEqual([
      'show-route',
      'switch-panel',
    ]);
  });

  it('沒有可繪製 routes 但有起訖點 → [compute-route, switch-panel]', () => {
    const result = { origin: ORIGIN, destination: DEST, routes: [{ routeId: 'r1', legs: [{ polyline: [] }] }] };
    expect(mapToolToActions('planAccessibleRoute', result, undefined, t)).toEqual([
      { type: 'compute-route', origin: ORIGIN, destination: DEST },
      { type: 'switch-panel', sheet: 'route' },
    ]);
    expect(mapToolToActions('planAccessibleRoute', { origin: ORIGIN, destination: DEST }, undefined, t)[0].type).toBe(
      'compute-route',
    );
  });

  it('結果沒有座標時退回 args 的 lat/lng（args 可為 JSON 字串或物件）', () => {
    const args = JSON.stringify({ origin: { latitude: 25.04, longitude: 121.51 }, destination: DEST });
    expect(mapToolToActions('planAccessibleRoute', {}, args, t)).toEqual([
      { type: 'compute-route', origin: ORIGIN, destination: DEST },
      { type: 'switch-panel', sheet: 'route' },
    ]);
    expect(mapToolToActions('planAccessibleRoute', {}, { origin: ORIGIN, destination: DEST }, t)[0]).toEqual({
      type: 'compute-route',
      origin: ORIGIN,
      destination: DEST,
    });
  });

  it('args 是壞掉的 JSON 時不丟錯，沒有座標就沒有動作', () => {
    expect(mapToolToActions('planAccessibleRoute', {}, '{壞掉', t)).toEqual([]);
  });

  it('有 routes 但完全沒有座標 → 仍顯示路線，起訖點補 (0,0)', () => {
    const actions = mapToolToActions('planAccessibleRoute', { routes: [drawableRoute] }, undefined, t);
    expect(actions).toEqual([
      {
        type: 'show-route',
        origin: { lat: 0, lng: 0 },
        destination: { lat: 0, lng: 0 },
        routes: [drawableRoute],
      },
      { type: 'switch-panel', sheet: 'route' },
    ]);
  });

  it('未知工具與 null 結果 → []', () => {
    expect(mapToolToActions('someNewTool', { ok: true }, undefined, t)).toEqual([]);
    expect(mapToolToActions('planAccessibleRoute', null, undefined, t)).toEqual([]);
  });
});
