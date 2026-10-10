import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { useAuthStore, type AuthSession } from '@/features/auth';
import { ApiError, getAuthPort } from '@/shared/api';
import { usePreferencesStore } from '@/shared/preferences';
import { getSecureItem, setSecureItem } from '@/shared/storage';

import i18n from '@/shared/i18n';

import { registerPushToken, unregisterPushToken } from './api/pushTokenApi';

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

export type PushSyncStatus = 'idle' | 'syncing' | 'registered' | 'disabled' | 'signedOut'
  | 'denied' | 'undetermined' | 'tokenError' | 'registrationError' | 'unregisterError';
export const usePushStatus = create<{ status: PushSyncStatus }>(() => ({ status: 'idle' }));
const TOKEN_KEY = 'push.expo-token.v1';
type Binding = { token: string; accessToken: string; userId: string; locale: string };
// 包含「POST 已送出但回應失敗」的候選，停用時也要 DELETE。
let binding: Binding | null = null;
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(run: () => Promise<T>): Promise<T> {
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}
async function removeBinding(candidate: Binding): Promise<void> {
  await unregisterPushToken(candidate.token, candidate.accessToken);
  if (binding === candidate) binding = null;
}

/** 所有 POST／DELETE 共用序列；每次 POST 固定帶擷取的 bearer，絕不改綁後來登入的帳號。 */
export function syncPushToken(): Promise<PushSyncStatus> {
  const { user, restored } = useAuthStore.getState();
  let session = useAuthStore.getState().session;
  const userId = user?._id ?? user?.email;
  const enabled = usePreferencesStore.getState().notifications;
  const locale = i18n.language;
  const current = () => {
    const auth = useAuthStore.getState();
    return (auth.user?._id ?? auth.user?.email) === userId && auth.session === session
      && usePreferencesStore.getState().notifications === enabled && i18n.language === locale;
  };
  if (restored) usePushStatus.setState({ status: 'syncing' });
  return enqueue(async () => {
    if (!restored || !current()) return 'idle';
    const publish = (status: PushSyncStatus): PushSyncStatus => {
      if (current()) usePushStatus.setState({ status });
      return status;
    };
    // 401 只可續期本次擷取且仍有效的身分；不使用會自動讀取新帳號的 POST retry。
    const withSession = async (operation: (accessToken: string) => Promise<void>) => {
      if (!session?.accessToken || !current()) throw new Error('Push session superseded');
      try { await operation(session.accessToken); }
      catch (error) {
        if (!(error instanceof ApiError) || error.code !== 401 || !current()) throw error;
        const refreshed = await getAuthPort().refresh(session);
        const auth = useAuthStore.getState();
        if (!refreshed || auth.session?.accessToken !== refreshed || (auth.user?._id ?? auth.user?.email) !== userId) throw error;
        session = auth.session;
        if (!current()) throw error;
        await operation(refreshed);
      }
    };
    const remove = async (candidate: Binding) => {
      if (candidate.userId === userId && session?.accessToken && current()) {
        await withSession(async (accessToken) => {
          candidate.accessToken = accessToken;
          await removeBinding(candidate);
        });
      } else await removeBinding(candidate);
    };
    cachedToken ??= await getSecureItem(TOKEN_KEY);
    let permission: PushPermission;
    try { permission = enabled || !cachedToken ? await getPushPermission() : 'undetermined'; }
    catch { return publish('tokenError'); }
    if (!current()) return 'idle';
    const active = enabled && permission === 'granted' && user && session?.accessToken;
    if (binding && (!active || binding.accessToken !== session?.accessToken || binding.userId !== userId)) {
      try { await remove(binding); }
      catch (error) {
        // 舊帳號 bearer 已失效時，新帳號的 POST 會以唯一 token 原子移轉綁定。
        if (!active || !(error instanceof ApiError) || ![401, 403].includes(error.code)) return publish('unregisterError');
      }
    }
    if (!current()) return 'idle';
    if (!active) {
      // 舊版尚未持久化 token：已有 OS 權限時取回識別後 DELETE，不彈權限視窗。
      if (!cachedToken && session?.accessToken && permission === 'granted') {
        try {
          cachedToken = (await Notifications.getExpoPushTokenAsync({ projectId: projectId() })).data;
          await setSecureItem(TOKEN_KEY, cachedToken);
        } catch { return publish('unregisterError'); }
        if (!current()) return 'idle';
      }
      // 冷啟動也能停用上一輪註冊，不依賴記憶體中的 binding。
      if (cachedToken && session?.accessToken && (!enabled || permission !== 'granted')) {
        try { await remove({ token: cachedToken, accessToken: session.accessToken, userId: userId ?? '', locale }); }
        catch { return publish('unregisterError'); }
      }
      return publish(!enabled ? 'disabled' : permission !== 'granted' ? permission : 'signedOut');
    }
    let token: string;
    try {
      await ensureAndroidChannel();
      token = (await Notifications.getExpoPushTokenAsync({ projectId: projectId() })).data;
      cachedToken = token;
      await setSecureItem(TOKEN_KEY, token);
    } catch { return publish('tokenError'); }
    if (!current()) return 'idle';
    if (binding && binding.token !== token) {
      try { await remove(binding); }
      catch { return publish('unregisterError'); }
    }
    if (!current()) return 'idle';
    const candidate: Binding = { token, accessToken: session!.accessToken!, userId: user._id ?? user.email, locale };
    binding = candidate;
    let status: PushSyncStatus = 'registered';
    try {
      await withSession(async (accessToken) => {
        candidate.accessToken = accessToken;
        await registerPushToken({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android', locale }, accessToken);
      });
    } catch {
      status = 'registrationError';
    }
    if (!current()) {
      try { await removeBinding(candidate); }
      catch { /* 保留 binding，下個排程先重試註銷。 */ }
      return 'idle';
    }
    return publish(status);
  });
}

/** 沿用 auth 的 captured session；排在未完成 POST 後面，防止登出後重新綁定。 */
export function unregisterSessionPush(captured: AuthSession): Promise<void> {
  return enqueue(async () => {
    const token = cachedToken ?? await getSecureItem(TOKEN_KEY);
    if (!token || !captured.accessToken) return;
    const candidate = binding?.accessToken === captured.accessToken ? binding
      : { token, accessToken: captured.accessToken, userId: '', locale: '' };
    binding ??= candidate;
    try { await removeBinding(candidate); }
    catch { if (!useAuthStore.getState().session) usePushStatus.setState({ status: 'unregisterError' }); }
  });
}
