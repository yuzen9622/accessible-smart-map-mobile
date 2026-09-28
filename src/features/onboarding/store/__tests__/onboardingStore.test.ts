import { createMemoryStorage } from '@/shared/storage';

import { DEFAULT_A11Y_PROFILE } from '../../domain/a11yProfile';
import {
  createOnboardingStore,
  needsOnboarding,
  ONBOARDING_STORAGE_KEY,
  type OnboardingStore,
} from '../onboardingStore';

// 使用真正的 store 工廠（與 App 同一份 persist／merge 設定），只把 MMKV 換成記憶體儲存
const buildStore = createOnboardingStore;

describe('needsOnboarding', () => {
  it('未完成也未略過 → true', () => {
    expect(needsOnboarding({ completedAt: null, skipped: false } as OnboardingStore)).toBe(true);
  });

  it('已完成 → false', () => {
    expect(needsOnboarding({ completedAt: '2026-09-28T00:00:00.000Z', skipped: false } as OnboardingStore)).toBe(
      false,
    );
  });

  it('已略過 → false', () => {
    expect(needsOnboarding({ completedAt: null, skipped: true } as OnboardingStore)).toBe(false);
  });
});

describe('setSituations 推導', () => {
  it('勾選輪椅：路線模式與無階梯旗標自動跟著改；取消後放寬', () => {
    const store = buildStore(createMemoryStorage());
    store.getState().toggleSituation('wheelchair');
    expect(store.getState().profile).toMatchObject({
      routeMode: 'wheelchair',
      avoidStairs: true,
      requireElevator: true,
    });
    store.getState().toggleSituation('wheelchair');
    expect(store.getState().profile).toMatchObject({ routeMode: 'normal', avoidStairs: false, requireElevator: false });
  });
});

describe('onboardingStore 持久化', () => {
  it('MMKV 同步儲存：寫入後立即在新 store 實例 hydrate', () => {
    const storage = createMemoryStorage();
    const first = buildStore(storage);
    first.getState().toggleSituation('wheelchair');
    first.getState().completeOnboarding();

    const second = buildStore(storage);
    expect(second.persist.hasHydrated()).toBe(true);
    expect(second.getState().profile.situations).toEqual(['wheelchair']);
    expect(second.getState().completedAt).not.toBeNull();
    expect(needsOnboarding(second.getState())).toBe(false);
  });

  it('merge 時對已存的 profile 套用 sanitizeProfile，濾掉未知 situation', () => {
    const storage = createMemoryStorage({
      [ONBOARDING_STORAGE_KEY]: JSON.stringify({
        state: {
          completedAt: null,
          skipped: false,
          profile: { ...DEFAULT_A11Y_PROFILE, situations: ['wheelchair', 'bogus-situation'] },
        },
        version: 0,
      }),
    });
    const store = buildStore(storage);
    expect(store.getState().profile.situations).toEqual(['wheelchair']);
  });

  it('merge 遇到壞掉（非物件）的儲存資料時退回目前狀態', () => {
    const storage = createMemoryStorage({
      [ONBOARDING_STORAGE_KEY]: JSON.stringify({ state: 'not-an-object', version: 0 }),
    });
    const store = buildStore(storage);
    expect(store.getState().profile).toEqual(DEFAULT_A11Y_PROFILE);
    expect(needsOnboarding(store.getState())).toBe(true);
  });
});
