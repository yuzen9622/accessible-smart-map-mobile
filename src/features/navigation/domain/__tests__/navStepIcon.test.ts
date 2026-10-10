// 移植自 Web `src/components/Navigation/__tests__/navStepIcon.test.ts`（commit 5eadc71），案例逐一保留；
// 斷言從 Lucide 元件改成對應的圖示名稱。
import type { NavInstruction } from '@/features/route/domain';

import { stepIcon } from '../navStepIcon';

function instruction(overrides: Partial<NavInstruction> = {}): NavInstruction {
  return {
    text: 'step',
    type: 'turn',
    bearing: null,
    relativeDirection: null,
    distanceM: 100,
    streetName: null,
    legType: 'WALK',
    polylineIndex: 0,
    ...overrides,
  };
}

describe('stepIcon — vehicle legs', () => {
  it('uses a car for a driving departure and a bike for a scooter one', () => {
    expect(stepIcon(instruction({ legType: 'DRIVE', type: 'depart' }))).toBe('car');
    expect(
      stepIcon(instruction({ legType: 'MOTORCYCLE', type: 'depart' })),
    ).toBe('bike');
  });

  it('ends a vehicle leg on a parking glyph, not a destination flag', () => {
    expect(stepIcon(instruction({ legType: 'DRIVE', type: 'arrive' }))).toBe('squareParking');
    expect(
      stepIcon(instruction({ legType: 'MOTORCYCLE', type: 'facility' })),
    ).toBe('squareParking');
  });

  it('still shows direction arrows for driving turns', () => {
    expect(
      stepIcon(
        instruction({
          legType: 'DRIVE',
          type: 'turn',
          relativeDirection: '右側',
        }),
      ),
    ).toBe('cornerUpRight');
  });
});

describe('stepIcon — walking and transit legs', () => {
  it('keeps the pedestrian departure, arrival and facility glyphs', () => {
    expect(stepIcon(instruction({ type: 'depart' }))).toBe('navigation');
    expect(stepIcon(instruction({ type: 'arrive' }))).toBe('flag');
    expect(stepIcon(instruction({ type: 'facility' }))).toBe('arrowUpDown');
  });

  it('distinguishes bus from rail boarding', () => {
    expect(
      stepIcon(instruction({ type: 'transit_board', legType: 'BUS' })),
    ).toBe('bus');
    expect(
      stepIcon(instruction({ type: 'transit_alight', legType: 'METRO' })),
    ).toBe('tramFront');
  });

  it('maps relative directions to arrows and defaults to straight ahead', () => {
    expect(stepIcon(instruction({ relativeDirection: '左前方' }))).toBe('arrowUpLeft');
    expect(stepIcon(instruction())).toBe('arrowUp');
    expect(stepIcon(undefined)).toBe('arrowUp');
  });
});

it.each([
  ['ahead', 'arrowUp'], ['ahead-left', 'arrowUpLeft'], ['ahead-right', 'arrowUpRight'],
  ['left', 'cornerUpLeft'], ['right', 'cornerUpRight'], ['behind-left', 'undo2'],
  ['behind-right', 'redo2'], ['behind', 'arrowDown'],
] as const)('maps English direction %s to %s', (relativeDirection, icon) => {
  expect(stepIcon(instruction({ relativeDirection, type: 'turn' }))).toBe(icon);
});

it.each([
  ['Turn right, then continue for about 70 meters', 'cornerUpRight'],
  ['向右轉，續行約 70 公尺', 'cornerUpRight'],
  ['Turn left onto Right Street', 'cornerUpLeft'],
  ['向左轉進入「民族西路」，續行約 1.0 公里', 'cornerUpLeft'],
  ['Turn slightly left onto Main Street', 'arrowUpLeft'],
  ['請稍向左轉，續行約 70 公尺', 'arrowUpLeft'],
  ['Turn slightly right, then immediately follow the next instruction', 'arrowUpRight'],
  ['稍向右轉進入「民族西路」', 'arrowUpRight'],
  ['Turn sharply left onto 興雅路', 'undo2'],
  ['大幅向左轉進入「興雅路」', 'undo2'],
  ['Turn sharply right, then continue for about 100 meters', 'redo2'],
  ['請大幅向右轉，續行約 100 公尺', 'redo2'],
  ['Make a U-turn, then continue for about 20 meters', 'arrowDown'],
  ['請迴轉，續行約 20 公尺', 'arrowDown'],
  ['Continue straight toward Turn right Street', 'arrowUp'],
  ['沿「向右轉街」繼續直行', 'arrowUp'],
] as const)('uses the maneuver when heading is unavailable: %s', (text, icon) => {
  expect(stepIcon(instruction({ text }))).toBe(icon);
});

it('prefers the text-derived arrow over relativeDirection when they disagree — text is what the voice speaks verbatim', () => {
  expect(stepIcon(instruction({ text: 'Turn right', relativeDirection: 'ahead-right' }))).toBe('cornerUpRight');
});

it('falls back to relativeDirection when the text does not match a known maneuver prefix', () => {
  expect(stepIcon(instruction({ text: 'Continue onto Main St', relativeDirection: 'ahead-right' }))).toBe('arrowUpRight');
});
