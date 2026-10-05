import type { LiveBus, RouteDetailDirection, RouteDetailStop } from '../../types/transit';
import {
  isAccessibleArrival,
  matchStopInRoute,
  nextBusToStop,
  pickFeaturedArrival,
  placeBuses,
  routesWithoutArrivals,
  sortArrivals,
  stopsBounds,
} from '../stopBoard';

function stop(seq: number, name: string, lng: number, estimateMinutes: number | null = null): RouteDetailStop {
  return { seq, name, lat: 25.04, lng, estimateMinutes, statusLabel: '' };
}

function bus(plate: string, lng: number, opts: Partial<LiveBus> = {}): LiveBus {
  return {
    plateNumb: plate,
    direction: 0,
    lat: 25.04,
    lng,
    speed: 0,
    gpsTime: '',
    isLowFloor: '否',
    hasLiftOrRamp: '否',
    vehicleClass: '',
    ...opts,
  };
}

// 每站相隔約 1 km（經度 0.01°）
const outbound = [stop(1, '北門', 121.5), stop(2, '公園路口', 121.51), stop(3, '臺北車站(忠孝)', 121.52, 3), stop(4, '善導寺', 121.53, 5)];
const inbound = [stop(1, '善導寺', 121.53), stop(2, '台北車站(忠孝)', 121.5202), stop(3, '北門', 121.5)];
const directions: RouteDetailDirection[] = [
  { direction: 0, stops: outbound },
  { direction: 1, stops: inbound },
];

describe('matchStopInRoute', () => {
  it('matches 臺/台 and bracket variants and picks the side nearest to the stop coordinates', () => {
    const near1 = matchStopInRoute(directions, '台北車站', { lat: 25.04, lng: 121.5202 });
    expect(near1).toMatchObject({ direction: 1, index: 1, headsign: '北門' });
    const near0 = matchStopInRoute(directions, '台北車站', { lat: 25.04, lng: 121.52 });
    expect(near0).toMatchObject({ direction: 0, index: 2, headsign: '善導寺' });
  });

  it('only searches the run it is given and returns null when the stop is not on it', () => {
    expect(matchStopInRoute([directions[1]!], '臺北車站', null)?.direction).toBe(1);
    expect(matchStopInRoute(directions, '市政府', null)).toBeNull();
  });

  it.each([2, 10] as const)('direction %p does not guess a repeated stop without a unique location', (direction) => {
    const run = [{ direction, stops: [stop(1, '同名站', 121.5), stop(2, '中途', 121.51), stop(3, '同名站', 121.5)] }];
    expect(matchStopInRoute(run, '同名站', null)).toBeNull();
    expect(matchStopInRoute(run, '同名站', { lat: 25.04, lng: 121.5 })).toBeNull();
  });

  it('coordinates still identify the unique nearest occurrence of a repeated stop', () => {
    const run: RouteDetailDirection[] = [{ direction: 10, stops: [stop(1, '同名站', 121.5), stop(2, '同名站', 121.52)] }];
    expect(matchStopInRoute(run, '同名站', { lat: 25.04, lng: 121.52 })?.index).toBe(1);
  });

  it('carries the sub-route and keeps direction 2 / 10 / 255 as they are', () => {
    const loops: RouteDetailDirection[] = [
      { direction: 10, subRouteUid: 'U1', stops: outbound },
      { direction: 255, subRouteUid: 'U2', stops: inbound },
    ];
    expect(matchStopInRoute([loops[0]!], '北門', null)).toMatchObject({ direction: 10, subRouteUid: 'U1', index: 0 });
    expect(matchStopInRoute([loops[1]!], '北門', null)).toMatchObject({ direction: 255, subRouteUid: 'U2', index: 2 });
  });
});

const sel0 = { direction: 0, exclusive: true } as const;

