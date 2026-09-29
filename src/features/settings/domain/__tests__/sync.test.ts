import { DEFAULT_A11Y_PROFILE } from '@/features/onboarding/domain';

import {
  decideProfileSync,
  fromServerA11yProfile,
  parseServerA11yProfile,
  toServerA11yProfile,
  type ServerA11yProfile,
} from '../a11yProfileSync';
import { fromRemoteConfig, toRemoteConfigPatch } from '../remoteConfig';

const EMPTY: ServerA11yProfile = {
  mobilityAid: null,
  canUseStairs: null,
  maxSlopePercent: null,
  needsAccessibleToilet: null,
  needsElevator: null,
  needsHandrail: null,
  visualAssistance: null,
  preferredFontScale: null,
};

describe('remote config mapping', () => {
  it('never sends highContrast, and only sends language when explicitly chosen', () => {
    expect(toRemoteConfigPatch({ highContrast: true })).toEqual({});
    expect(toRemoteConfigPatch({ language: 'system' })).toEqual({});
    expect(toRemoteConfigPatch({ language: 'en', themeMode: 'dark' })).toEqual({ language: 'en', darkMode: 'dark' });
  });

  it('applies server darkMode/fontSize/memory but not language or notifications', () => {
    expect(
      fromRemoteConfig({ darkMode: 'light', fontSize: 'large', language: 'en', notifications: true, memoryEnabled: false }),
    ).toEqual({ themeMode: 'light', fontSize: 'large', memoryEnabled: false });
  });
});

describe('a11y profile sync', () => {
  it('parses nulls and rejects unknown mobility aids', () => {
    expect(parseServerA11yProfile({ mobilityAid: 'jetpack', canUseStairs: false })).toEqual({ ...EMPTY, canUseStairs: false });
    expect(parseServerA11yProfile('x')).toBeNull();
  });

  it('maps a wheelchair user to manual_wheelchair without stairs', () => {
    const local = { ...DEFAULT_A11Y_PROFILE, situations: ['wheelchair' as const], avoidStairs: true, requireElevator: true };
    expect(toServerA11yProfile(local)).toEqual({
      mobilityAid: 'manual_wheelchair',
      canUseStairs: false,
      needsElevator: true,
      visualAssistance: false,
      needsAccessibleToilet: true,
    });
  });

  it('pulls a server profile into an empty local profile', () => {
    const server = { ...EMPTY, mobilityAid: 'power_wheelchair' as const, visualAssistance: true };
    const decision = decideProfileSync(DEFAULT_A11Y_PROFILE, server);
    expect(decision.kind).toBe('pull');
    if (decision.kind === 'pull') {
      expect(decision.profile.situations).toEqual(['wheelchair', 'vision']);
      expect(decision.profile.routeMode).toBe('wheelchair');
      expect(decision.profile.avoidStairs).toBe(true);
    }
  });

  it('local non-empty wins and is pushed; both empty does nothing', () => {
    const local = { ...DEFAULT_A11Y_PROFILE, situations: ['slow' as const] };
    expect(decideProfileSync(local, { ...EMPTY, mobilityAid: 'walker' })).toEqual({ kind: 'push' });
    expect(decideProfileSync(DEFAULT_A11Y_PROFILE, EMPTY)).toEqual({ kind: 'none' });
    expect(decideProfileSync(DEFAULT_A11Y_PROFILE, null)).toEqual({ kind: 'none' });
  });

  it('explicit server stair preference pins the step-free flags', () => {
    const pulled = fromServerA11yProfile({ ...EMPTY, canUseStairs: true, mobilityAid: 'none' }, DEFAULT_A11Y_PROFILE);
    expect(pulled.avoidStairs).toBe(false);
    expect(pulled.stepFreeFlagsAuto).toBe(false);
  });
});
