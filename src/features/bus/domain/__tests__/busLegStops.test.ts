// 移植自 Web `src/lib/transit/__tests__/busLegStops.test.ts`（commit 5eadc71），案例逐一保留；文末補 SDD §6.5 指定的 365／26／70 與「整段同一狀態」案例。
import type { RouteDetailStop } from '../../types/transit';
import {
  buildStopRows,
  CURRENT_STOP_RADIUS_M,
  fallbackStopRows,
  normalizeStopName,
  parseStatusLabel,
  resolveCurrentStopSeq,
  resolveEtaLabel,
  resolveLegDirection,
  resolveLegRide,
  resolveLegStops,
  sliceLegStops,
} from '../busLegStops';
import type { BusLeg } from '@/features/route';

function stop(
  seq: number,
  name: string,
  overrides: Partial<RouteDetailStop> = {},
): RouteDetailStop {
  return {
    seq,
    name,
    lat: 25.03 + seq * 0.01,
    lng: 121.5,
    estimateMinutes: null,
    statusLabel: '',
    ...overrides,
  };
}

const line = [
  stop(1, '起點'),
  stop(2, 'A站'),
  stop(3, 'B站'),
  stop(4, 'C站'),
  stop(5, '終點'),
];

describe('sliceLegStops', () => {
  it('cuts the inclusive board → alight range', () => {
    const sliced = sliceLegStops(line, 'A站', 'C站');
    expect(sliced?.map((s) => s.name)).toEqual(['A站', 'B站', 'C站']);
  });

  it('trims whitespace on both sides of the comparison', () => {
    const padded = [stop(1, ' A站 '), stop(2, 'B站')];
    expect(sliceLegStops(padded, 'A站', ' B站')?.length).toBe(2);
  });

  it('returns null when the board stop is absent', () => {
    expect(sliceLegStops(line, '不存在', 'C站')).toBeNull();
  });

  it('returns null when the alight stop is absent', () => {
    expect(sliceLegStops(line, 'A站', '不存在')).toBeNull();
  });

  it('returns null when the alight stop only appears before the board stop', () => {
    expect(sliceLegStops(line, 'C站', 'A站')).toBeNull();
  });

  it('picks the first alight occurrence after the board stop on a loop', () => {
    const loop = [
      stop(1, '總站'),
      stop(2, 'A站'),
      stop(3, '總站'),
      stop(4, 'A站'),
    ];
    expect(sliceLegStops(loop, 'A站', '總站')?.map((s) => s.seq)).toEqual([
      2, 3,
    ]);
  });
});

describe('resolveCurrentStopSeq', () => {
  it('returns null without a vehicle', () => {
    expect(resolveCurrentStopSeq(line, null)).toBeNull();
  });

  it('returns the nearest stop when the vehicle is at it', () => {
    const target = line[2];
    expect(
      resolveCurrentStopSeq(line, { lat: target.lat, lng: target.lng }),
    ).toBe(3);
  });

  it('returns null when the vehicle is between stops', () => {
    // 0.01° of latitude is ~1.1 km, comfortably outside the radius.
    expect(
      resolveCurrentStopSeq(line, { lat: line[2].lat + 0.01, lng: 121.6 }),
    ).toBeNull();
  });

  it('honours a widened radius', () => {
    const seq = resolveCurrentStopSeq(
      line,
      { lat: line[0].lat + 0.005, lng: line[0].lng },
      CURRENT_STOP_RADIUS_M * 10,
    );
    expect(seq).toBe(1);
  });
});

describe('buildStopRows', () => {
  it('marks board / intermediate / alight kinds', () => {
    const rows = buildStopRows(line, null);
    expect(rows.map((r) => r.kind)).toEqual([
      'board',
      'intermediate',
      'intermediate',
      'intermediate',
      'alight',
    ]);
    expect(rows.every((r) => r.state === 'upcoming')).toBe(true);
  });

  it('splits passed / current / upcoming around the current seq', () => {
    const rows = buildStopRows(line, 3);
    expect(rows.map((r) => r.state)).toEqual([
      'passed',
      'passed',
      'current',
      'upcoming',
      'upcoming',
    ]);
  });

  it('carries the ETA fields through', () => {
    const rows = buildStopRows(
      [stop(1, 'A站', { estimateMinutes: 4, statusLabel: '正常' })],
      null,
    );
    expect(rows[0].estimateMinutes).toBe(4);
    expect(rows[0].statusLabel).toBe('正常');
  });
});

