import type { LiveBus } from '../../types/transit';
import { busFrame, buildBusTweens } from '../busTween';
import { isAccessibleBus, liveBusCollection, selectDisplayBuses } from '../liveBusGeoJson';

function bus(plateNumb: string, extra: Partial<LiveBus> = {}): LiveBus {
  return {
    plateNumb,
    direction: 0,
    lat: 25,
    lng: 121,
    speed: 0,
    gpsTime: '',
    isLowFloor: '否',
    hasLiftOrRamp: '否',
    vehicleClass: '',
    ...extra,
  };
}

describe('selectDisplayBuses', () => {
  it('shows only targets when flagged', () => {
    const list = [bus('A'), bus('B', { isTarget: true })];
    expect(selectDisplayBuses(list).map((b) => b.plateNumb)).toEqual(['B']);
  });
  it('falls back to all when none flagged', () => {
    expect(selectDisplayBuses([bus('A'), bus('B')])).toHaveLength(2);
  });
});

describe('isAccessibleBus', () => {
  it('is true for low floor or lift/ramp', () => {
    expect(isAccessibleBus(bus('A', { isLowFloor: '是' }))).toBe(true);
    expect(isAccessibleBus(bus('A', { hasLiftOrRamp: '是' }))).toBe(true);
    expect(isAccessibleBus(bus('A'))).toBe(false);
  });
});

describe('liveBusCollection', () => {
  it('builds [lng, lat] point features', () => {
    const frames = busFrame(buildBusTweens([bus('A', { isLowFloor: '是' })], new Map()), 1);
    const c = liveBusCollection(frames);
    expect(c.features[0]?.geometry.coordinates).toEqual([121, 25]);
    expect(c.features[0]?.properties).toEqual({ plate: 'A', accessible: 1, bearing: 0 });
  });
  it('returns the shared empty collection for no buses', () => {
    expect(liveBusCollection([]).features).toEqual([]);
  });
});
