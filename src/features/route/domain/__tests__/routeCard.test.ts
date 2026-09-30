// 移植自 Web `src/components/shared/__tests__/RouteCard.test.ts`（純 helper 部分）與
// `WalkStepsList.test.tsx`（步驟文字部分），commit 5eadc71。Web 的 renderToStaticMarkup 元件測試
// 依賴 DOM 字串，原生不適用；步驟文字改測 `walkStepText` 本身（元件只負責排版）。
import i18n from '@/shared/i18n';

import {
  dedupeA11yCategories,
  effectiveAccessibilityScore,
  getConfidenceLabelKey,
  getRouteAlertsCount,
  gradeSlope,
  gradeUnconfirmedCrossings,
  gradeWidth,
  routeFacts,
  routeSummary,
  shouldAppendExitNumber,
  walkA11yMetrics,
  walkStepText,
  type Translate,
} from '../routeCard';
import type { AccessibleRoute, BusLeg, MetroLeg, SlimOsmA11y, WalkLeg, WalkRelativeDirection, WalkStep } from '../../types/route';

function buildRoute(): AccessibleRoute {
  return {
    routeId: 'r1',
    routeName: '測試路線',
    totalMinutes: 30,
    transferCount: 2,
    accessibilityHighlights: ['低地板公車'],
    accessibilityScore: 82,
    accessibilityLabel: 'excellent',
    legs: [
      {
        type: 'WALK',
        from: '起點',
        to: '市府站',
        distanceM: 320,
        minutesEst: 5,
        polyline: [
          [121.5, 25.03],
          [121.51, 25.031],
        ],
        a11yFacilities: [],
      },
      {
        type: 'BUS',
        routeName: '信義幹線',
        departureStop: '市府站',
        arrivalStop: '永春站',
        waitInfo: { time: null, source: 'unavailable' },
        estimatedWaitMinutes: 5,
        direction: 0,
        polyline: [
          [121.5, 25.03],
          [121.52, 25.04],
        ],
        departureStopA11y: [],
        arrivalStopA11y: [],
      },
      {
        type: 'METRO',
        railSystem: 'TRTC',
        lineId: 'BL',
        lineName: '板南線',
        lineUid: 'BL01',
        departureStation: '永春站',
        arrivalStation: '市政府站',
        departureStationUid: 'BL01',
        arrivalStationUid: 'BL02',
        direction: 0,
        stopsCount: 2,
        rideMinutes: 4,
        waitInfo: { time: null, source: 'unavailable' },
        estimatedWaitMinutes: 3,
        polyline: [
          [121.52, 25.04],
          [121.53, 25.041],
        ],
        departureStationA11y: [],
        arrivalStationA11y: [],
        facilityHighlights: [],
      },
    ],
  };
}

describe('shouldAppendExitNumber', () => {
  it('suppresses when the exit name already spells out the number', () => {
    expect(shouldAppendExitNumber('2號出口', '2')).toBe(false);
    expect(shouldAppendExitNumber('出口 2', '2')).toBe(false);
  });

  it('appends when the exit name has no number', () => {
    expect(shouldAppendExitNumber('市政府站', '2')).toBe(true);
  });

  it('does not false-suppress on a numeric coincidence inside a larger number', () => {
    expect(shouldAppendExitNumber('12號出口', '2')).toBe(true);
  });

  it('returns false when there is no exit number', () => {
    expect(shouldAppendExitNumber('市政府站', undefined)).toBe(false);
    expect(shouldAppendExitNumber('市政府站', '')).toBe(false);
  });

  it('returns true when there is no exit name to check against', () => {
    expect(shouldAppendExitNumber(undefined, '2')).toBe(true);
  });
});

describe('getConfidenceLabelKey', () => {
  it('maps each known confidence level to its i18n key', () => {
    expect(getConfidenceLabelKey('high')).toBe('confidenceHigh');
    expect(getConfidenceLabelKey('medium')).toBe('confidenceMedium');
    expect(getConfidenceLabelKey('low')).toBe('confidenceLow');
  });

  it('returns null when confidence is absent', () => {
    expect(getConfidenceLabelKey(undefined)).toBeNull();
  });
});

