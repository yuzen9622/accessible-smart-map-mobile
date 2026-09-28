// Web 版沒有直接針對 buildCumulativePath／resolveWaypoints 的單元測試（只透過導航測試間接覆蓋，
// 那些隨 Phase 2.3 移植）。這裡補上 SDD §6.3「polylineIndex 是 per-leg、超出範圍要 clamp」的守門案例。
import type { NavInstruction, RouteLeg, WalkLeg } from '../../types/route';
import { bearingDeg, buildCumulativePath, normalizeDeg, projectToPath, resolveWaypoints, shortestAngleLerp } from '../geo';

function walk(polyline: [number, number][]): WalkLeg {
  return {
    type: 'WALK',
    from: 'A',
    to: 'B',
    distanceM: 0,
    minutesEst: 0,
    polyline,
    a11yFacilities: [],
  };
}

function ins(overrides: Partial<NavInstruction>): NavInstruction {
  return {
    text: '',
    type: 'turn',
    bearing: null,
    relativeDirection: null,
    distanceM: null,
    streetName: null,
    legType: 'WALK',
    polylineIndex: null,
    ...overrides,
  };
}

// 兩段各 3 點、沿緯線往東；第二段接在第一段後面。
const legs: RouteLeg[] = [
  walk([
    [121.5, 25.0],
    [121.501, 25.0],
    [121.502, 25.0],
  ]),
  walk([
    [121.503, 25.0],
    [121.504, 25.0],
    [121.505, 25.0],
  ]),
];

describe('buildCumulativePath', () => {
  it('concatenates legs and records per-leg ranges', () => {
    const { path, cumM, legRanges } = buildCumulativePath(legs);
    expect(path).toHaveLength(6);
    expect(legRanges).toEqual([
      { start: 0, count: 3 },
      { start: 3, count: 3 },
    ]);
    expect(cumM[0]).toBe(0);
    for (let i = 1; i < cumM.length; i++) expect(cumM[i]).toBeGreaterThan(cumM[i - 1]);
  });

  it('keeps an empty range for legs without geometry', () => {
    const { legRanges } = buildCumulativePath([legs[0], walk([]), legs[1]]);
    expect(legRanges[1]).toEqual({ start: 3, count: 0 });
    expect(legRanges[2]).toEqual({ start: 3, count: 3 });
  });
});

describe('resolveWaypoints', () => {
  const cumulative = buildCumulativePath(legs);

  it('resolves polylineIndex relative to its own leg, not the concatenated path', () => {
    // 第二段的 polylineIndex 0 是整條路徑的第 3 點；若誤當全域索引會落在第一段起點。
    const [wp] = resolveWaypoints([ins({ legIndex: 1, polylineIndex: 0 })], cumulative);
    expect(wp.coord).toEqual({ lat: 25.0, lng: 121.503 });
  });

  it('clamps an out-of-range polylineIndex inside the source leg', () => {
    const [wp] = resolveWaypoints([ins({ legIndex: 0, polylineIndex: 99 })], cumulative);
    expect(wp.coord).toEqual({ lat: 25.0, lng: 121.502 });
  });

  it('anchors null-index board/alight instructions to their leg ends', () => {
    const [board, alight] = resolveWaypoints(
      [
        ins({ legIndex: 1, type: 'transit_board', legType: 'BUS' }),
        ins({ legIndex: 1, type: 'transit_alight', legType: 'BUS' }),
      ],
      cumulative,
    );
    expect(board.coord).toEqual({ lat: 25.0, lng: 121.503 });
    expect(alight.coord).toEqual({ lat: 25.0, lng: 121.505 });
  });

  it('never moves backwards along the route', () => {
    const wps = resolveWaypoints(
      [ins({ legIndex: 1, polylineIndex: 2 }), ins({ legIndex: 0, polylineIndex: 0 })],
      cumulative,
    );
    expect(wps[1].alongM).toBeGreaterThanOrEqual(wps[0].alongM);
  });

  it('falls back to a clamped global index for instructions without legIndex (voice/legacy)', () => {
    const [wp] = resolveWaypoints([ins({ polylineIndex: 4 })], cumulative);
    expect(wp.coord).toEqual({ lat: 25.0, lng: 121.504 });
    const [clamped] = resolveWaypoints([ins({ polylineIndex: 99 })], cumulative);
    expect(clamped.coord).toEqual({ lat: 25.0, lng: 121.505 });
  });

  it('returns nothing for an empty path', () => {
    expect(resolveWaypoints([ins({ polylineIndex: 0 })], buildCumulativePath([]))).toEqual([]);
  });
});

describe('projectToPath', () => {
  const { path, cumM } = buildCumulativePath(legs);

  it('measures perpendicular distance and along-route progress', () => {
    const p = projectToPath({ lat: 25.0005, lng: 121.5015 }, path, cumM);
    expect(p.segIndex).toBe(1);
    expect(p.perpDistM).toBeGreaterThan(50);
    expect(p.perpDistM).toBeLessThan(60);
    expect(p.alongM).toBeGreaterThan(cumM[1]);
    expect(p.alongM).toBeLessThan(cumM[2]);
  });

  it('reports Infinity off-route distance for an empty path', () => {
    expect(projectToPath({ lat: 25, lng: 121 }, [], []).perpDistM).toBe(Infinity);
  });
});

describe('angle helpers', () => {
  it('normalizes into [0, 360)', () => {
    expect(normalizeDeg(-90)).toBe(270);
    expect(normalizeDeg(720)).toBe(0);
  });

  it('computes compass bearing', () => {
    expect(bearingDeg({ lat: 25, lng: 121 }, { lat: 25.01, lng: 121 })).toBeCloseTo(0, 5);
    expect(bearingDeg({ lat: 25, lng: 121 }, { lat: 25, lng: 121.01 })).toBeCloseTo(90, 1);
  });

  it('interpolates along the shortest arc across north', () => {
    expect(shortestAngleLerp(350, 10, 0.5)).toBeCloseTo(0, 5);
  });
});
