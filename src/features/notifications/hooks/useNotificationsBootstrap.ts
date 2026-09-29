import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { onLogout, selectIsLoggedIn, useAuthStore } from '@/features/auth';
import { usePreferencesStore } from '@/shared/preferences';

import { unregisterPushToken } from '../api/pushTokenApi';
import { parsePushTarget } from '../domain/pushPayload';
import { getCachedPushToken, syncPushToken } from '../pushService';

// 前景收到推播也顯示橫幅（SOS 狀態變更要讓使用者立刻看到）。
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function openTarget(data: unknown): void {
  const target = parsePushTarget(data);
  if (target.kind === 'sos') router.push('/sos');
  else if (target.kind === 'hazard') router.push('/settings/reports');
}

/**
 * 在根 layout 呼叫一次：處理點擊推播（含冷啟動由推播開啟）、登入後登記 token、登出時註銷。
 * 不在這裡請求權限（見 `pushService`）。
 */
export function useNotificationsBootstrap(): void {
  const loggedIn = useAuthStore(selectIsLoggedIn);
  const wantsNotifications = usePreferencesStore((s) => s.notifications);
  const language = usePreferencesStore((s) => s.language);
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!lastResponse) return;
    openTarget(lastResponse.notification.request.content.data);
  }, [lastResponse]);

  useEffect(() => {
    if (!wantsNotifications) return;
    const run = async () => {
      try {
        await syncPushToken(loggedIn);
      } catch (error) {
        console.warn('[push] sync failed', error);
      }
    };
    void run();
  }, [loggedIn, wantsNotifications, language]);

  // Expo push token 輪替時重新登記（後端註冊是冪等的）。
  useEffect(() => {
    if (!wantsNotifications || !loggedIn) return;
    const subscription = Notifications.addPushTokenListener(() => {
      void syncPushToken(true).catch((error: unknown) => console.warn('[push] resync failed', error));
    });
    return () => subscription.remove();
  }, [loggedIn, wantsNotifications]);

  useEffect(
    () =>
      onLogout(async (captured) => {
        const token = getCachedPushToken();
        if (!token || !captured.accessToken) return;
        await unregisterPushToken(token, captured.accessToken);
      }),
    [],
  );
}
