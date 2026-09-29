import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { backendCapabilities } from '@/shared/config';
import i18n from '@/shared/i18n';

import { registerPushToken } from './api/pushTokenApi';

/**
 * 推播權限與 token（ADR-10：Expo Push Service）。
 * 權限請求時機（ROADMAP 3.4）：第一次發起 SOS、或在設定頁打開通知時；冷啟動只讀取狀態、不跳系統彈窗。
 */

export type PushPermission = 'granted' | 'denied' | 'undetermined';

let cachedToken: string | null = null;

export function getCachedPushToken(): string | null {
  return cachedToken;
}

export async function getPushPermission(): Promise<PushPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('sos', {
    name: i18n.t('nativePushChannelSos'),
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/** 請求權限（必要時跳系統彈窗）；回傳最終狀態。 */
export async function requestPushPermission(): Promise<PushPermission> {
  await ensureAndroidChannel();
  const current = await getPushPermission();
  if (current !== 'undetermined') return current;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

function projectId(): string | undefined {
  const extra: unknown = Constants.expoConfig?.extra;
  if (typeof extra !== 'object' || extra === null) return undefined;
  const eas: unknown = (extra as Record<string, unknown>).eas;
  if (typeof eas !== 'object' || eas === null) return undefined;
  const id = (eas as Record<string, unknown>).projectId;
  return typeof id === 'string' ? id : undefined;
}

/**
 * 取得 Expo push token 並（後端就緒時）登記到帳號。模擬器或未簽 push entitlement 的免費帳號拿不到 token
 * （SDD R9），此時只記 log、回傳 null，App 其他功能不受影響。
 */
export async function syncPushToken(loggedIn: boolean): Promise<string | null> {
  if ((await getPushPermission()) !== 'granted') return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    cachedToken = data;
  } catch (error) {
    console.warn('[push] getExpoPushTokenAsync failed (simulator or missing entitlement?)', error);
    return null;
  }
  if (loggedIn && backendCapabilities.pushTokens && cachedToken) {
    try {
      await registerPushToken({
        token: cachedToken,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        locale: i18n.language,
      });
    } catch (error) {
      console.warn('[push] register token failed', error);
    }
  }
  return cachedToken;
}
