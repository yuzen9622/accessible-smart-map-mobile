import { planRequestKey } from '../../domain/routeSession';
import { MAX_ROUTE_STOPS, useRouteSessionStore } from '../routeSessionStore';

const a = { lat: 25.01, lng: 121.51 };
const b = { lat: 25.02, lng: 121.52 };
const c = { lat: 25.03, lng: 121.53 };
const store = () => useRouteSessionStore.getState();
const names = () => store().stops.map((stop) => stop.name);

beforeEach(() => useRouteSessionStore.setState(useRouteSessionStore.getInitialState()));

it('appends stops in order up to the backend limit and replaces one in place', () => {
  for (let i = 0; i < MAX_ROUTE_STOPS + 1; i += 1) store().setStop(null, a, `S${i}`);
  expect(names()).toEqual(['S0', 'S1', 'S2', 'S3', 'S4']);
  const id = store().stops[1].id;
  store().setStop(1, b, 'B');
  expect(store().stops[1]).toEqual({ id, position: b, name: 'B' });
});

it('removes and reorders stops, ignoring out-of-range moves', () => {
  store().setStop(null, a, 'A');
  store().setStop(null, b, 'B');
  store().setStop(null, c, 'C');
  store().moveStop(2, 0);
  expect(names()).toEqual(['C', 'A', 'B']);
  store().moveStop(0, 3);
  expect(names()).toEqual(['C', 'A', 'B']);
  store().removeStop(1);
  expect(names()).toEqual(['C', 'B']);
});

it('drops stale results when stops change, and swap reverses the trip including stops', () => {
  store().setOrigin(a, 'Start');
  store().setDestination(c, 'End');
  store().setStop(null, a, 'A');
  store().setStop(null, b, 'B');
  useRouteSessionStore.setState({ computeRoutes: [], computedFor: 'x' });
  store().removeStop(0);
  expect(store().computeRoutes).toBeNull();
  expect(store().computedFor).toBeNull();
  store().setStop(null, c, 'C');
  store().swapEndpoints();
  expect([store().originName, ...names(), store().destinationName]).toEqual(['End', 'C', 'B', 'Start']);
});

it('ends the session with no stops left behind', () => {
  store().setStop(null, a, 'A');
  store().endRouteSession();
  expect(store().stops).toEqual([]);
});

it('keys plans by stop order so a reorder replans', () => {
  const base = { origin: a, destination: c, travelMode: 'walk', routeMode: 'wheelchair', avoidStairs: true, requireElevator: false };
  const none = planRequestKey(base);
  expect(planRequestKey({ ...base, stops: [] })).toBe(none);
  const ab = planRequestKey({ ...base, stops: [a, b] });
  expect(ab).not.toBe(none);
  expect(planRequestKey({ ...base, stops: [b, a] })).not.toBe(ab);
});
