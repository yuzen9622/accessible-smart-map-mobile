import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { appStorage, createPersistStorage, type KeyValueStorage } from '@/shared/storage';

import {
  DEFAULT_A11Y_PROFILE,
  deriveRouteMode,
  impliesStepFree,
  sanitizeProfile,
  type A11yProfile,
  type A11ySituation,
} from '../domain/a11yProfile';

/**
 * 版本化的 storage key，對齊 Web `useOnboardingStore.ts`（`onboarding.v1`／
 * `a11yProfile.v1`）。真的需要重新讓所有人再跑一次導覽時，升版號而不是清掉這個
 * key——這樣才不會連同使用者已存的輪廓一起洗掉。MMKV 是同步的，所以本檔用單一
 * zustand `persist` store 一次涵蓋兩個 key 對應的資料，而不是 Web 版兩個各自讀寫
 * localStorage 的 store。
 */
export const ONBOARDING_STORAGE_KEY = 'onboarding.v1';

interface OnboardingState {
  /** null＝尚未完成過（也尚未略過）。 */
  completedAt: string | null;
  skipped: boolean;
  profile: A11yProfile;
}

interface OnboardingActions {
  setSituations: (situations: A11ySituation[]) => void;
  toggleSituation: (situation: A11ySituation) => void;
  completeOnboarding: () => void;
  skipOnboarding: () => void;
}

export type OnboardingStore = OnboardingState & OnboardingActions;

interface PersistedOnboardingState {
  completedAt: string | null;
  skipped: boolean;
  profile: A11yProfile;
}

/** 測試可注入記憶體儲存；App 內一律用下方的 `useOnboardingStore`（MMKV）。 */
export function createOnboardingStore(storage: KeyValueStorage = appStorage) {
  return create<OnboardingStore>()(
  persist(
    (set, get) => ({
      completedAt: null,
      skipped: false,
      profile: DEFAULT_A11Y_PROFILE,

      setSituations: (situations) => {
        const prev = get().profile;
        const next: A11yProfile = {
          ...prev,
          situations,
          routeMode: prev.routeModeAuto ? deriveRouteMode(situations) : prev.routeMode,
          // 兩個方向都要處理：取消勾選最後一個無階梯 situation 也要放寬這兩個旗標，
          // 否則誤觸一次就會永久收窄之後所有路線。
          avoidStairs: prev.stepFreeFlagsAuto ? impliesStepFree(situations) : prev.avoidStairs,
          requireElevator: prev.stepFreeFlagsAuto ? impliesStepFree(situations) : prev.requireElevator,
        };
        set({ profile: next });
      },

      toggleSituation: (situation) => {
        const current = get().profile.situations;
        const next = current.includes(situation)
          ? current.filter((s) => s !== situation)
          : [...current, situation];
        get().setSituations(next);
      },

      completeOnboarding: () => {
        set({ completedAt: new Date().toISOString(), skipped: false });
      },

      skipOnboarding: () => {
        set({ completedAt: new Date().toISOString(), skipped: true });
      },
    }),
    {
      name: ONBOARDING_STORAGE_KEY,
      storage: createPersistStorage<PersistedOnboardingState>(storage),
      partialize: (state) => ({
        completedAt: state.completedAt,
        skipped: state.skipped,
        profile: state.profile,
      }),
      // 對齊 Web `sanitizeProfile` 白名單：後端 Zod schema 是 `.strict()`，壞掉或
      // 降版後留下的輪廓資料一定要在這裡擋掉，不能原樣流進 store。
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') return current;
        const value = persisted as Partial<PersistedOnboardingState>;
        return {
          ...current,
          completedAt: typeof value.completedAt === 'string' ? value.completedAt : null,
          skipped: value.skipped === true,
          profile: sanitizeProfile(value.profile),
        };
      },
    },
  ),
);
}

export const useOnboardingStore = createOnboardingStore();

/**
 * true＝要顯示 onboarding：從沒完成過，也沒略過。MMKV 同步 hydrate，所以這個值
 * 在第一個 render 就是準的，不需要另外等 `hasHydrated`（對齊 `createPersistStorage`
 * 的文件：取代 Web 版 `hydrated` 旗標與其閃爍問題）。
 */
export function needsOnboarding(state: OnboardingStore): boolean {
  return state.completedAt === null && !state.skipped;
}