describe('placeBuses / nextBusToStop', () => {
  it('places same-direction buses at the nearest stop and flags accessibility', () => {
    const placed = placeBuses(
      outbound,
      [bus('A', 121.5101, { isLowFloor: '是' }), bus('B', 121.5), bus('C', 121.52, { direction: 1 })],
      sel0,
    );
    expect(placed).toEqual([
      { plateNumb: 'A', index: 1, atStop: true, accessible: true, isLowFloor: true },
      { plateNumb: 'B', index: 0, atStop: true, accessible: false, isLowFloor: false },
    ]);
  });

  it('picks the closest bus behind the stop and counts stops away', () => {
    const placed = placeBuses(outbound, [bus('A', 121.51), bus('B', 121.5), bus('D', 121.53)], sel0);
    expect(nextBusToStop(placed, 2, 3)).toMatchObject({ bus: { plateNumb: 'A' }, stopsAway: 1 });
  });

  it('ignores a bus sitting at the stop when the ETA says the next one is far away', () => {
    const placed = placeBuses(outbound, [bus('A', 121.52), bus('B', 121.5)], sel0);
    expect(nextBusToStop(placed, 2, 12)).toMatchObject({ bus: { plateNumb: 'B' }, stopsAway: 2 });
    expect(nextBusToStop(placed, 2, 0)).toMatchObject({ bus: { plateNumb: 'A' }, stopsAway: 0 });
  });
});

describe('placeBuses sub-route and direction isolation', () => {
  it('never mixes same-direction buses of another sub-route', () => {
    const buses = [bus('A', 121.5, { subRouteUid: 'U1' }), bus('B', 121.51, { subRouteUid: 'U2' }), bus('C', 121.52)];
    const selection = { direction: 0, subRouteUid: 'U1', exclusive: false } as const;
    expect(placeBuses(outbound, buses, selection).map((b) => b.plateNumb)).toEqual(['A']);
    expect(placeBuses(outbound, buses, { ...selection, subRouteUid: 'U2' }).map((b) => b.plateNumb)).toEqual(['B']);
  });
  it('places direction 2 and 10 buses on their own run only', () => {
    const buses = [bus('L', 121.5, { direction: 10 }), bus('M', 121.51, { direction: 2 })];
    expect(placeBuses(outbound, buses, { direction: 10, exclusive: true }).map((b) => b.plateNumb)).toEqual(['L']);
    expect(placeBuses(outbound, buses, { direction: 2, exclusive: true }).map((b) => b.plateNumb)).toEqual(['M']);
  });
  it('never places unknown-direction (255) buses, so they are never approaching', () => {
    const buses = [bus('U', 121.5, { direction: 255 })];
    expect(placeBuses(outbound, buses, { direction: 255, exclusive: true })).toEqual([]);
    expect(placeBuses(outbound, buses, sel0)).toEqual([]);
  });
});

describe('stop arrivals', () => {
  const arrival = (routeName: string, estimateMinutes: number | null, isLowFloor: boolean | null, hasLiftOrRamp: boolean | null = null) => ({
    routeName,
    estimateMinutes,
    isLowFloor,
    hasLiftOrRamp,
  });

  it('features the soonest route whose next bus is known to be accessible', () => {
    const arrivals = [arrival('262', 1, false), arrival('307', 3, true), arrival('299', 2, null), arrival('藍5', null, true)];
    expect(pickFeaturedArrival(arrivals)?.routeName).toBe('307');
    expect(pickFeaturedArrival([arrival('262', 1, false), arrival('299', 2, null)])).toBeNull();
  });

  it('treats unknown vehicles as not accessible and sorts missing ETAs last', () => {
    expect(isAccessibleArrival(arrival('x', 1, null, true))).toBe(true);
    expect(isAccessibleArrival(arrival('x', 1, null, null))).toBe(false);
    expect(sortArrivals([arrival('a', null, null), arrival('b', 5, null), arrival('c', 0, null)]).map((a) => a.routeName)).toEqual(['c', 'b', 'a']);
  });

  it('lists routes that have no arrival row', () => {
    expect(routesWithoutArrivals(['307', '262', '299'], [arrival('307', 3, true)])).toEqual(['262', '299']);
  });
});

describe('stopsBounds', () => {
  it('bounds the requested slice and clamps indices', () => {
    expect(stopsBounds(outbound, 1, 2)).toEqual([121.51, 25.037, 121.52, 25.043]);
    expect(stopsBounds(outbound, -3, 99)?.[0]).toBe(121.5);
    expect(stopsBounds([], 0, 3)).toBeNull();
  });
});
