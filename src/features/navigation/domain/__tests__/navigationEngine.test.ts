// Web 的進度判斷寫在 useNavigation 的 effect 裡、沒有直接測試；抽成純函式後補上 SDD §6.4 的不變量。
import { buildCumulativePath, resolveWaypoints, type NavInstruction, type RouteLeg } from '@/features/route/domain';

import {
  FOLLOW_GPS_MAX_M,
  OFF_ROUTE_HITS,
  advanceNavigation,
  angularDistanceDeg,
  gpsNearRoute,
  resolveStepMode,
  smoothingFactor,
  type EngineState,
} from '../navigationEngine';

// 沿緯度 25.05 往東的直線；每 0.001° 經度約 101 m。
function eastLine(startLng: number, count: number): [number, number][] {
  return Array.from({ length: count }, (_, i) => [startLng + i * 0.001, 25.05] as [number, number]);
}

function walk(polyline: [number, number][]): RouteLeg {
  return { type: 'WALK', from: 'A', to: 'B', distanceM: 0, minutesEst: 0, polyline, a11yFacilities: [] };
}

function drive(polyline: [number, number][]): RouteLeg {
  return { type: 'DRIVE', from: 'A', to: 'B', distanceM: 0, durationMin: 0, polyline };
}

function step(legIndex: number, polylineIndex: number, overrides: Partial<NavInstruction> = {}): NavInstruction {
  return {
    text: '',
    type: 'turn',
    bearing: null,
    relativeDirection: null,
    distanceM: null,
    streetName: null,
    legType: 'WALK',
    legIndex,
    polylineIndex,
    ...overrides,
  };
}

const INITIAL: EngineState = {
  currentStepIndex: 0,
  isOffRoute: false,
  arrived: false,
  offRouteHits: 0,
  lastLegType: null,
};

function setup(legs: RouteLeg[], instructions: NavInstruction[]) {
  const path = buildCumulativePath(legs);
  const geometry = { path, waypoints: resolveWaypoints(instructions, path) };
  return (lat: number, lng: number, state: EngineState = INITIAL, now = 1_000_000) =>
    advanceNavigation({
      position: { lat, lng },
      geometry,
      instructions,
      state,
      now,
      routeTotalMinutes: 10,
    });
}

describe('advanceNavigation', () => {
  const legs = [walk(eastLine(121.5, 6))];
  const instructions = [
    step(0, 0, { type: 'depart' }),
    step(0, 2),
    step(0, 4),
    step(0, 5, { type: 'arrive' }),
  ];
  const sample = setup(legs, instructions);

  it('advances to the first maneuver still ahead and reports distance to it', () => {
    const r = sample(25.05, 121.5025);
    expect(r?.state.currentStepIndex).toBe(2);
    expect(r?.progress.distanceToNextM).toBeGreaterThan(140);
    expect(r?.progress.distanceToNextM).toBeLessThan(160);
    expect(r?.progress.etaSource).toBe('local');
  });

  it('estimates remaining time in proportion to remaining distance', () => {
    const r = sample(25.05, 121.5025);
    // 走了一半：10 分鐘的路剩約 5 分鐘。
    expect(r?.progress.remainingDurationSec).toBe(300);
    expect(r?.progress.estimatedArrivalAt).toBe(1_000_000 + 300_000);
  });

  it('never moves backwards on its own', () => {
    const r = sample(25.05, 121.5005, { ...INITIAL, currentStepIndex: 2 });
    expect(r?.state.currentStepIndex).toBe(2);
  });

  it('advances from position alone, whatever step it starts on', () => {
    const r = sample(25.05, 121.5035, { ...INITIAL, currentStepIndex: 1 });
    expect(r?.state.currentStepIndex).toBe(2);
  });

  it(`needs ${OFF_ROUTE_HITS} consecutive off-route samples before confirming`, () => {
    let state = INITIAL;
    const signals: string[] = [];
    for (let i = 0; i < OFF_ROUTE_HITS; i++) {
      // 偏北約 55 m：超過步行 40 m 門檻、未超過 500 m 跟隨上限。
      const r = sample(25.0505, 121.502, state);
      signals.push(r?.offRoute ?? 'null');
      state = r?.state ?? state;
    }
    expect(signals).toEqual(['none', 'none', 'confirm']);
    expect(state.isOffRoute).toBe(true);

    const back = sample(25.05, 121.502, state);
    expect(back?.offRoute).toBe('clear');
    expect(back?.backOnRoute).toBe(true);
    expect(back?.state.offRouteHits).toBe(0);
  });

  it('ignores fixes too far from the route to project meaningfully', () => {
    expect(FOLLOW_GPS_MAX_M).toBe(500);
    expect(sample(25.06, 121.502)).toBeNull();
  });

  it('signals arrival once and only once', () => {
    const first = sample(25.05, 121.505);
    expect(first?.arrivedNow).toBe(true);
    expect(first?.state.arrived).toBe(true);
    const again = sample(25.05, 121.505, first?.state);
    expect(again?.arrivedNow).toBe(false);
  });

  it('does not arrive at the start of a route (per-leg index regression guard)', () => {
    const r = sample(25.05, 121.5);
    expect(r?.arrivedNow).toBe(false);
  });

  it('does not arrive on proximity alone while the step index is still held back (e.g. transit not yet boarded)', () => {
    // 位置落在終點座標附近，但 maxStepIndex 把 currentStepIndex 擋在倒數第二步之前——
    // 單憑直線距離會誤判抵達（回報 bug：「還沒抵達卻顯示已抵達」，見 navigationEngine.ts 抵達判斷註解）。
    const r = advanceNavigation({
      position: { lat: 25.05, lng: 121.505 },
      geometry: { path: buildCumulativePath(legs), waypoints: resolveWaypoints(instructions, buildCumulativePath(legs)) },
      instructions,
      state: INITIAL,
      now: 1_000_000,
      routeTotalMinutes: 10,
      maxStepIndex: 2,
    });
    expect(r?.state.currentStepIndex).toBe(2);
    expect(r?.arrivedNow).toBe(false);
  });
});