describe('fallbackStopRows', () => {
  const leg = {
    type: 'BUS',
    routeName: '307',
    departureStop: '板橋',
    arrivalStop: '台北車站',
    direction: 0,
    intermediateStops: [{ name: '中間站', stationUid: 'UID-1' }],
  } as BusLeg;

  it('builds name-only rows with no ETA', () => {
    const rows = fallbackStopRows(leg);
    expect(rows.map((r) => r.name)).toEqual(['板橋', '中間站', '台北車站']);
    expect(rows.map((r) => r.kind)).toEqual([
      'board',
      'intermediate',
      'alight',
    ]);
    expect(rows.every((r) => r.estimateMinutes === null)).toBe(true);
    expect(rows.every((r) => r.state === 'upcoming')).toBe(true);
    expect(rows[1].stationUid).toBe('UID-1');
  });

  it('still yields board and alight without intermediate stops', () => {
    const rows = fallbackStopRows({ ...leg, intermediateStops: undefined });
    expect(rows).toHaveLength(2);
  });
});

describe('parseStatusLabel', () => {
  it('returns nothing for an absent label', () => {
    expect(parseStatusLabel('')).toBeNull();
    expect(parseStatusLabel('   ')).toBeNull();
  });

  it('reads the next departure time the backend wrote into the label', () => {
    expect(parseStatusLabel('18:15')).toEqual({
      key: 'busScheduledAt',
      params: { time: '18:15' },
      tone: 'normal',
      kind: 'scheduled',
    });
  });

  it("flags a departure timed from the line's origin", () => {
    expect(parseStatusLabel('18:15 起點發車')).toEqual({
      key: 'busScheduledFromOrigin',
      params: { time: '18:15' },
      tone: 'normal',
      kind: 'scheduled',
    });
  });

  it("flags tomorrow's first service", () => {
    expect(parseStatusLabel('明日 06:00')).toEqual({
      key: 'busScheduledTomorrow',
      params: { time: '06:00' },
      tone: 'normal',
      kind: 'scheduled',
    });
    expect(parseStatusLabel('明日 06:00 起點發車')?.key).toBe(
      'busScheduledTomorrowFromOrigin',
    );
  });

  it('accepts a single-digit hour', () => {
    expect(parseStatusLabel('6:05')).toEqual({
      key: 'busScheduledAt',
      params: { time: '6:05' },
      tone: 'normal',
      kind: 'scheduled',
    });
  });

  it('keeps the TDX statuses the backend never overwrites', () => {
    expect(parseStatusLabel('末班車已過')?.key).toBe('busServiceEnded');
    expect(parseStatusLabel('今日未營運')?.key).toBe('busNoServiceToday');
    expect(parseStatusLabel('交管不停靠')?.key).toBe('busStopSkipped');
    expect(parseStatusLabel('尚未發車')?.key).toBe('busNotDeparted');
  });

  it('returns null for labels that say nothing useful', () => {
    expect(parseStatusLabel('正常')).toBeNull();
    expect(parseStatusLabel('誰知道')).toBeNull();
  });
});

