import type { BusArrivalItem, RouteDetailDirection } from '../../types/transit';
import {
  belongsToSelection,
  buildDirectionOptions,
  directionTitle,
  isBusDirection,
  isTrackableDirection,
  matchesSelection,
  pickNextArrival,
  resolveDirectionOption,
  routePathOfOption,
  selectionOf,
  stopsOfOption,
  stripLiveEta,
} from '../busDirections';

const stop = (name: string, lng = 0, lat = 0, estimateMinutes: number | null = null, statusLabel = '') => ({
  seq: 1,
  name,
  lat,
  lng,
  estimateMinutes,
  statusLabel,
});
const dir = (direction: RouteDetailDirection['direction'], names: string[], subRouteUid?: string, subRouteName?: string): RouteDetailDirection => ({
  direction,
  stops: names.map((n) => stop(n)),
  subRouteUid,
  subRouteName,
});

describe('direction guards', () => {
  it('accepts exactly the five TDX numbers', () => {
    for (const ok of [0, 1, 2, 10, 255]) expect(isBusDirection(ok)).toBe(true);
    for (const bad of ['10', '0', '', null, undefined, 3, -1, 256, 1.5, Number.NaN]) expect(isBusDirection(bad)).toBe(false);
  });
  it('255 is the only untrackable direction', () => {
    expect([0, 1, 2, 10].every((d) => isTrackableDirection(d as 0))).toBe(true);
    expect(isTrackableDirection(255)).toBe(false);
  });
});

describe('buildDirectionOptions', () => {
  it('keeps same-direction sub-routes apart by (subRouteUid, direction)', () => {
    const options = buildDirectionOptions([dir(0, ['A', 'B'], 'U1'), dir(0, ['A', 'C'], 'U2'), dir(1, ['B', 'A'], 'U1')]);
    expect(options.map((o) => o.key)).toEqual(['U1|0', 'U2|0', 'U1|1']);
    expect(options.map((o) => o.exclusive)).toEqual([false, false, true]);
    expect(options.every((o) => !o.ambiguous)).toBe(true);
  });
  it('flags identical (uid, direction) groups as ambiguous instead of merging them', () => {
    const options = buildDirectionOptions([dir(0, ['A', 'B']), dir(0, ['A', 'C'])]);
    expect(options.map((o) => o.key)).toEqual(['|0', '|0#1']);
    expect(options.every((o) => o.ambiguous && !o.exclusive)).toBe(true);
  });
});

describe('resolveDirectionOption', () => {
  const branches = buildDirectionOptions([
    dir(1, ['B', 'A'], 'U1'),
    dir(0, ['A', 'B'], 'U1'),
    dir(0, ['A', 'C'], 'U2'),
    dir(255, ['X', 'Y'], 'U2'),
  ]);

  it('keeps a still-existing pick', () => {
    expect(resolveDirectionOption(branches, { key: 'U2|0' })?.key).toBe('U2|0');
  });
  it('falls back inside the previously picked sub-route: 0, then first non-255, then 255', () => {
    expect(resolveDirectionOption(branches, { key: 'U2|1' })?.key).toBe('U2|0');
    const noZero = buildDirectionOptions([dir(255, ['X'], 'U9'), dir(10, ['A', 'B'], 'U9'), dir(0, ['A'], 'U1')]);
    expect(resolveDirectionOption(noZero, { key: 'U9|2' })?.key).toBe('U9|10');
    const onlyUnknown = buildDirectionOptions([dir(255, ['X'], 'U9')]);
    expect(resolveDirectionOption(onlyUnknown, { key: 'U9|0' })?.key).toBe('U9|255');
  });
  it('uses the navigated sub-route and direction without mixing sub-routes', () => {
    expect(resolveDirectionOption(branches, { subRouteUid: 'U2', direction: 0 })?.key).toBe('U2|0');
    expect(resolveDirectionOption(branches, { subRouteUid: 'U2', direction: 1 })?.key).toBe('U2|0');
    // 只有方向、沒有支線：該方向只有一組才採用；同方向有兩個支線時不任意挑一個，走預設（0）。
    expect(resolveDirectionOption(branches, { direction: 1 })?.key).toBe('U1|1');
    expect(resolveDirectionOption(branches, { direction: 0 })?.key).toBe('U1|0');
  });
  it('defaults to direction 0, then the first non-255, and returns null without data', () => {
    expect(resolveDirectionOption(branches)?.key).toBe('U1|0');
    expect(resolveDirectionOption(buildDirectionOptions([dir(255, ['X']), dir(2, ['A', 'B'])]))?.direction).toBe(2);
    expect(resolveDirectionOption([])).toBeNull();
  });
  it('only 2 / 10 produce a menu entry for exactly those directions (no phantom 0/1)', () => {
    expect(buildDirectionOptions([dir(10, ['A', 'B', 'A'])]).map((o) => o.direction)).toEqual([10]);
    expect(buildDirectionOptions([dir(2, ['A', 'B', 'A'])]).map((o) => o.direction)).toEqual([2]);
  });
});

