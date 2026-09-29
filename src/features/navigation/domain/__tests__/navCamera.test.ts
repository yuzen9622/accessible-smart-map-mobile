import { buildCumulativePath, type NavInstruction, type RouteLeg } from '@/features/route/domain';

import { NAV_PITCH, NAV_ZOOM, NAV_ZOOM_VEHICLE, navFollowParams } from '../navCamera';
import { gpsNearRoute } from '../navigationEngine';

const walk: RouteLeg = {
  type: 'WALK',
  from: 'A',
  to: 'B',
  distanceM: 200,
  minutesEst: 3,
  polyline: [
    [121.5, 25.03],
    [121.502, 25.03],
  ],
  a11yFacilities: [],
};

function step(legType: NavInstruction['legType']): NavInstruction {
  return { text: '', type: 'turn', bearing: null, relativeDirection: null, distanceM: null, streetName: null, legType, polylineIndex: 0 };
}

describe('navCamera', () => {
  it('lets GPS drive the camera only near the route', () => {
    const cp = buildCumulativePath([walk]);
    expect(gpsNearRoute({ lat: 25.0301, lng: 121.501 }, cp)).toBe(true);
    expect(gpsNearRoute({ lat: 24.145, lng: 120.694 }, cp)).toBe(false);
    expect(gpsNearRoute(null, cp)).toBe(false);
  });

  it('follows by compass on foot and by course in a vehicle, with the leg zoom', () => {
    expect(navFollowParams([step('WALK')], 0, 'WALK', '3d')).toEqual({ mode: 'heading', zoom: NAV_ZOOM, pitch: NAV_PITCH });
    expect(navFollowParams([step('DRIVE')], 0, 'DRIVE', '2d')).toEqual({ mode: 'course', zoom: NAV_ZOOM_VEHICLE, pitch: 0 });
  });

  it('falls back to the first leg type before instructions load', () => {
    expect(navFollowParams([], 0, 'DRIVE', '3d').mode).toBe('course');
  });
});
