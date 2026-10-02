import { useEffect } from 'react';

import { pickUserConfig, selectIsLoggedIn, useAuthStore } from '@/features/auth';
import { useOnboardingStore } from '@/features/onboarding';
import { logger } from '@/shared/logger';
import { usePreferencesStore, type Preferences } from '@/shared/preferences';

import { getServerA11yProfile, putServerA11yProfile, updateRemoteConfig } from '../api/settingsApi';
import { decideProfileSync, toServerA11yProfile } from '../domain/a11yProfileSync';
import { fromRemoteConfig, toRemoteConfigPatch } from '../domain/remoteConfig';

/**
 * 在根 layout 呼叫一次：
 * 1. 登入回應帶來的伺服器偏好套到本機（`fromRemoteConfig` 決定哪些欄位）。
 * 2. 登入中改偏好 → fire-and-forget 上傳（對齊 Web：失敗只記 log、不回滾）。
 * 3. 登入後同步一次需求輪廓；登入中改需求 → 上傳。
 */
export function useSettingsSync(): void {
  const remoteConfig = useAuthStore((s) => s.remoteConfig);
  const loggedIn = useAuthStore(selectIsLoggedIn);
  const userId = useAuthStore((s) => s.user?._id ?? s.user?.email ?? null);

  // 1. 伺服器 → 本機
  useEffect(() => {
    if (!remoteConfig) return;
    const patch = fromRemoteConfig(pickUserConfig(remoteConfig));
    if (Object.keys(patch).length > 0) usePreferencesStore.getState().setPreferences(patch);
  }, [remoteConfig]);

  // 2. 本機 → 伺服器
  useEffect(() => {
    if (!loggedIn) return;
    const unsubscribe = usePreferencesStore.subscribe((state, prev) => {
      const changed: Partial<Preferences> = {};
      if (state.themeMode !== prev.themeMode) changed.themeMode = state.themeMode;
      if (state.fontSize !== prev.fontSize) changed.fontSize = state.fontSize;
      if (state.language !== prev.language) changed.language = state.language;
      if (state.notifications !== prev.notifications) changed.notifications = state.notifications;
      if (state.memoryEnabled !== prev.memoryEnabled) changed.memoryEnabled = state.memoryEnabled;
      // 伺服器值剛套進來造成的變動也會觸發一次上傳：值相同、無害（冪等）。
      const upload = async () => {
        try {
          await updateRemoteConfig(toRemoteConfigPatch(changed));
        } catch (error) {
          logger.warn('[settings] updateConfig failed', error);
        }
      };
      void upload();
    });
    return unsubscribe;
  }, [loggedIn]);

  // 3. 需求輪廓：登入（或換帳號）時決定 push／pull 一次，之後本機變動就上傳。
  useEffect(() => {
    if (!loggedIn || !userId) return;
    let cancelled = false;
    const initial = async () => {
      try {
        const server = await getServerA11yProfile();
        if (cancelled) return;
        const decision = decideProfileSync(useOnboardingStore.getState().profile, server);
        if (decision.kind === 'pull') useOnboardingStore.getState().replaceProfile(decision.profile);
        if (decision.kind === 'push') await putServerA11yProfile(toServerA11yProfile(useOnboardingStore.getState().profile));
      } catch (error) {
        logger.warn('[settings] a11y profile sync failed', error);
      }
    };
    void initial();
    const unsubscribe = useOnboardingStore.subscribe((state, prev) => {
      if (state.profile === prev.profile) return;
      const push = async () => {
        try {
          await putServerA11yProfile(toServerA11yProfile(state.profile));
        } catch (error) {
          logger.warn('[settings] a11y profile push failed', error);
        }
      };
      void push();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loggedIn, userId]);
}
