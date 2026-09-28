import {
  DEFAULT_A11Y_PROFILE,
  defaultFacilityCategories,
  deriveRouteMode,
  impliesStepFree,
  sanitizeProfile,
  type A11yProfile,
} from '../a11yProfile';

describe('deriveRouteMode', () => {
  it('輪椅單選 → wheelchair', () => {
    expect(deriveRouteMode(['wheelchair'])).toBe('wheelchair');
  });

  it('輪椅＋視障 → wheelchair（無階梯需求優先於視覺）', () => {
    expect(deriveRouteMode(['wheelchair', 'vision'])).toBe('wheelchair');
  });

  it('助行器＋視障 → wheelchair', () => {
    expect(deriveRouteMode(['walker', 'vision'])).toBe('wheelchair');
  });

  it('推嬰兒車 → wheelchair（無階梯需求）', () => {
    expect(deriveRouteMode(['stroller'])).toBe('wheelchair');
  });

  it('視障＋行動較慢 → visual_impaired（視覺優先於步速）', () => {
    expect(deriveRouteMode(['vision', 'slow'])).toBe('visual_impaired');
  });

  it('單純行動較慢 → elderly', () => {
    expect(deriveRouteMode(['slow'])).toBe('elderly');
  });

  it('陪同他人（不影響物理限制）→ normal', () => {
    expect(deriveRouteMode(['companion'])).toBe('normal');
  });

  it('沒有任何選項 → normal', () => {
    expect(deriveRouteMode([])).toBe('normal');
  });
});

describe('impliesStepFree', () => {
  it('輪椅／助行器／嬰兒車代表無階梯需求', () => {
    expect(impliesStepFree(['wheelchair'])).toBe(true);
    expect(impliesStepFree(['walker'])).toBe(true);
    expect(impliesStepFree(['stroller'])).toBe(true);
  });

  it('視障／行動較慢／陪同不代表無階梯需求', () => {
    expect(impliesStepFree(['vision', 'slow', 'companion'])).toBe(false);
  });

  it('空陣列不代表無階梯需求', () => {
    expect(impliesStepFree([])).toBe(false);
  });
});

describe('defaultFacilityCategories', () => {
  it('沒有選任何情況時回傳三種類別（首次進地圖看得到東西）', () => {
    expect(defaultFacilityCategories([])).toEqual(
      expect.arrayContaining(['elevator', 'ramp', 'toilet']),
    );
    expect(defaultFacilityCategories([])).toHaveLength(3);
  });

  it('輪椅：電梯、坡道（無階梯）＋廁所', () => {
    const categories = defaultFacilityCategories(['wheelchair']);
    expect(new Set(categories)).toEqual(new Set(['elevator', 'ramp', 'toilet']));
  });

  it('助行器：只有電梯、坡道（不含廁所，助行器不在 wheelchair/slow 名單）', () => {
    const categories = defaultFacilityCategories(['walker']);
    expect(new Set(categories)).toEqual(new Set(['elevator', 'ramp']));
  });

  it('視障：電梯、廁所（不含坡道）', () => {
    const categories = defaultFacilityCategories(['vision']);
    expect(new Set(categories)).toEqual(new Set(['elevator', 'toilet']));
  });

  it('陪同：電梯、廁所', () => {
    const categories = defaultFacilityCategories(['companion']);
    expect(new Set(categories)).toEqual(new Set(['elevator', 'toilet']));
  });
});

describe('sanitizeProfile', () => {
  it('非物件輸入回傳預設輪廓', () => {
    expect(sanitizeProfile(null)).toEqual(DEFAULT_A11Y_PROFILE);
    expect(sanitizeProfile(undefined)).toEqual(DEFAULT_A11Y_PROFILE);
    expect(sanitizeProfile('a string')).toEqual(DEFAULT_A11Y_PROFILE);
    expect(sanitizeProfile(42)).toEqual(DEFAULT_A11Y_PROFILE);
  });

  it('丟棄未知 situation，保留已知的', () => {
    const result = sanitizeProfile({
      situations: ['wheelchair', 'not-a-real-situation', 'vision'],
    });
    expect(result.situations).toEqual(['wheelchair', 'vision']);
  });

  it('situations 不是陣列時視為空', () => {
    const result = sanitizeProfile({ situations: 'wheelchair' });
    expect(result.situations).toEqual([]);
  });

  it('丟棄未知 routeMode，auto 模式改用推導值', () => {
    const result = sanitizeProfile({
      situations: ['wheelchair'],
      routeMode: 'not-a-real-mode',
      routeModeAuto: true,
    });
    expect(result.routeMode).toBe('wheelchair');
  });

  it('routeModeAuto=false 且 routeMode 合法時保留手動選擇，即使與推導結果不同', () => {
    const result = sanitizeProfile({
      situations: ['vision'],
      routeMode: 'wheelchair',
      routeModeAuto: false,
    });
    expect(result.routeMode).toBe('wheelchair');
    expect(result.routeModeAuto).toBe(false);
  });

  it('routeModeAuto=false 但 routeMode 是未知字串時退回推導值', () => {
    const result = sanitizeProfile({
      situations: ['vision'],
      routeMode: 'bogus',
      routeModeAuto: false,
    });
    expect(result.routeMode).toBe('visual_impaired');
  });

  it('stepFreeFlagsAuto 為 true（預設）時，旗標跟隨 situations 而非儲存值', () => {
    const result = sanitizeProfile({
      situations: ['wheelchair'],
      avoidStairs: false,
      requireElevator: false,
    });
    expect(result.avoidStairs).toBe(true);
    expect(result.requireElevator).toBe(true);
    expect(result.stepFreeFlagsAuto).toBe(true);
  });

  it('stepFreeFlagsAuto=false 時保留手動旗標，即使與 situations 不一致', () => {
    const result = sanitizeProfile({
      situations: [],
      avoidStairs: true,
      requireElevator: true,
      stepFreeFlagsAuto: false,
    });
    expect(result.avoidStairs).toBe(true);
    expect(result.requireElevator).toBe(true);
  });

  it('旗標不是 boolean 時視為 false（stepFreeFlagsAuto=false 分支）', () => {
    const result = sanitizeProfile({
      situations: [],
      avoidStairs: 'yes',
      stepFreeFlagsAuto: false,
    });
    expect(result.avoidStairs).toBe(false);
    expect(result.requireElevator).toBe(false);
  });

  it('完整合法輸入原樣通過（除了 auto 欄位重新推導的部分）', () => {
    const input: A11yProfile = {
      situations: ['slow'],
      routeMode: 'elderly',
      routeModeAuto: true,
      avoidStairs: false,
      requireElevator: false,
      stepFreeFlagsAuto: true,
    };
    expect(sanitizeProfile(input)).toEqual(input);
  });
});