describe('resolveEtaLabel', () => {
  const row = (
    estimateMinutes: number | null,
    state: 'passed' | 'current' | 'upcoming' = 'upcoming',
    statusLabel = '',
    pending = false,
  ) =>
    ({
      seq: 1,
      name: 'A站',
      estimateMinutes,
      statusLabel,
      state,
      kind: 'intermediate',
      pending,
    }) as const;

  it('maps 0 minutes to arriving', () => {
    expect(resolveEtaLabel(row(0))).toEqual({
      key: 'busArrivalArriving',
      tone: 'arriving',
      kind: 'eta',
    });
  });

  it('maps under 3 minutes to due', () => {
    expect(resolveEtaLabel(row(2))).toEqual({
      key: 'busArrivalSoon',
      tone: 'arriving',
      kind: 'eta',
    });
  });

  it('maps single-digit minutes to the soon tone', () => {
    expect(resolveEtaLabel(row(5))).toEqual({
      key: 'busArrivalMinutes',
      params: { count: 5 },
      tone: 'soon',
      kind: 'eta',
    });
  });

  it('maps 10+ minutes to the normal tone', () => {
    expect(resolveEtaLabel(row(30))).toEqual({
      key: 'busArrivalMinutes',
      params: { count: 30 },
      tone: 'normal',
      kind: 'eta',
    });
  });

  // Regression: placeholder rows used to render as 「尚未發車」 while the
  // route-detail request was still in flight, contradicting the plan's own
  // "18:15 發車" badge.
  it('reports pending, not a status, while the lookup is still running', () => {
    const pendingRow = row(null, 'upcoming', '', true);
    expect(resolveEtaLabel(pendingRow).kind).toBe('pending');
    expect(resolveEtaLabel(pendingRow).key).toBeUndefined();
    expect(resolveEtaLabel(row(-1, 'upcoming', '', true)).kind).toBe('pending');
  });

  // The backend leaves StopStatus 0 as 「正常」 and computes estimateMinutes
  // independently, so 「正常」 + null ETA is a real combination. Calling that
  // "no service" is the misleading claim this whole change exists to remove.
  it('says nothing rather than claiming no service once settled', () => {
    expect(resolveEtaLabel(row(null, 'upcoming', '正常'))).toEqual({
      key: 'busEtaUnknown',
      tone: 'muted',
      kind: 'status',
    });
    expect(resolveEtaLabel(row(null, 'upcoming', '')).key).toBe(
      'busEtaUnknown',
    );
  });

  it('shows the next departure time instead of a missing ETA', () => {
    expect(resolveEtaLabel(row(null, 'upcoming', '18:15'))).toEqual({
      key: 'busScheduledAt',
      params: { time: '18:15' },
      tone: 'normal',
      kind: 'scheduled',
    });
    expect(resolveEtaLabel(row(-1, 'upcoming', '明日 06:00')).key).toBe(
      'busScheduledTomorrow',
    );
  });

  it('keeps 末班車已過 as an end-of-service status', () => {
    expect(resolveEtaLabel(row(null, 'upcoming', '末班車已過'))).toEqual({
      key: 'busServiceEnded',
      tone: 'muted',
      kind: 'status',
    });
  });

  it('prefers a live ETA over the status label', () => {
    expect(resolveEtaLabel(row(4, 'upcoming', '18:15')).key).toBe(
      'busArrivalMinutes',
    );
  });

  it('lets passed override any ETA', () => {
    expect(resolveEtaLabel(row(2, 'passed'))).toEqual({
      key: 'busStopPassed',
      tone: 'muted',
      kind: 'status',
    });
  });
});

describe('normalizeStopName', () => {
  it('folds the variants TDX and the planner disagree on', () => {
    expect(normalizeStopName('高鐵臺中站(第11月台)')).toBe(
      normalizeStopName('高鐵台中'),
    );
    expect(normalizeStopName('國立臺中科技大學')).toBe('國立台中科技大學');
    expect(normalizeStopName(' 中和 （黎明路） ')).toBe('中和');
    expect(normalizeStopName(undefined)).toBe('');
  });
});

describe('sliceLegStops name matching', () => {
  const stop = (seq: number, name: string) => ({
    seq,
    name,
    lat: 0,
    lng: 0,
    estimateMinutes: null,
    statusLabel: '',
  });

  it('matches across 臺/台 and a bracketed platform note', () => {
    const stops = [
      stop(0, '永順文心南七路口'),
      stop(1, '豐樂公園'),
      stop(2, '高鐵臺中站(第11月台)'),
    ];
    const sliced = sliceLegStops(stops, '永順文心南七路口', '高鐵台中站');
    expect(sliced?.map((s) => s.seq)).toEqual([0, 1, 2]);
  });

  it('prefers an exact match over a containment match', () => {
    const stops = [
      stop(0, '板橋'),
      stop(1, '板橋國中'),
      stop(2, '板橋'),
      stop(3, '終點'),
    ];
    // "板橋國中" contains "板橋", so a containment-first pass would board at 0.
    const sliced = sliceLegStops(stops, '板橋國中', '終點');
    expect(sliced?.map((s) => s.seq)).toEqual([1, 2, 3]);
  });
});

