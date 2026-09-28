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
