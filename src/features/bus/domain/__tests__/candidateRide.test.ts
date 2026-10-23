import { resolveCandidateRide, sliceRoutePolyline } from '../candidateRide';
import type { RouteDetailDirection, RouteDetailStop } from '../../types/transit';

const stop = (seq: number, stopUid: string, lng: number, lat = 24.15): RouteDetailStop => ({
  seq, name: stopUid, lat, lng, stopUid, estimateMinutes: null, statusLabel: '',
});

// 東西向一條直線，每 0.001 度（約 100 m）一個線形點
const line: [number, number][] = Array.from({ length: 11 }, (_, i) => [120.68 + i * 0.001, 24.15]);

describe('sliceRoutePolyline', () => {
  it('cuts the shape between the board and alight stops', () => {
    const sliced = sliceRoutePolyline(line, { lat: 24.15, lng: 120.6825 }, { lat: 24.15, lng: 120.6865 });
    expect(sliced?.[0][0]).toBeCloseTo(120.6825, 6);
    expect(sliced?.at(-1)?.[0]).toBeCloseTo(120.6865, 6);
    expect(sliced?.slice(1, -1).map(([lng]) => Number(lng.toFixed(3)))).toEqual([120.683, 120.684, 120.685, 120.686]);
  });

  it('rejects a stop far from the shape and an alight point behind the board point', () => {
    expect(sliceRoutePolyline(line, { lat: 24.16, lng: 120.683 }, { lat: 24.15, lng: 120.686 })).toBeNull();
    expect(sliceRoutePolyline(line.slice(0, 2), { lat: 24.15, lng: 120.6808 }, { lat: 24.15, lng: 120.6802 })).toBeNull();
  });

  it('on a loop, looks for the alight stop only after the board stop', () => {
    // 出去再沿同一條路回來：下車站的座標在去程也有一個投影點，但那在上車站之前
    const loop: [number, number][] = [...line, ...[...line].reverse().slice(1)];
    const sliced = sliceRoutePolyline(loop, { lat: 24.15, lng: 120.689 }, { lat: 24.15, lng: 120.6845 });
    expect(sliced).not.toBeNull();
    expect(sliced!.length).toBeGreaterThan(5);
  });
});

describe('resolveCandidateRide', () => {
  const directions: RouteDetailDirection[] = [
    { direction: 0, subRouteUid: 'TXG25', stops: [stop(1, 'B', 120.689), stop(2, 'M', 120.685), stop(3, 'A0', 120.681)] },
    {
      direction: 1,
      subRouteUid: 'TXG25',
      stops: [stop(1, 'X', 120.68), stop(2, 'TXG1237', 120.682), stop(3, 'M1', 120.684), stop(4, 'TXG10286', 120.686), stop(5, 'Y', 120.689)],
      polyline: line,
    },
  ];
  const candidate = { subRouteUid: 'TXG25', direction: 1 as const, departureStopId: 'TXG1237', arrivalStopId: 'TXG10286' };

  it("slices the candidate's own stops and geometry by its stop ids", () => {
    const ride = resolveCandidateRide(directions, candidate);
    expect(ride?.stops.map((s) => s.stopUid)).toEqual(['TXG1237', 'M1', 'TXG10286']);
    expect(ride?.polyline[0][0]).toBeCloseTo(120.682, 6);
    expect(ride?.polyline.at(-1)?.[0]).toBeCloseTo(120.686, 6);
  });

  it('falls back to a straight stop-to-stop line when the run has no shape', () => {
    const noShape = directions.map((d) => ({ ...d, polyline: undefined }));
    expect(resolveCandidateRide(noShape, candidate)?.polyline).toEqual([[120.682, 24.15], [120.684, 24.15], [120.686, 24.15]]);
  });

  it('is null when the stops are not on this sub-route, or in the wrong order', () => {
    expect(resolveCandidateRide(directions, { ...candidate, subRouteUid: 'TXG21' })).toBeNull();
    expect(resolveCandidateRide(directions, { ...candidate, departureStopId: 'TXG10286', arrivalStopId: 'TXG1237' })).toBeNull();
    expect(resolveCandidateRide(null, candidate)).toBeNull();
  });
});