describe('resolveLegStops', () => {
  const line = (names: string[]) =>
    names.map((name, seq) => ({
      seq,
      name,
      lat: 0,
      lng: 0,
      estimateMinutes: null,
      statusLabel: '正常',
    }));

  const outbound = line([
    '高鐵臺中站(第11月台)',
    '豐樂公園',
    '永順文心南七路口',
  ]);
  const inbound = line([
    '永順文心南七路口',
    '豐樂公園',
    '高鐵臺中站(第11月台)',
  ]);
  const directions = [
    { direction: 0 as const, stops: outbound },
    { direction: 1 as const, stops: inbound },
  ];

  const leg = {
    direction: 0 as const,
    departureStop: '永順文心南七路口',
    arrivalStop: '高鐵臺中站(第11月台)',
  };

  // Regression: 365 / 26 declare direction 0 while the ride only exists in
  // direction 1, so slicing the declared direction found no arrival stop after
  // the departure stop and every badge was left with no data at all.
  it('falls through to the other direction when the declared one cannot hold the ride', () => {
    const sliced = resolveLegStops(directions, leg);
    expect(sliced?.map((s) => s.name)).toEqual([
      '永順文心南七路口',
      '豐樂公園',
      '高鐵臺中站(第11月台)',
    ]);
  });

  it('uses the declared direction when it does contain the ride', () => {
    const sliced = resolveLegStops(directions, { ...leg, direction: 1 });
    expect(sliced?.[0].name).toBe('永順文心南七路口');
  });

  it('returns null when neither direction contains the ride', () => {
    expect(
      resolveLegStops(directions, { ...leg, arrivalStop: '不存在的站' }),
    ).toBeNull();
    expect(resolveLegStops(undefined, leg)).toBeNull();
  });
});

describe('resolveLegStops sub-route scoping', () => {
  const line = (names: string[]) =>
    names.map((name, seq) => ({
      seq,
      name,
      lat: 0,
      lng: 0,
      estimateMinutes: null,
      statusLabel: '正常',
    }));

  // 99 and 99延 share a name and a direction number but not a stop list: only
  // 99延 reaches 臺中區監理所.
  const directions = [
    {
      direction: 0 as const,
      subRouteUid: 'TXG99',
      subRouteName: '99',
      stops: line(['豐樂公園', '美榮藥局', '仁友停車場']),
    },
    {
      direction: 0 as const,
      subRouteUid: 'TXG991',
      subRouteName: '99延',
      stops: line(['豐樂公園', '美榮藥局', '臺中區監理所(遊園路)']),
    },
  ];

  it('rides the sub-route the planner booked, not the first that fits', () => {
    const sliced = resolveLegStops(directions, {
      direction: 0,
      departureStop: '豐樂公園',
      arrivalStop: '美榮藥局',
      subRouteUid: 'TXG991',
    });
    expect(sliced?.map((s) => s.name)).toEqual(['豐樂公園', '美榮藥局']);
    // Scoped to 99延, so the stop only 99 serves must not leak in.
    expect(
      resolveLegStops(directions, {
        direction: 0,
        departureStop: '豐樂公園',
        arrivalStop: '仁友停車場',
        subRouteUid: 'TXG991',
      }),
    ).toBeNull();
  });

  it('falls back to geometry when the leg names no sub-route', () => {
    const sliced = resolveLegStops(directions, {
      direction: 0,
      departureStop: '豐樂公園',
      arrivalStop: '臺中區監理所(遊園路)',
    });
    expect(sliced?.at(-1)?.name).toBe('臺中區監理所(遊園路)');
  });

  it('never picks another sub-route when the named one is absent from the payload', () => {
    expect(
      resolveLegStops(directions, {
        direction: 0,
        departureStop: '豐樂公園',
        arrivalStop: '仁友停車場',
        subRouteUid: 'TXG-nope',
      }),
    ).toBeNull();
  });

  it('falls back to the only run that can hold the ride when the payload carries no sub-route ids', () => {
    const noIds = [
      { direction: 0 as const, stops: line(['X', 'Y']) },
      { direction: 1 as const, stops: line(['B', 'A']) },
    ];
    expect(resolveLegRide(noIds, { departureStop: 'A', arrivalStop: 'B', subRouteUid: 'TXG99' })).toBeNull();
    expect(resolveLegRide(noIds, { departureStop: 'B', arrivalStop: 'A', subRouteUid: 'TXG99' })).toMatchObject({
      direction: 1,
      exclusive: true,
    });
  });

  it('returns the sub-route of the matched run', () => {
    const ride = resolveLegRide(directions, { departureStop: '豐樂公園', arrivalStop: '美榮藥局', subRouteUid: 'TXG991' });
    expect(ride).toMatchObject({ direction: 0, subRouteUid: 'TXG991', exclusive: false });
  });

  it('refuses to guess between two runs of one sub-route that both hold the ride', () => {
    const both = [
      { direction: 1 as const, subRouteUid: 'TXG99', stops: line(['A', 'B', 'C']) },
      { direction: 0 as const, subRouteUid: 'TXG99', stops: line(['A', 'B', 'C']) },
    ];
    expect(resolveLegDirection(both, { direction: 0, departureStop: 'A', arrivalStop: 'C', subRouteUid: 'TXG99' })).toBeNull();
  });
});