describe('directionTitle', () => {
  const directions = [dir(0, ['A', 'B']), dir(1, ['B', 'A']), dir(2, ['A', 'B']), dir(10, ['A', 'B']), dir(255, ['A', 'B'])];
  const options = buildDirectionOptions(directions);
  it('keeps 往終點／往起點 for 0 and 1 and prefers the route own endpoints when unique', () => {
    expect(directionTitle(directions, options[0]!, { destination: 'Y', departure: 'X' })).toEqual({ kind: 'headsign', name: 'Y' });
    expect(directionTitle(directions, options[1]!, {})).toEqual({ kind: 'headsign', name: 'A' });
  });
  it('labels 2 / 10 / 255 without applying an outbound terminal', () => {
    expect(options.slice(2).map((o) => directionTitle(directions, o, { destination: 'Y', departure: 'X' }).kind)).toEqual([
      'loop',
      'circular',
      'unknown',
    ]);
  });
  it('does not apply the search endpoints when same-direction branches exist', () => {
    const branches = [dir(0, ['A', 'B'], 'U1'), dir(0, ['A', 'C'], 'U2')];
    const [first, second] = buildDirectionOptions(branches);
    expect(directionTitle(branches, first!, { destination: 'Y' })).toEqual({ kind: 'headsign', name: 'B' });
    expect(directionTitle(branches, second!, { destination: 'Y' })).toEqual({ kind: 'headsign', name: 'C' });
  });
});

describe('stopsOfOption / routePathOfOption', () => {
  const at = (name: string, lng: number, lat: number) => stop(name, lng, lat);
  const shaped: RouteDetailDirection[] = [
    { direction: 0, subRouteUid: 'U1', stops: [at('A', 121.5, 25), at('B', 121.6, 25.1)], polyline: [[121.5, 25], [121.55, 25.02], [121.6, 25.1]] },
    { direction: 0, subRouteUid: 'U2', stops: [at('A', 121.5, 25), at('C', 121.7, 25.2)] },
  ];
  const [first, second] = buildDirectionOptions(shaped);
  it('reads stops and shape from the same object of the selection', () => {
    expect(stopsOfOption(shaped, second!.index).map((s) => s.name)).toEqual(['A', 'C']);
    expect(routePathOfOption(shaped, first!.index)).toHaveLength(3);
    expect(routePathOfOption(shaped, second!.index)).toEqual([[121.5, 25], [121.7, 25.2]]);
  });
  it('is empty without a selection', () => {
    expect(stopsOfOption(shaped, null)).toEqual([]);
    expect(routePathOfOption(shaped, null)).toEqual([]);
  });
});