describe('dedupeA11yCategories', () => {
  it('returns an empty array for undefined/empty input', () => {
    expect(dedupeA11yCategories(undefined)).toEqual([]);
    expect(dedupeA11yCategories([])).toEqual([]);
  });

  it('collapses duplicate categories, preserving first-seen order', () => {
    const point = { type: 'Point', coordinates: [0, 0] } as const;
    const items: SlimOsmA11y[] = [
      { osmId: '1', category: 'elevator', location: { ...point, coordinates: [0, 0] } },
      { osmId: '2', category: 'toilet', location: { ...point, coordinates: [0, 0] } },
      { osmId: '3', category: 'elevator', location: { ...point, coordinates: [0, 0] } },
    ];
    expect(dedupeA11yCategories(items)).toEqual(['elevator', 'toilet']);
  });
});

describe('getRouteAlertsCount', () => {
  it('returns 0 for routes with no alerts', () => {
    expect(getRouteAlertsCount(buildRoute())).toBe(0);
  });

  it('counts distinct alerts across legs and top-level transitAlerts', () => {
    const route = buildRoute();
    route.legs[1] = {
      ...(route.legs[1] as BusLeg),
      alerts: [{ alertId: 'BUS-1', title: '公車改道', description: '施工不停靠', status: 'active', matchKind: 'route' }],
    };
    route.legs[2] = {
      ...(route.legs[2] as MetroLeg),
      alerts: [
        {
          alertId: 'METRO-1',
          title: '電梯維修',
          description: '板橋站電梯維修',
          status: 2,
          stations: [{ id: 'BL07', name: '板橋站' }],
          lines: ['BL'],
          publishTime: '',
          updateTime: '',
        },
      ],
    };
    expect(getRouteAlertsCount(route)).toBe(2);
  });

  it('deduplicates alerts with the same alertId', () => {
    const route = buildRoute();
    route.legs[1] = {
      ...(route.legs[1] as BusLeg),
      alerts: [{ alertId: 'ALERT-SHARED', title: '豪雨特報', description: '減速行駛', status: 2, matchKind: 'route' }],
    };
    route.legs[2] = {
      ...(route.legs[2] as MetroLeg),
      alerts: [
        {
          alertId: 'ALERT-SHARED',
          title: '豪雨特報',
          description: '減速行駛',
          status: 2,
          stations: [],
          lines: [],
          publishTime: '',
          updateTime: '',
        },
      ],
    };
    expect(getRouteAlertsCount(route)).toBe(1);
  });
});

describe('effectiveAccessibilityScore', () => {
  it('prefers the numeric score, falls back to the label, else null', () => {
    const route = buildRoute();
    expect(effectiveAccessibilityScore(route)).toBe(82);
    expect(effectiveAccessibilityScore({ ...route, accessibilityScore: undefined, accessibilityLabel: 'poor' })).toBe(30);
    expect(effectiveAccessibilityScore({ ...route, accessibilityScore: undefined, accessibilityLabel: undefined })).toBeNull();
  });
});

describe('routeSummary', () => {
  it('joins the non-walk leg names with arrows', async () => {
    await i18n.changeLanguage('zh-TW');
    expect(routeSummary(buildRoute().legs, i18n.t.bind(i18n) as Translate)).toBe('信義幹線 → 板南線');
  });
});

// --- walkStepText（Web WalkStepsList.test.tsx） ---

const WALK_RELATIVE_DIRECTIONS = [
  'DEPART',
  'CONTINUE',
  'STRAIGHT',
  'LEFT',
  'RIGHT',
  'SLIGHTLY_LEFT',
  'SLIGHTLY_RIGHT',
  'HARD_LEFT',
  'HARD_RIGHT',
  'UTURN_LEFT',
  'UTURN_RIGHT',
  'CIRCLE_CLOCKWISE',
  'CIRCLE_COUNTERCLOCKWISE',
  'ELEVATOR',
  'ESCALATOR',
  'MOVING_WALKWAY',
  'FARE_GATE',
  'ENTER_STATION',
  'EXIT_STATION',
] as const satisfies readonly WalkRelativeDirection[];

