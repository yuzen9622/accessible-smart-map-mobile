// 新寫（Web 的 toolActionMapper 沒有測試）。
import { mapToolToActions } from '../toolActionMapper';
import { routePlanFixture } from '../testing/routePlanFixture';
import { t } from '../testing/translate';

const ORIGIN = { lat: 25.04, lng: 121.51 };
const DEST = { lat: 25.03, lng: 121.56 };

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

  it.each(['planAccessibleRoute', 'plan_route'])('applies %s exactly once with selected identity', (name) => {
    const plan = routePlanFixture();
    expect(mapToolToActions(name, plan, undefined, t)).toEqual([{ type: 'show-route', origin: plan.origin, destination: plan.destination, routes: plan.routes, plan }]);
  });
  it.each([undefined, null, []])('accepts transport with geometry %p, keeping its stops and token', (polyline) => {
    const plan = routePlanFixture();
    const routes = plan.routes.map((route) => ({ ...route, legs: route.legs.map((leg) => ({ ...leg, polyline })) }));
    const action = mapToolToActions('plan_route', { ...plan, routes }, undefined, t)[0];
    expect(action.type).toBe('show-route');
    if (action.type !== 'show-route') throw new Error('Expected route');
    expect(action.routes[1]).toMatchObject({ routeId: plan.selectedRouteId, routeToken: plan.routes[1].routeToken });
    expect(action.routes[1].legs[0]).toMatchObject({ ...plan.routes[1].legs[0], polyline: [] });
  });
  it.each([
    (p: ReturnType<typeof routePlanFixture>) => ({ ...p, routeContractVersion: undefined }),
    (p: ReturnType<typeof routePlanFixture>) => ({ ...p, ok: false }),
    (p: ReturnType<typeof routePlanFixture>) => ({ ...p, routes: [] }),
    (p: ReturnType<typeof routePlanFixture>) => ({ ...p, routes: [p.routes[0], p.routes[0]] }),
    (p: ReturnType<typeof routePlanFixture>) => ({ ...p, selectedRouteId: 'missing' }),
    (p: ReturnType<typeof routePlanFixture>) => ({ ...p, origin: undefined }),
    (p: ReturnType<typeof routePlanFixture>) => ({ ...p, routes: [p.routes[0], { ...p.routes[1], legs: [{}] }] }),
  ])('rejects invalid contracts without recomputing or inventing coordinates', (mutate) => {
    expect(mapToolToActions('plan_route', mutate(routePlanFixture()), { origin: ORIGIN, destination: DEST }, t)).toEqual([{ type: 'route-error' }]);
  });
  it('accepts a display-only result without capability', () => {
    const plan = routePlanFixture();
    delete plan.routes[0].routeToken;
    expect(mapToolToActions('plan_route', plan, undefined, t)[0].type).toBe('show-route');
  });
});
