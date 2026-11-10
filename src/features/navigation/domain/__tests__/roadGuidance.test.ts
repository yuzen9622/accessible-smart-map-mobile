import type { NavInstruction, RoadLane, RouteLeg } from '@/features/route/domain';

import { laneIcon } from '../navStepIcon';
import {
  laneAccessibilityParts,
  legProgressAt,
  selectLaneGuidance,
  selectSpeedLimit,
  speedLimitCueValue,
} from '../roadGuidance';

const polyline = Array.from({ length: 114 }, (_, i): [number, number] => [121.5 + i * 0.0001, 25.05]);

/** 本機 Valhalla 台北實測樣本的分段：[[0,72,unknown],[72,83,known 50],[83,88,unknown],[88,113,known 50]]。 */
function driveLeg(overrides: Partial<Extract<RouteLeg, { type: 'DRIVE' | 'MOTORCYCLE' }>> = {}): RouteLeg {
  return {
    type: 'DRIVE',
    from: 'A',
    to: 'B',
    distanceM: 1000,
    durationMin: 3,
    polyline,
    speedLimits: {
      status: 'available',
      direction: 'along_leg',
      segments: [
        { fromIndex: 0, toIndex: 72, kind: 'unknown', limitKph: null, source: null },
        { fromIndex: 72, toIndex: 83, kind: 'known', limitKph: 50, source: 'valhalla' },
        { fromIndex: 83, toIndex: 88, kind: 'unknown', limitKph: null, source: null },
        { fromIndex: 88, toIndex: 113, kind: 'known', limitKph: 50, source: 'valhalla' },
      ],
    },
    ...overrides,
  };
}

const walkLeg = { type: 'WALK', from: 'B', to: 'C', distanceM: 50, minutesEst: 1, polyline: polyline.slice(0, 3), a11yFacilities: [] } as unknown as RouteLeg;

describe('legProgressAt', () => {
  const path = { legRanges: [{ start: 0, count: 114 }, { start: 114, count: 3 }] };

  it('maps a concatenated segment to the leg-local segment', () => {
    expect(legProgressAt(path, 0)).toEqual({ legIndex: 0, segmentIndex: 0 });
    expect(legProgressAt(path, 112)).toEqual({ legIndex: 0, segmentIndex: 112 });
    expect(legProgressAt(path, 115)).toEqual({ legIndex: 1, segmentIndex: 1 });
  });

  it('does not claim a leg on the seam between two legs, or out of bounds', () => {
    expect(legProgressAt(path, 113)).toBeNull();
    expect(legProgressAt(path, 116)).toBeNull();
    expect(legProgressAt(path, -1)).toBeNull();
    expect(legProgressAt(path, Number.NaN)).toBeNull();
  });
});

describe('selectSpeedLimit', () => {
  const legs = [driveLeg(), walkLeg];
  const at = (segmentIndex: number, legIndex = 0) => selectSpeedLimit(legs, { legIndex, segmentIndex });

  it('uses half-open ranges: exactly on vertex 72 is the next segment', () => {
    expect(at(71)).toEqual({ kind: 'unknown', limitKph: null });
    expect(at(72)).toEqual({ kind: 'known', limitKph: 50 });
    expect(at(82)).toEqual({ kind: 'known', limitKph: 50 });
    expect(at(83)).toEqual({ kind: 'unknown', limitKph: null });
    expect(at(88)).toEqual({ kind: 'known', limitKph: 50 });
    expect(at(112)).toEqual({ kind: 'known', limitKph: 50 });
  });

  it('never carries the previous known value into an unknown segment', () => {
    expect(at(85)).toEqual({ kind: 'unknown', limitKph: null });
  });

  it('reports unknown past the covered segments, and nothing without progress or off a vehicle leg', () => {
    expect(at(500)).toEqual({ kind: 'unknown', limitKph: null });
    expect(selectSpeedLimit(legs, null)).toBeNull();
    expect(at(1, 1)).toBeNull();
    expect(at(0, 9)).toBeNull();
  });

  it('shows "unlimited" as its own kind, never as 0 or a number', () => {
    const leg = driveLeg({
      speedLimits: { status: 'available', direction: 'along_leg', segments: [{ fromIndex: 0, toIndex: 113, kind: 'unlimited', limitKph: null, source: 'valhalla' }] },
    });
    expect(selectSpeedLimit([leg], { legIndex: 0, segmentIndex: 3 })).toEqual({ kind: 'unlimited', limitKph: null });
  });

  it('treats a missing or unavailable speedLimits as unknown on a vehicle leg', () => {
    expect(selectSpeedLimit([driveLeg({ speedLimits: undefined })], { legIndex: 0, segmentIndex: 80 })).toEqual({ kind: 'unknown', limitKph: null });
    const unavailable = driveLeg({ speedLimits: { status: 'unavailable', direction: 'along_leg', segments: [], reason: 'upstream_error' } });
    expect(selectSpeedLimit([unavailable], { legIndex: 0, segmentIndex: 80 })).toEqual({ kind: 'unknown', limitKph: null });
  });
});