describe('selection matching', () => {
  const sel = { direction: 10, subRouteUid: 'U1', exclusive: false } as const;
  it('needs the same direction and, when both carry one, the same sub-route', () => {
    expect(matchesSelection({ direction: 10, subRouteUid: 'U1' }, sel)).toBe(true);
    expect(matchesSelection({ direction: 10, subRouteUid: 'U2' }, sel)).toBe(false);
    expect(matchesSelection({ direction: 0, subRouteUid: 'U1' }, sel)).toBe(false);
  });
  it('a record without a sub-route only counts when the direction has a single run', () => {
    expect(matchesSelection({ direction: 10 }, sel)).toBe(false);
    expect(matchesSelection({ direction: 10 }, { ...sel, exclusive: true })).toBe(true);
  });
  it('255 is displayable but never matched for tracking', () => {
    const unknown = { direction: 255, subRouteUid: 'U1', exclusive: true } as const;
    expect(belongsToSelection({ direction: 255, subRouteUid: 'U1' }, unknown)).toBe(true);
    expect(matchesSelection({ direction: 255, subRouteUid: 'U1' }, unknown)).toBe(false);
    expect(selectionOf(buildDirectionOptions([dir(255, ['A'], 'U1')])[0]!)).toEqual(unknown);
  });
});

describe('pickNextArrival', () => {
  const arrival = (over: Partial<BusArrivalItem>): BusArrivalItem => ({
    stopName: '臺北車站',
    direction: 10,
    directionLabel: '',
    estimateMinutes: 5,
    statusLabel: '',
    plateNumb: 'AAA-111',
    subRouteUid: 'U1',
    ...over,
  });
  const sel = { direction: 10, subRouteUid: 'U1', exclusive: false } as const;

  it('takes the plate from the same record as the soonest ETA', () => {
    const picked = pickNextArrival(
      [arrival({ estimateMinutes: 9, plateNumb: 'LATE-1' }), arrival({ estimateMinutes: 2, plateNumb: 'NEXT-1' })],
      '台北車站(忠孝)',
      sel,
    );
    expect(picked).toEqual({ plateNumb: 'NEXT-1', estimateMinutes: 2 });
  });
  it('keeps a legitimate 0 and never borrows the plate of another record', () => {
    expect(pickNextArrival([arrival({ estimateMinutes: 0, plateNumb: undefined }), arrival({ estimateMinutes: 4 })], '台北車站', sel)).toEqual({
      plateNumb: undefined,
      estimateMinutes: 0,
    });
  });
  it('rejects wrong stop, branch, direction and invalid ETA', () => {
    const bad = [
      arrival({ stopName: '市政府' }),
      arrival({ subRouteUid: 'U2' }),
      arrival({ direction: 0 }),
      arrival({ estimateMinutes: null }),
      arrival({ estimateMinutes: -1 }),
      arrival({ estimateMinutes: Number.NaN }),
      arrival({ subRouteUid: undefined }),
    ];
    expect(pickNextArrival(bad, '台北車站', sel)).toBeNull();
  });
  it('does not pair anything for direction 255', () => {
    expect(pickNextArrival([arrival({ direction: 255 })], '台北車站', { direction: 255, subRouteUid: 'U1', exclusive: true })).toBeNull();
  });
  it('treats a -1 plate as no plate', () => {
    expect(pickNextArrival([arrival({ plateNumb: '-1' })], '台北車站', sel)?.plateNumb).toBeUndefined();
  });
});

describe('stripLiveEta', () => {
  it('keeps the static stops but drops ETA and status', () => {
    const stripped = stripLiveEta([{ direction: 0, stops: [stop('A', 1, 2, 3, '正常')], subRouteUid: 'U1' }]);
    expect(stripped).toEqual([{ direction: 0, subRouteUid: 'U1', stops: [{ seq: 1, name: 'A', lat: 2, lng: 1, estimateMinutes: null, statusLabel: '' }] }]);
  });
});