const EXPECTED_ACTIONS = {
  en: {
    DEPART: 'Depart',
    CONTINUE: 'Continue straight',
    STRAIGHT: 'Go straight',
    LEFT: 'Turn left',
    RIGHT: 'Turn right',
    SLIGHTLY_LEFT: 'Bear left',
    SLIGHTLY_RIGHT: 'Bear right',
    HARD_LEFT: 'Sharp left',
    HARD_RIGHT: 'Sharp right',
    UTURN_LEFT: 'Make a U-turn to the left',
    UTURN_RIGHT: 'Make a U-turn to the right',
    CIRCLE_CLOCKWISE: 'Enter the roundabout clockwise',
    CIRCLE_COUNTERCLOCKWISE: 'Enter the roundabout counterclockwise',
    ELEVATOR: 'Take the elevator',
    ESCALATOR: 'Take the escalator',
    MOVING_WALKWAY: 'Use the moving walkway',
    FARE_GATE: 'Pass the fare gate',
    ENTER_STATION: 'Enter the station',
    EXIT_STATION: 'Leave the station',
  },
  'zh-TW': {
    DEPART: '出發',
    CONTINUE: '直行',
    STRAIGHT: '直行',
    LEFT: '左轉',
    RIGHT: '右轉',
    SLIGHTLY_LEFT: '稍向左',
    SLIGHTLY_RIGHT: '稍向右',
    HARD_LEFT: '大幅左轉',
    HARD_RIGHT: '大幅右轉',
    UTURN_LEFT: '向左迴轉',
    UTURN_RIGHT: '向右迴轉',
    CIRCLE_CLOCKWISE: '進入圓環並順時針行駛',
    CIRCLE_COUNTERCLOCKWISE: '進入圓環並逆時針行駛',
    ELEVATOR: '搭乘電梯',
    ESCALATOR: '搭乘電扶梯',
    MOVING_WALKWAY: '使用電動步道',
    FARE_GATE: '通過付費閘門',
    ENTER_STATION: '進入車站',
    EXIT_STATION: '離開車站',
  },
} satisfies Record<'en' | 'zh-TW', Record<WalkRelativeDirection, string>>;

function makeStep(relativeDirection: WalkRelativeDirection, overrides: Partial<WalkStep> = {}): WalkStep {
  return {
    relativeDirection,
    absoluteDirection: null,
    streetName: '',
    bogusName: true,
    area: false,
    stairs: false,
    steepSlope: false,
    distanceM: 42,
    location: [121.5, 25.03],
    ...overrides,
  };
}

function translator(locale: 'en' | 'zh-TW'): Translate {
  return i18n.getFixedT(locale) as Translate;
}

