import type { NavInstruction } from '@/features/route/domain';

import {
  LIVE_MIN_INTERVAL_MS,
  buildLiveSnapshot,
  shouldSendLiveUpdate,
  type LiveNavigationSnapshot,
} from '../liveNavigation';
import { stepIcon } from '../navStepIcon';

const base: LiveNavigationSnapshot = {
  icon: 'cornerUpRight',
  instruction: '右轉',
  distanceToNextM: 100,
  progress: 0.2,
  estimatedArrivalAt: null,
  remainingDurationSec: 300,
  rerouting: false,
};

describe('shouldSendLiveUpdate', () => {
  it('always sends the first snapshot', () => {
    expect(shouldSendLiveUpdate({ lastSentAt: 0, last: null }, base, 0)).toBe(true);
  });

  it('sends a new maneuver or a reroute immediately, ignoring the interval', () => {
    const state = { lastSentAt: 1000, last: base };
    expect(shouldSendLiveUpdate(state, { ...base, instruction: '左轉', icon: 'cornerUpLeft' }, 1001)).toBe(true);
    expect(shouldSendLiveUpdate(state, { ...base, rerouting: true }, 1001)).toBe(true);
  });

  it('throttles distance-only changes to 10 m and 2 s', () => {
    const state = { lastSentAt: 1000, last: base };
    expect(shouldSendLiveUpdate(state, { ...base, distanceToNextM: 50 }, 1000 + LIVE_MIN_INTERVAL_MS - 1)).toBe(false);
    expect(shouldSendLiveUpdate(state, { ...base, distanceToNextM: 95 }, 1000 + LIVE_MIN_INTERVAL_MS)).toBe(false);
    expect(shouldSendLiveUpdate(state, { ...base, distanceToNextM: 90 }, 1000 + LIVE_MIN_INTERVAL_MS)).toBe(true);
  });
});

describe('buildLiveSnapshot', () => {
  const step: NavInstruction = {
    text: '右轉進入忠孝東路',
    type: 'turn',
    bearing: null,
    relativeDirection: '右側',
    distanceM: 80,
    streetName: null,
    legType: 'WALK',
    polylineIndex: 1,
  };

  it('describes the current step, progress and reroute state', () => {
    const snap = buildLiveSnapshot(
      {
        instructions: [step],
        currentStepIndex: 0,
        distanceToNextM: 40,
        remainingM: 250,
        routeTotalM: 1000,
        estimatedArrivalAt: 123,
        remainingDurationSec: 180,
        rerouteStatus: 'pending',
      },
      stepIcon,
    );
    expect(snap).toEqual({
      icon: 'cornerUpRight',
      instruction: '右轉進入忠孝東路',
      distanceToNextM: 40,
      progress: 0.75,
      estimatedArrivalAt: 123,
      remainingDurationSec: 180,
      rerouting: true,
    });
  });

  it('leaves progress unknown without a route length', () => {
    const snap = buildLiveSnapshot(
      {
        instructions: [],
        currentStepIndex: 0,
        distanceToNextM: null,
        remainingM: null,
        routeTotalM: null,
        estimatedArrivalAt: null,
        remainingDurationSec: null,
        rerouteStatus: 'idle',
      },
      stepIcon,
    );
    expect(snap.progress).toBeNull();
    expect(snap.icon).toBe('arrowUp');
  });
});
