import * as Notifications from 'expo-notifications';
import { router, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { onLogout, selectIsLoggedIn, useAuthStore } from '@/features/auth';
import { refreshMyReports } from '@/features/hazard';
import i18n, { useAppTranslation } from '@/shared/i18n';
import { logger } from '@/shared/logger';
import { usePreferencesStore } from '@/shared/preferences';
import { appStorage } from '@/shared/storage';

import { parsePushTarget } from '../domain/pushPayload';
import { syncPushToken, unregisterSessionPush, usePushStatus } from '../pushService';

Notifications.setNotificationHandler({
  handleNotification: async () => {
    const enabled = usePreferencesStore.getState().notifications;
    return { shouldShowBanner: enabled, shouldShowList: enabled, shouldPlaySound: enabled, shouldSetBadge: false };
  },
});

// 只保存最近的識別碼，不保存通知內容；跨冷啟動也不重複跳轉。
const HANDLED_KEY = 'push.handled.v1';
function readHandled(): string[] {
  try {
    const value: unknown = JSON.parse(appStorage.getString(HANDLED_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(-200) : [];
  } catch { return []; }
}
const handled = new Set(readHandled());
function clearResponse(): void {
  try { Notifications.clearLastNotificationResponse(); }
  catch { logger.warn('[push] clear response failed'); }
}

export function useNotificationsBootstrap(): void {
  const restored = useAuthStore((s) => s.restored);
  const loggedIn = useAuthStore(selectIsLoggedIn);
  const userId = useAuthStore((s) => s.user?._id);
  const session = useAuthStore((s) => s.session);
  const wantsNotifications = usePreferencesStore((s) => s.notifications);
  const { i18n: languageState } = useAppTranslation();
  const language = languageState.language;
  const navigation = useRootNavigationState();
  const lastResponse = Notifications.useLastNotificationResponse();
  const loginRequested = useRef<string | null>(null);

  useEffect(() => {
    if (!restored || !navigation?.key || !lastResponse) return;
    const request = lastResponse.notification.request;
    const target = parsePushTarget(request.content.data);
    const key = target.kind === 'hazard' && target.notificationId ? target.notificationId : request.identifier;
    if (handled.has(key) || target.kind === 'none') { clearResponse(); return; }
    if (!loggedIn) {
      if (loginRequested.current !== key) {
        loginRequested.current = key;
        router.navigate('/auth');
      }
      return; // 保留原生 response，登入後才消費。
    }
    if (target.kind === 'sos') router.navigate('/sos');
    else {
      refreshMyReports();
      if (target.reportId) router.navigate({ pathname: '/settings/report/[id]', params: { id: target.reportId } }, { withAnchor: true });
      else router.navigate('/settings/reports', { withAnchor: true });
    }
    handled.add(key);
    if (handled.size > 200) handled.delete(handled.values().next().value!);
    try { appStorage.set(HANDLED_KEY, JSON.stringify([...handled])); }
    catch { logger.warn('[push] save handled response failed'); }
    loginRequested.current = null;
    clearResponse();
  }, [restored, loggedIn, userId, navigation?.key, lastResponse]);

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener((notification) => {
      if (parsePushTarget(notification.request.content.data).kind === 'hazard') refreshMyReports();
    });
    return () => received.remove();
  }, []);

  useEffect(() => {
    if (!restored) return;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let retries = 0;
    const run = async () => {
      if (retry) clearTimeout(retry);
      const status = await syncPushToken();
      if (!disposed && ['tokenError', 'registrationError', 'unregisterError'].includes(status) && retries < 3) {
        retry = setTimeout(() => void run(), 5000 * 2 ** retries++);
      }
    };
    void run();
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') { retries = 0; void run(); }
    });
    const rotation = Notifications.addPushTokenListener(() => { retries = 0; void run(); });
    const languageChanged = () => { retries = 0; void run(); };
    i18n.on('languageChanged', languageChanged);
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      foreground.remove();
      rotation.remove();
      i18n.off('languageChanged', languageChanged);
    };
  }, [restored, userId, session, wantsNotifications, language]);

  useEffect(() => onLogout(async (captured) => {
    usePushStatus.setState({ status: 'signedOut' });
    await unregisterSessionPush(captured);
  }), []);
}