describe('advanceNavigation drive → walk handoff', () => {
  // 開車 5 點（約 400 m）接步行 3 點。
  const legs = [drive(eastLine(121.5, 5)), walk(eastLine(121.504, 3))];
  const instructions = [
    step(0, 0, { type: 'depart', legType: 'DRIVE' }),
    step(0, 4, { type: 'arrive', legType: 'DRIVE' }),
    step(1, 0, { type: 'depart' }),
    step(1, 2, { type: 'arrive' }),
  ];
  const sample = setup(legs, instructions);

  it('flags the handoff when the active leg crosses the vehicle/on-foot boundary', () => {
    const onRoad = sample(25.05, 121.501);
    expect(onRoad?.activeLegType).toBe('DRIVE');
    expect(onRoad?.legHandoff).toBe(false);

    const onFoot = sample(25.05, 121.5045, onRoad?.state);
    expect(onFoot?.activeLegType).toBe('WALK');
    expect(onFoot?.legHandoff).toBe(true);
  });

  it('drops an off-route streak built at driving tolerances on handoff', () => {
    const state: EngineState = { ...INITIAL, lastLegType: 'DRIVE', offRouteHits: 2, isOffRoute: true };
    const r = sample(25.05, 121.5045, state);
    expect(r?.legHandoff).toBe(true);
    expect(r?.state.offRouteHits).toBe(0);
    expect(r?.state.isOffRoute).toBe(false);
  });
});

describe('helpers', () => {
  it('gpsNearRoute needs a fix within the follow radius', () => {
    const cp = buildCumulativePath([walk(eastLine(121.5, 3))]);
    expect(gpsNearRoute({ lat: 25.05, lng: 121.501 }, cp)).toBe(true);
    expect(gpsNearRoute({ lat: 25.06, lng: 121.501 }, cp)).toBe(false);
    expect(gpsNearRoute(null, cp)).toBe(false);
  });

  it('smooths exponentially and measures the short way round', () => {
    expect(smoothingFactor(0, 320)).toBe(0);
    expect(smoothingFactor(320, 320)).toBeCloseTo(1 - Math.exp(-1), 10);
    expect(angularDistanceDeg(350, 10)).toBe(20);
    expect(angularDistanceDeg(0, 180)).toBe(180);
  });
});

describe('resolveStepMode', () => {
  const cp = buildCumulativePath([
    { type: 'WALK', from: 'A', to: 'B', distanceM: 300, minutesEst: 5, polyline: [[121.5, 25.05], [121.503, 25.05]], a11yFacilities: [] },
  ]);

  it('is live near the route and preview when far or without a fix', () => {
    expect(resolveStepMode('preview', { lat: 25.05, lng: 121.501 }, cp)).toBe('live');
    expect(resolveStepMode('preview', { lat: 24.1477, lng: 120.6736 }, cp)).toBe('preview');
    expect(resolveStepMode('preview', null, cp)).toBe('preview');
  });

  it('never demotes live back to preview', () => {
    expect(resolveStepMode('live', { lat: 24.1477, lng: 120.6736 }, cp)).toBe('live');
    expect(resolveStepMode('live', null, cp)).toBe('live');
  });
});