const LANES: RoadLane[] = [
  { directions: ['straight'], recommendation: 'not_recommended', maneuverDirection: null },
  { directions: ['straight'], recommendation: 'not_recommended', maneuverDirection: null },
  { directions: ['right'], recommendation: 'usable', maneuverDirection: 'right' },
  { directions: ['right'], recommendation: 'preferred', maneuverDirection: 'right' },
];

function driveStep(overrides: Partial<NavInstruction> = {}): NavInstruction {
  return {
    text: '向右轉進入「民生東路」，請靠右側兩個車道',
    type: 'turn',
    bearing: null,
    relativeDirection: null,
    distanceM: 344,
    streetName: '民生東路',
    legType: 'DRIVE',
    legIndex: 0,
    polylineIndex: 88,
    roadGuidance: {
      maneuverIndex: 3,
      maneuver: 'right',
      endPolylineIndex: 100,
      streetNames: ['民生東路'],
      lanes: LANES,
      laneApproachRange: { fromIndex: 60, toIndex: 88 },
      laneHint: '靠右側兩個車道',
    },
    ...overrides,
  };
}

describe('selectLaneGuidance', () => {
  const instructions = [driveStep({ type: 'depart', polylineIndex: 0, roadGuidance: undefined }), driveStep()];

  it('shows lanes only inside the approach range of the current step, and clears once past the turn', () => {
    expect(selectLaneGuidance(instructions, 1, { legIndex: 0, segmentIndex: 59 })).toBeNull();
    expect(selectLaneGuidance(instructions, 1, { legIndex: 0, segmentIndex: 60 })).toEqual({ stepIndex: 1, lanes: LANES });
    expect(selectLaneGuidance(instructions, 1, { legIndex: 0, segmentIndex: 87 })).toEqual({ stepIndex: 1, lanes: LANES });
    expect(selectLaneGuidance(instructions, 1, { legIndex: 0, segmentIndex: 88 })).toBeNull();
  });

  it('draws nothing without lanes, range, progress or on another leg', () => {
    expect(selectLaneGuidance(instructions, 0, { legIndex: 0, segmentIndex: 70 })).toBeNull();
    expect(selectLaneGuidance(instructions, 1, null)).toBeNull();
    expect(selectLaneGuidance(instructions, 1, { legIndex: 1, segmentIndex: 70 })).toBeNull();
    const noRange = [driveStep({ roadGuidance: { ...driveStep().roadGuidance!, laneApproachRange: undefined } })];
    expect(selectLaneGuidance(noRange, 0, { legIndex: 0, segmentIndex: 70 })).toBeNull();
    const noLanes = [driveStep({ roadGuidance: { ...driveStep().roadGuidance!, lanes: [] } })];
    expect(selectLaneGuidance(noLanes, 0, { legIndex: 0, segmentIndex: 70 })).toBeNull();
  });

  it('summarises lanes left to right for screen readers and keeps the turn arrow on recommended lanes', () => {
    expect(laneAccessibilityParts(LANES)).toEqual({ count: 4, preferred: [4], usable: [3] });
    expect(LANES.map(laneIcon)).toEqual(['arrowUp', 'arrowUp', 'cornerUpRight', 'cornerUpRight']);
    expect(laneIcon({ directions: ['none'], recommendation: 'not_recommended', maneuverDirection: null })).toBeNull();
    expect(laneIcon({ directions: ['straight', 'left'], recommendation: 'preferred', maneuverDirection: 'left' })).toBe('cornerUpLeft');
  });
});

describe('speedLimitCueValue', () => {
  it('cues only when the known limit changes to another known number', () => {
    expect(speedLimitCueValue(null, { kind: 'known', limitKph: 50 })).toBeNull();
    expect(speedLimitCueValue(50, { kind: 'known', limitKph: 50 })).toBeNull();
    expect(speedLimitCueValue(50, { kind: 'unknown', limitKph: null })).toBeNull();
    expect(speedLimitCueValue(50, { kind: 'unlimited', limitKph: null })).toBeNull();
    expect(speedLimitCueValue(50, null)).toBeNull();
    expect(speedLimitCueValue(50, { kind: 'known', limitKph: 40 })).toBe(40);
  });
});
