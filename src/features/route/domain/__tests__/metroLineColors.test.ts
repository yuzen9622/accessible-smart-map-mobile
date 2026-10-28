import { Colors, contrastRatio, METRO_LINE_FILL } from '@/shared/theme';
import en from '@/shared/i18n/locale/en/translation.json';

import { metroLineColors } from '../metroLineColors';
import { LEG_LABEL_FILL, getLegColor, legBadgeColors, legEdgeColor, legRailIconColors } from '../routeDisplay';
import type { BusLeg, MetroLeg, RouteLeg } from '../../types/route';

const EXPECTED: Record<string, { fill: string; fg: string }> = {
  TRTC_BR: { fill: '#C48C31', fg: '#1A1A1A' },
  TRTC_R: { fill: '#E3002C', fg: '#FFFFFF' },
  TRTC_G: { fill: '#008659', fg: '#FFFFFF' },
  TRTC_O: { fill: '#F8B61C', fg: '#1A1A1A' },
  TRTC_BL: { fill: '#0070BD', fg: '#FFFFFF' },
  'TRTC_R_R-3': { fill: '#FD92A3', fg: '#1A1A1A' },
  'TRTC_G_G-3': { fill: '#CFDB00', fg: '#1A1A1A' },
  TRTCMG_MK: { fill: '#00AFE2', fg: '#1A1A1A' },
  NTMC_Y: { fill: '#FFDB00', fg: '#1A1A1A' },
  NTMC_LB: { fill: '#79BCE8', fg: '#1A1A1A' },
  NTDLRT_V: { fill: '#E5554F', fg: '#1A1A1A' },
  'NTDLRT_V_V-1': { fill: '#E5554F', fg: '#1A1A1A' },
  'NTDLRT_V_V-2': { fill: '#E5554F', fg: '#1A1A1A' },
  NTALRT_K: { fill: '#C3B091', fg: '#1A1A1A' },
};

// 每個主題變體的卡片／sheet 表面，加上淺色、深色地圖底。新增主題表面時要一起列進來。
const SURFACES = [
  ...Object.values(Colors).flatMap((c) => [c.background, c.backgroundElement, c.backgroundElevated]),
  '#FFFFFF',
  '#121212',
];

const metro = (lineKey?: string) => ({ type: 'METRO', ...(lineKey ? { lineKey } : {}) }) as MetroLeg;

describe('metro line colours', () => {
  it.each(Object.entries(EXPECTED))('%s → %o', (lineKey, expected) => {
    expect(metroLineColors('METRO', lineKey)).toEqual(expected);
    expect(getLegColor(metro(lineKey))).toBe(expected.fill);
    expect(legBadgeColors('METRO', lineKey)).toEqual(expected);
    expect(legRailIconColors(metro(lineKey))).toEqual(expected);
    expect(legEdgeColor(metro(lineKey))).toBe(expected.fg);
  });

  it('lists exactly the expected lines, all of them translated', () => {
    expect(Object.keys(METRO_LINE_FILL)).toEqual(Object.keys(EXPECTED));
    for (const key of Object.keys(METRO_LINE_FILL)) expect(en.metroLines).toHaveProperty([key]);
  });

  it.each([
    ['an unknown line', metro('KRTC_R')],
    ['a leg without a lineKey', metro()],
    ['a non-metro leg carrying a lineKey', { type: 'BUS', lineKey: 'TRTC_BL' } as unknown as BusLeg],
  ] as [string, RouteLeg][])('keeps today\'s colours for %s', (_, leg) => {
    const lineKey = (leg as { lineKey?: string }).lineKey;
    expect(metroLineColors(leg.type, lineKey)).toBeNull();
    expect(legEdgeColor(leg)).toBeUndefined();
    expect(legBadgeColors(leg.type, lineKey)).toEqual({ fill: LEG_LABEL_FILL[leg.type], fg: '#FFFFFF' });
    expect(legRailIconColors(leg)).toEqual({ fill: getLegColor(leg), fg: '#FFFFFF' });
  });

  it.each(Object.entries(EXPECTED))('%s badge text reaches 4.5:1', (_, c) => {
    expect(contrastRatio(c.fill, c.fg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(EXPECTED))('%s line or its outline reaches 3:1 on every surface', (_, c) => {
    for (const surface of SURFACES) {
      const visible = contrastRatio(c.fill, surface) >= 3 || (contrastRatio(c.fg, surface) >= 3 && contrastRatio(c.fill, c.fg) >= 3);
      expect({ surface, visible }).toEqual({ surface, visible: true });
    }
  });
});
