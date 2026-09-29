import { effectiveTravelMode, hasGatedTravelModes, isTravelModeAllowed } from '../travelModes';

describe('travel mode gating (Web RoutePlanContent DISALLOWED_TRAVEL_MODES)', () => {
  it('disables drive and motorcycle for wheelchair and visually impaired users', () => {
    for (const mode of ['wheelchair', 'visual_impaired'] as const) {
      expect(isTravelModeAllowed(mode, 'drive')).toBe(false);
      expect(isTravelModeAllowed(mode, 'motorcycle')).toBe(false);
      expect(isTravelModeAllowed(mode, 'transit')).toBe(true);
      expect(isTravelModeAllowed(mode, 'walk')).toBe(true);
      expect(hasGatedTravelModes(mode)).toBe(true);
    }
  });

  it('allows every travel mode for normal and elderly users', () => {
    for (const mode of ['normal', 'elderly'] as const) {
      expect(isTravelModeAllowed(mode, 'drive')).toBe(true);
      expect(hasGatedTravelModes(mode)).toBe(false);
    }
  });

  it('falls back to transit when the current travel mode becomes disallowed', () => {
    expect(effectiveTravelMode('wheelchair', 'drive')).toBe('transit');
    expect(effectiveTravelMode('wheelchair', 'walk')).toBe('walk');
    expect(effectiveTravelMode('normal', 'drive')).toBe('drive');
  });
});