describe('resolveLegRide against TDX directions (GTFS direction is not a tiebreak)', () => {
  const line = (names: string[]) =>
    names.map((name, seq) => ({ seq, name, lat: 0, lng: 0, estimateMinutes: null, statusLabel: '' }));
  const names = (ride: ReturnType<typeof resolveLegRide>) => ride?.stops.map((s) => s.name);

  it.each([
    [1, 'B', 'A'],
    [10, 'A', 'C'],
    [2, 'A', 'C'],
  ] as const)('GTFS direction 0 rides TDX direction %i', (tdx, board, alight) => {
    const directions = [
      { direction: tdx, subRouteUid: 'U', stops: line(tdx === 1 ? ['B', 'A'] : ['A', 'B', 'C']) },
      { direction: 255 as const, subRouteUid: 'U', stops: line(['A', 'B', 'C']) },
    ];
    const ride = resolveLegRide(directions, { direction: 0, departureStop: board, arrivalStop: alight, subRouteUid: 'U' });
    expect(ride?.direction).toBe(tdx);
    expect(resolveLegDirection(directions, { direction: 0, departureStop: board, arrivalStop: alight, subRouteUid: 'U' })).toBe(tdx);
  });

  it('never resolves to direction 255 even when it is the only run holding the ride', () => {
    expect(resolveLegRide([{ direction: 255, stops: line(['A', 'B']) }], { departureStop: 'A', arrivalStop: 'B' })).toBeNull();
  });

  it('a loop that repeats the board stop is ambiguous: keep the schedule', () => {
    const loop = [{ direction: 10 as const, subRouteUid: 'U', stops: line(['A', 'B', 'C', 'A', 'B', 'D']) }];
    expect(resolveLegRide(loop, { departureStop: 'A', arrivalStop: 'D', subRouteUid: 'U' })).toBeNull();
    // C 只出現一次、D 只在它之後：唯一區間，不受 A 重複影響。
    expect(names(resolveLegRide(loop, { departureStop: 'C', arrivalStop: 'D', subRouteUid: 'U' }))).toEqual(['C', 'A', 'B', 'D']);
  });

  it('a loop whose alight stop appears only after one board stop is unique', () => {
    const loop = [{ direction: 10 as const, subRouteUid: 'U', stops: line(['A', 'B', 'C', 'A']) }];
    expect(names(resolveLegRide(loop, { departureStop: 'A', arrivalStop: 'C', subRouteUid: 'U' }))).toEqual(['A', 'B', 'C']);
  });

  it('never wraps across the loop end', () => {
    const loop = [{ direction: 10 as const, subRouteUid: 'U', stops: line(['A', 'B', 'C']) }];
    expect(resolveLegRide(loop, { departureStop: 'C', arrivalStop: 'A', subRouteUid: 'U' })).toBeNull();
  });

  it('without a sub-route id, two runs that both hold the ride is ambiguous; one run is fine', () => {
    const shared = [
      { direction: 0 as const, subRouteUid: 'U1', stops: line(['A', 'B']) },
      { direction: 0 as const, subRouteUid: 'U2', stops: line(['A', 'B', 'C']) },
    ];
    expect(resolveLegRide(shared, { departureStop: 'A', arrivalStop: 'B' })).toBeNull();
    expect(resolveLegRide(shared, { departureStop: 'B', arrivalStop: 'C' })).toMatchObject({ subRouteUid: 'U2', direction: 0, exclusive: false });
  });
});

