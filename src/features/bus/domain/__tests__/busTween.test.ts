// Web `useAnimatedBuses` 沒有測試；補間計算抽成純函式後補上。
import type { LiveBus } from '../../types/transit';
import { buildBusTweens, busFrame, easeOutCubic, type DrawnPosition } from '../busTween';

function bus(plateNumb: string, lat: number, lng: number): LiveBus {
  return {
    plateNumb,
    direction: 0,
    lat,
    lng,
    speed: 0,
    gpsTime: '',
    isLowFloor: '是',
    hasLiftOrRamp: '是',
    vehicleClass: '',
  };
}

describe('busTween', () => {
  it('glides a known plate from where it is drawn and heads toward the new fix', () => {
    const drawn = new Map<string, DrawnPosition>([['A', { lat: 25, lng: 121, bearing: 10 }]]);
    const tweens = buildBusTweens([bus('A', 25.01, 121)], drawn);
    expect(tweens[0].bearing).toBeCloseTo(0, 5); // 往北
    expect(busFrame(tweens, 0)[0].lat).toBe(25);
    expect(busFrame(tweens, 0.5)[0].lat).toBeCloseTo(25 + 0.01 * easeOutCubic(0.5), 10);
    expect(busFrame(tweens, 1)[0].lat).toBeCloseTo(25.01, 10);
  });

  it('shows a new plate at its reported position immediately', () => {
    const [tw] = buildBusTweens([bus('B', 25.02, 121.5)], new Map());
    expect(busFrame([tw], 0)[0]).toMatchObject({ lat: 25.02, lng: 121.5, bearing: 0 });
  });

  it('keeps the previous bearing when the bus did not move', () => {
    const drawn = new Map<string, DrawnPosition>([['A', { lat: 25, lng: 121, bearing: 135 }]]);
    expect(buildBusTweens([bus('A', 25, 121)], drawn)[0].bearing).toBe(135);
  });

  it('clamps progress outside 0–1', () => {
    const tweens = buildBusTweens([bus('A', 25.01, 121)], new Map([['A', { lat: 25, lng: 121, bearing: 0 }]]));
    expect(busFrame(tweens, 5)[0].lat).toBeCloseTo(25.01, 10);
    expect(busFrame(tweens, -1)[0].lat).toBe(25);
  });
});
