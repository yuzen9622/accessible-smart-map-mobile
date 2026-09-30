import type { BusLeg, RouteLeg, WalkLeg } from '../../types/route';
import { legChainSegments, shortMetroLabel } from '../routeCard';

const walk: WalkLeg = { type: 'WALK', from: '', to: '', distanceM: 0, minutesEst: 0, polyline: [], a11yFacilities: [] };
const bus: BusLeg = {
  type: 'BUS',
  routeName: '28',
  departureStop: 'A',
  arrivalStop: 'B',
  waitInfo: { time: null, source: 'unavailable' },
  estimatedWaitMinutes: 0,
  direction: 0,
  polyline: [],
  departureStopA11y: [],
  arrivalStopA11y: [],
};

describe('legChainSegments', () => {
  it('merges consecutive walks and labels transit with its route number', () => {
    const legs: RouteLeg[] = [walk, walk, bus, walk];
    expect(legChainSegments(legs)).toEqual([{ type: 'WALK' }, { type: 'BUS', label: '28' }, { type: 'WALK' }]);
  });

  it('keeps separate walks around a transit leg', () => {
    expect(legChainSegments([walk, bus, walk, walk]).map((s) => s.type)).toEqual(['WALK', 'BUS', 'WALK']);
  });

  it('handles an empty route', () => {
    expect(legChainSegments([])).toEqual([]);
  });
});

describe('shortMetroLabel', () => {
  it('keeps short line names', () => {
    expect(shortMetroLabel('板南線', 'BL')).toBe('板南線');
  });

  it('names Taipei Metro lines the way riders know them', () => {
    expect(shortMetroLabel('南港展覽館－亞東醫院', 'BL')).toBe('板南線');
    expect(shortMetroLabel('南港展覽館－亞東醫院', 'TRTC_BL', 'TRTC')).toBe('板南線');
    expect(shortMetroLabel('南港展覽館－亞東醫院', 'BL', 'metro')).toBe('板南線');
  });

  it('does not apply Taipei names to other metro systems', () => {
    expect(shortMetroLabel('高雄國際機場－南岡山', 'R', 'KRTC')).toBe('R');
  });

  it('falls back to the first terminus without a usable id', () => {
    expect(shortMetroLabel('南港展覽館－亞東醫院', '')).toBe('南港展覽館');
    expect(shortMetroLabel('南港展覽館－亞東醫院', 'TRTC-BL-LONG-ID')).toBe('南港展覽館');
  });
});