// SDD §6.5 / ROADMAP 2.2 指定的案例。站名是依各路線方向問題「形狀」構造的 fixture，不是 TDX 真實站序；
// 真實資料驗收要在 App 上用這三條路線各跑一次，與 Web（map.yuzen.dev）比對。
describe('direction regressions named in the SDD (365 / 26 reversed, 70 not)', () => {
  const line = (names: string[], labels: string[] = []) =>
    names.map((name, seq) => ({
      seq,
      name,
      lat: 25.03 + seq * 0.002,
      lng: 121.5,
      estimateMinutes: null,
      statusLabel: labels[seq] ?? '正常',
    }));

  function leg(direction: 0 | 1, departureStop: string, arrivalStop: string) {
    return { direction, departureStop, arrivalStop };
  }

  it.each([
    ['365', ['捷運站', '市場', '國小', '醫院'], '醫院', '市場'],
    ['26', ['轉運站', '公園', '圖書館', '區公所'], '區公所', '公園'],
  ])('%s: the declared direction 0 runs the other way, so the ride resolves to direction 1', (_route, stops, board, alight) => {
    const directions = [
      { direction: 0 as const, stops: line(stops) },
      { direction: 1 as const, stops: line([...stops].reverse()) },
    ];
    const declared = leg(0, board, alight);

    // 直接拿宣告方向切：上車站之後找不到下車站。
    expect(sliceLegStops(directions[0].stops, board, alight)).toBeNull();
    // 查 ETA／車輛位置前必須用這個方向，不是 leg.direction。
    expect(resolveLegDirection(directions, declared)).toBe(1);
    expect(resolveLegStops(directions, declared)?.map((s) => s.name)).toEqual(
      [...stops].reverse().slice(0, 3),
    );
  });

  it('70: the declared direction is right and must be kept', () => {
    const stops = ['總站', '中山路口', '火車站', '文化中心'];
    const directions = [
      { direction: 0 as const, stops: line(stops) },
      { direction: 1 as const, stops: line([...stops].reverse()) },
    ];
    expect(resolveLegDirection(directions, leg(0, '中山路口', '文化中心'))).toBe(0);
    expect(resolveLegDirection(directions, leg(1, '文化中心', '中山路口'))).toBe(1);
  });

  it('a whole leg showing one identical status is the fingerprint of the wrong direction', () => {
    // 挑錯方向時，整段每一站都是同一句狀態（例如全是「末班車已過」或同一個起點發車時刻）；
    // 挑對方向時才會有逐站不同的 ETA。這裡驗證 resolveLegRide 拿到的是後者。
    const names = ['A', 'B', 'C', 'D'];
    const wrong = line(names, ['18:15 起點發車', '18:15 起點發車', '18:15 起點發車', '18:15 起點發車']);
    const right = line([...names].reverse()).map((s, i) => ({ ...s, estimateMinutes: 3 + i * 2 }));
    const directions = [
      { direction: 0 as const, stops: wrong },
      { direction: 1 as const, stops: right },
    ];
    const ride = resolveLegStops(directions, leg(0, 'D', 'B'));
    const labels = buildStopRows(ride ?? [], null).map((row) => JSON.stringify(resolveEtaLabel(row)));
    expect(new Set(labels).size).toBeGreaterThan(1);

    const wrongLabels = buildStopRows(wrong, null).map((row) => JSON.stringify(resolveEtaLabel(row)));
    expect(new Set(wrongLabels).size).toBe(1);
  });
});


it("retains the original 10:00 schedule at every stop even while loading or after failure", () => {
  const at = Date.parse("2030-01-01T10:00:00+08:00");
  const leg = { type: "BUS", departureStop: "A", arrivalStop: "C", scheduledTrip: {
    tripId: "trip", boardingReadyAt: at - 600_000, stops: [
      { name: "A", arrivalAt: at - 60_000, departureAt: at },
      { name: "B", arrivalAt: at + 600_000 },
      { name: "C", arrivalAt: at + 1_200_000 },
    ],
  } } as BusLeg;
  const rows = fallbackStopRows(leg, { pending: true });
  expect(rows.map((r) => [r.name, r.estimateMinutes, r.statusLabel, r.pending])).toEqual([
    ["A", null, "10:00", false], ["B", null, "10:10", false], ["C", null, "10:20", false],
  ]);
});