describe('walkStepText', () => {
  it.each(['en', 'zh-TW'] as const)('translates all 19 relative-direction tokens in %s without raw tokens', (locale) => {
    const t = translator(locale);
    for (const direction of WALK_RELATIVE_DIRECTIONS) {
      const text = walkStepText(makeStep(direction), t);
      expect(text).toContain(EXPECTED_ACTIONS[locale][direction]);
      expect(text).not.toContain(direction);
    }
  });

  it('renders STRAIGHT with its street and MOVING_WALKWAY without one', () => {
    const t = translator('en');
    expect(walkStepText(makeStep('STRAIGHT', { streetName: 'Main Street', bogusName: false }), t)).toContain(
      'Go straight on Main Street',
    );
    const walkway = walkStepText(makeStep('MOVING_WALKWAY', { streetName: 'Terminal Concourse', bogusName: false }), t);
    expect(walkway).toContain('Use the moving walkway');
    expect(walkway).not.toContain('Terminal Concourse');
  });

  it('omits bogus and empty street names', () => {
    const t = translator('en');
    const bogus = walkStepText(makeStep('CONTINUE', { streetName: 'Unnamed road', bogusName: true }), t);
    expect(bogus).toContain('Continue straight');
    expect(bogus).not.toContain('Unnamed road');
    expect(walkStepText(makeStep('LEFT', { streetName: '', bogusName: false }), t)).toContain('Turn left');
  });

  it('translates an absolute direction, suppresses null, and uses "onto" for area steps', () => {
    const t = translator('en');
    expect(walkStepText(makeStep('DEPART', { absoluteDirection: 'NORTH', streetName: 'North Road', bogusName: false }), t)).toBe(
      'Depart on North Road · North',
    );
    const area = walkStepText(makeStep('RIGHT', { streetName: 'Town Square', bogusName: false, area: true }), t);
    expect(area).toContain('Turn right onto Town Square');
    expect(area).not.toContain('null');
  });
});

describe('walk a11y grading (Web WalkA11ySummary)', () => {
  it('grades slope, width and unconfirmed crossings at the regulation thresholds', () => {
    expect([gradeSlope(5), gradeSlope(8.33), gradeSlope(8.34)]).toEqual(['good', 'caution', 'bad']);
    expect([gradeWidth(150), gradeWidth(90), gradeWidth(89)]).toEqual(['good', 'caution', 'bad']);
    expect([gradeUnconfirmedCrossings(0), gradeUnconfirmedCrossings(2), gradeUnconfirmedCrossings(3)]).toEqual([
      'good',
      'caution',
      'bad',
    ]);
  });

  it('orders the legend with blockers first and drops implausible DEM slopes', () => {
    const leg = buildRoute().legs[0] as WalkLeg;
    const metrics = walkA11yMetrics({
      ...leg,
      maxSlopePercent: 1033.8,
      crossings: 3,
      crossingsWithCurbRamp: 1,
      a11ySegments: [
        { feature: 'elevator', startIndex: 0, endIndex: 0, indoor: true, distanceM: null, maxSlopePercent: null, minWidthCm: null },
        { feature: 'stairs', startIndex: 0, endIndex: 1, indoor: false, distanceM: 5, maxSlopePercent: null, minWidthCm: null },
      ],
    });
    expect(metrics).toEqual({ legend: ['stairs', 'elevator'], slope: null, width: null, unconfirmedCrossings: 2, crossings: 3 });
  });

  it('returns null when the leg carries no accessibility data', () => {
    expect(walkA11yMetrics(buildRoute().legs[0] as WalkLeg)).toBeNull();
  });
});

describe('routeFacts', () => {
  it('counts stairs, elevators and max slope from walk legs', () => {
    const walk = (overrides: Partial<WalkLeg>): WalkLeg => ({
      type: 'WALK',
      from: 'a',
      to: 'b',
      distanceM: 100,
      minutesEst: 2,
      polyline: [],
      a11yFacilities: [],
      ...overrides,
    });
    const route: AccessibleRoute = {
      ...buildRoute(),
      legs: [
        walk({
          maxSlopePercent: 4,
          a11ySegments: [
            { feature: 'elevator', startIndex: 0, endIndex: 0, indoor: true, distanceM: null, maxSlopePercent: null, minWidthCm: null },
            { feature: 'stairs', startIndex: 1, endIndex: 2, indoor: false, distanceM: 5, maxSlopePercent: null, minWidthCm: null },
          ],
        }),
        walk({ maxSlopePercent: 6, a11ySegments: [] }),
      ],
    };
    expect(routeFacts(route)).toEqual({ stairs: 1, maxSlopePercent: 6, elevators: 1 });
  });

  it('reports unknown stairs when the backend gave no detail', () => {
    const route: AccessibleRoute = { ...buildRoute(), legs: [] };
    expect(routeFacts(route).stairs).toBeNull();
  });
});
