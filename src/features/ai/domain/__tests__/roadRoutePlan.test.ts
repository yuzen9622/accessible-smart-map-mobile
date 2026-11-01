import { mapToolToActions } from '../toolActionMapper';
import { roadRoutePlanFixture } from '../testing/roadRoutePlanFixture';
import { t } from '../testing/translate';

const ROAD_TYPES = ['DRIVE', 'MOTORCYCLE'] as const;

describe.each(ROAD_TYPES)('%s AI road route contract', (type) => {
  it.each(['normal', 'elderly', 'wheelchair', 'visual_impaired'] as const)('preserves coordinate endpoints and the %s accessibility request', (mode) => {
    const fixture = roadRoutePlanFixture(type);
    const plan = { ...fixture, effectivePreferences: { ...fixture.effectivePreferences, mode } };
    const actions = mapToolToActions('planAccessibleRoute', plan, undefined, t);
    expect(actions).toHaveLength(1);
    const action = actions[0];
    expect(action.type).toBe('show-route');
    if (action.type !== 'show-route') throw new Error('Expected road route');
    expect(action.plan).toEqual(plan);
    expect(action.routes[1]).toMatchObject({ routeId: plan.selectedRouteId,
      routeToken: plan.routes[1].routeToken, navigationId: plan.routes[1].navigationId,
      legs: [{ type, from: { lat: 24, lng: 120 }, to: { lat: 24.1, lng: 120.1 }, polyline: [[120, 24], [120.1, 24.1]] }],
    });
  });

  it('continues accepting named road endpoints', () => {
    const plan = roadRoutePlanFixture(type);
    const routes = plan.routes.map((route) => ({ ...route,
      legs: route.legs.map((leg) => ({ ...leg, from: '起點', to: '終點' })),
    }));
    expect(mapToolToActions('planAccessibleRoute', { ...plan, routes }, undefined, t)[0].type).toBe('show-route');
  });

  it.each([
    undefined, null, {}, { lat: 24 }, { lng: 120 },
    { lat: '24', lng: 120 }, { lat: 24, lng: '120' },
    { lat: NaN, lng: 120 }, { lat: 24, lng: Infinity },
    { lat: 91, lng: 120 }, { lat: -91, lng: 120 },
    { lat: 24, lng: 181 }, { lat: 24, lng: -181 },
  ])('rejects a malformed endpoint %p on either side before applying a plan', (endpoint) => {
    const plan = roadRoutePlanFixture(type);
    for (const side of ['from', 'to']) {
      const routes = plan.routes.map((route) => ({ ...route,
        legs: route.legs.map((leg) => ({ ...leg, [side]: endpoint })),
      }));
      expect(mapToolToActions('planAccessibleRoute', { ...plan, routes }, undefined, t)).toEqual([{ type: 'route-error' }]);
    }
  });

  it('keeps WALK endpoints and named top-level endpoints strict', () => {
    const plan = roadRoutePlanFixture(type);
    const routes = plan.routes.map((route) => ({ ...route,
      legs: route.legs.map((leg) => ({ ...leg, type: 'WALK' })),
    }));
    expect(mapToolToActions('planAccessibleRoute', { ...plan, routes }, undefined, t)).toEqual([{ type: 'route-error' }]);
    expect(mapToolToActions('planAccessibleRoute', { ...plan, origin: { lat: 24, lng: 120 } }, undefined, t)).toEqual([{ type: 'route-error' }]);
  });
});
