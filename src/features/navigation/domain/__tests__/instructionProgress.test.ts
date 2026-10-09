import type { NavInstruction } from '@/features/route/domain';
import { instructionProgress } from '../instructionProgress';
const step = (distance: number): NavInstruction => ({ cumulativeDistanceM: distance, distanceM: 0, text: '', type: 'turn', bearing: null, relativeDirection: null, streetName: null, legType: 'WALK', legIndex: 1, polylineIndex: 0 });
it('uses cumulative distance across legs, interpolating between geometric maneuver positions', () => {
  const steps = [step(0), step(300), step(700)];
  expect(instructionProgress(steps, 1)).toEqual({ totalM: 700, remainingM: 400 });
  expect(instructionProgress(steps, 2, { alongM: 75, waypoints: [{ coord: null, alongM: 0 }, { coord: null, alongM: 50 }, { coord: null, alongM: 100 }] })).toEqual({ totalM: 700, remainingM: 200 });
});
it('falls back for legacy, missing, or decreasing distances', () => {
  expect(instructionProgress([{ ...step(0), cumulativeDistanceM: undefined }], 0)).toBeNull();
  expect(instructionProgress([step(40), step(20)], 0)).toBeNull();
});
