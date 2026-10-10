import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

import { useAuthStore } from '@/features/auth';
import { useUserLocationStore } from '@/features/map';
import { reverseGeocodeLabel } from '@/features/place';
import { requestPushPermission, syncPushToken } from '@/features/notifications';
import { ApiError } from '@/shared/api';
import { haversineMeters } from '@/shared/geo';
import i18n from '@/shared/i18n';
import { getLocationPort, startBackgroundLocation, stopBackgroundLocation } from '@/shared/location';
import { logger } from '@/shared/logger';
import { appStorage } from '@/shared/storage';

import {
  createSosSession,
  getEmergencyContacts,
  getSosSession,
  openSosStream,
  resolveSosSession,
  updateSosLocation,
} from '../api/sosApi';
import { startSosLifecycle, type SosLifecycle } from '../domain/sosLifecycle';
import {
  clearActiveSos,
  loadActiveSos,
  markResolvePending,
  recoveryAction,
  saveActiveSos,
  type RecoveryOutcome,
} from '../domain/sosSession';
import { HANDLING_LABEL_KEY } from '../domain/sosDisplay';
import type { SosSnapshot } from '../domain/types';
import { INITIAL_SOS_STATE, useSosStore } from '../store/sosStore';

/**
 * SOS 發起者流程，行為對齊 Web `SosDialog.tsx`（commit f82cda8）：
 * - 建立時一律 `type: 'body'`；建立途中使用者取消 → 立刻 resolve 新 session，不留孤兒求救。
 * - 進行中每 12 秒上傳位置；`SESSION_NOT_ACTIVE`（已被家人或其他裝置解除）→ 進入已解除。
 * - 快照 `status === 'resolved'` 也立即進入已解除，不必等位置上傳碰壁。
 * - 使用者按解除：伺服器失敗仍進入已解除（畫面不能卡在求救中），只提示同步失敗。
 * 原生新增：背景定位（鎖屏仍上傳位置，SDD §6.8）、第一次 SOS 時請求推播權限（ROADMAP 3.4）、
 * 位置上傳改由定位更新驅動（背景時 JS 計時器不可靠，背景任務每次送位置都會喚醒 JS）。
 */

export const SOS_LOCATION_UPDATE_MS = 12000;
export const SOS_COUNTDOWN_MS = 5000;
/** 地址只在移動 ≥ 30 m 後重查（Nominatim 約 1 req/s 的使用政策，對齊 Web hazard 面板）。 */
const ADDRESS_REQUERY_METERS = 30;

let lifecycle: SosLifecycle | null = null;
let unsubscribePosition: (() => void) | null = null;
let lastUploadAt = 0;
let lastUploaded: { lat: number; lng: number } | null = null;
let uploading = false;
let failCount = 0;
let lastHandling: string | null = null;

function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}

function applySnapshot(snapshot: SosSnapshot): void {
  const state = useSosStore.getState();
  if (state.sessionId && snapshot.sessionId !== state.sessionId) return;
  useSosStore.setState({ snapshot });
  // 處理狀態變更以文字播報（SDD §10 狀態播報）
  if (lastHandling !== null && lastHandling !== snapshot.handlingStatus) {
    announce(i18n.t(HANDLING_LABEL_KEY[snapshot.handlingStatus]));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
  lastHandling = snapshot.handlingStatus;
  if (snapshot.status === 'resolved' && useSosStore.getState().phase === 'active') {
    finishResolved();
  }
}

function startLifecycle(sessionId: string): void {
  lifecycle?.stop();
  lastHandling = null;
  lifecycle = startSosLifecycle(
    {
      fetchSnapshot: (signal) => getSosSession(sessionId, signal),
      openStream: (handlers, signal) => openSosStream(sessionId, handlers, signal),
    },
    {
      onSnapshot: applySnapshot,
      onStatus: (lifecycleStatus) => useSosStore.setState({ lifecycleStatus }),
    },
  );
}

/** App 回前景：SSE 在背景會斷，重新 snapshot＋訂閱（SDD §6.8）。 */
export function restartSosLifecycle(): void {
  const { sessionId, phase } = useSosStore.getState();
  if (sessionId && phase === 'active') startLifecycle(sessionId);
}

async function uploadLocation(force = false): Promise<void> {
  const { sessionId, phase, address } = useSosStore.getState();
  const position = useUserLocationStore.getState().position;
  if (!sessionId || phase !== 'active' || !position || uploading) return;
  const now = Date.now();
  if (!force && now - lastUploadAt < SOS_LOCATION_UPDATE_MS) return;
  // 靜止時不必每 12 秒重送同一點（省電、省流量）；但至少每分鐘送一次讓家人知道仍在線。
  if (!force && lastUploaded && haversineMeters(lastUploaded, position) < 5 && now - lastUploadAt < 60000) return;
  uploading = true;
  lastUploadAt = now;
  try {
    await updateSosLocation(sessionId, { lat: position.lat, lng: position.lng, ...(address ? { address: address.slice(0, 200) } : {}) });
    lastUploaded = position;
    failCount = 0;
    if (useSosStore.getState().locationSyncFailed) useSosStore.setState({ locationSyncFailed: false });
  } catch (error) {
    if (error instanceof ApiError && error.code === 400 && error.reason === 'SESSION_NOT_ACTIVE') {
      finishResolved();
      return;
    }
    failCount += 1;
    if (failCount === 1) useSosStore.setState({ locationSyncFailed: true });
  } finally {
    uploading = false;
  }
}

function startLocationUploads(): void {
  unsubscribePosition?.();
  lastUploadAt = 0;
  lastUploaded = null;
  failCount = 0;
  unsubscribePosition = useUserLocationStore.subscribe((state, prev) => {
    if (state.position !== prev.position) void uploadLocation();
  });
  // 靜止不動時定位不會更新，仍以計時器保底（前景時有效）。
  const timer = setInterval(() => void uploadLocation(), SOS_LOCATION_UPDATE_MS);
  const unsubscribeStore = unsubscribePosition;
  unsubscribePosition = () => {
    unsubscribeStore();
    clearInterval(timer);
  };
}

async function startBackground(): Promise<void> {
  try {
    const ok = await startBackgroundLocation(
      { notificationTitle: i18n.t('sosActiveTitle'), notificationBody: i18n.t('sosContinuousSharing') },
      'sos',
    );
    useSosStore.setState({ backgroundDenied: !ok });
  } catch (error) {
    logger.warn('[sos] start background location failed', error);
    useSosStore.setState({ backgroundDenied: true });
  }
}

function stopAll(): void {
  stopCountdown();
  stopAddressTracking();
  lifecycle?.stop();
  lifecycle = null;
  unsubscribePosition?.();
  unsubscribePosition = null;
  const stop = async () => {
    try {
      await stopBackgroundLocation('sos');
    } catch (error) {
      logger.warn('[sos] stop background location failed', error);
    }
  };
  void stop();
}

async function loadContacts(): Promise<void> {
  try {
    useSosStore.setState({ contacts: await getEmergencyContacts() });
  } catch (error) {
    logger.warn('[sos] load contacts failed', error);
  }
}

function enterActive(sessionId: string, shareToken: string | null): void {
  useSosStore.setState({ phase: 'active', sessionId, shareToken, locationSyncFailed: false });
  startAddressTracking();
  saveActiveSos(appStorage, sessionId, shareToken, currentUserId());
  startLifecycle(sessionId);
  startLocationUploads();
  void startBackground();
  void loadContacts();
}

let countdownTimer: ReturnType<typeof setInterval> | null = null;

function stopCountdown(): void {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = null;
}

let unsubscribeAddress: (() => void) | null = null;
let addressAnchor: { lat: number; lng: number } | null = null;
let addressRequest: AbortController | null = null;

function refreshAddress(position: { lat: number; lng: number } | null): void {
  if (!position) return;
  if (addressAnchor && haversineMeters(addressAnchor, position) < ADDRESS_REQUERY_METERS) return;
  addressAnchor = position;
  addressRequest?.abort();
  const controller = new AbortController();
  addressRequest = controller;
  const run = async () => {
    const label = await reverseGeocodeLabel(position.lat, position.lng, i18n.language, controller.signal);
    if (!controller.signal.aborted && label) useSosStore.setState({ address: label });
  };
  void run();
}

/** 倒數與進行中持續反查目前地址（附在建立與位置更新裡，也顯示在畫面上）。 */
function startAddressTracking(): void {
  if (unsubscribeAddress) return;
  addressAnchor = null;
  refreshAddress(useUserLocationStore.getState().position);
  unsubscribeAddress = useUserLocationStore.subscribe((state, prev) => {
    if (state.position !== prev.position) refreshAddress(state.position);
  });
}

function stopAddressTracking(): void {
  unsubscribeAddress?.();
  unsubscribeAddress = null;
  addressRequest?.abort();
  addressRequest = null;
}

/**
 * 開始 5 秒倒數（地圖上的 SOS 按鈕 → SOS 畫面）。每 100 ms 更新剩餘時間；震動：開始、每秒一次、
 * 最後兩秒加重（取代 Web `navigator.vibrate`）。倒數結束自動送出。
 */
export function beginSosCountdown(): void {
  const { phase } = useSosStore.getState();
  if (phase !== 'idle' && phase !== 'resolved') return;
  stopCountdown();
  useSosStore.setState({ ...INITIAL_SOS_STATE, phase: 'countdown', countdownRemainingMs: SOS_COUNTDOWN_MS });
  startAddressTracking();
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  announce(i18n.t('sosCountdownTitle'));
  const startedAt = Date.now();
  let lastSecond = Math.ceil(SOS_COUNTDOWN_MS / 1000);
  countdownTimer = setInterval(() => {
    const left = Math.max(0, SOS_COUNTDOWN_MS - (Date.now() - startedAt));
    useSosStore.setState({ countdownRemainingMs: left });
    const second = Math.ceil(left / 1000);
    if (second !== lastSecond && left > 0) {
      lastSecond = second;
      void Haptics.impactAsync(second <= 2 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
    }
    if (left <= 0) {
      stopCountdown();
      void startSosSession();
    }
  }, 100);
}

export function cancelSosCountdown(): void {
  stopCountdown();
  if (useSosStore.getState().phase === 'countdown') {
    stopAddressTracking();
    useSosStore.setState({ phase: 'idle' });
    announce(i18n.t('nativeSosCountdownCancelled'));
  }
}

/** 倒數中按「立即送出」。 */
export function sendSosNow(): void {
  stopCountdown();
  void startSosSession();
}

export function clearSosStartError(): void {
  useSosStore.setState({ startError: null });
}

async function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  const known = useUserLocationStore.getState().position;
  if (known) return known;
  try {
    const port = getLocationPort();
    if ((await port.requestForegroundPermission()) !== 'granted') return null;
    const fix = await port.getCurrent({ accuracy: 'high' });
    return { lat: fix.lat, lng: fix.lng };
  } catch {
    return null;
  }
}

function currentUserId(): string | null {
  const user = useAuthStore.getState().user;
  return user?._id ?? user?.email ?? null;
}

/** 每次發起遞增；回應回來時比對，判斷這次嘗試是否已被取消或被新的嘗試取代。 */
let attemptSeq = 0;

export type StartSosResult = { ok: true } | { ok: false; reason: 'noLocation' | 'failed'; message?: string };

/** 倒數結束或按「立即送出」。 */
async function startSosSession(): Promise<StartSosResult> {
  if (useSosStore.getState().phase !== 'countdown') return { ok: false, reason: 'failed' };
  useSosStore.setState({ phase: 'creating' });
  const attempt = ++attemptSeq;
  const position = await currentPosition();
  // 等定位期間已取消：不能再送出（建立 session 當下後端就會用 LINE 通知家人）
  if (attempt !== attemptSeq || useSosStore.getState().phase !== 'creating') return { ok: false, reason: 'failed' };
  if (!position) {
    stopAddressTracking();
    useSosStore.setState({ phase: 'idle', startError: { reason: 'noLocation' } });
    return { ok: false, reason: 'noLocation' };
  }
  try {
    const { address } = useSosStore.getState();
    const created = await createSosSession({
      type: 'body',
      lat: position.lat,
      lng: position.lng,
      ...(address ? { address: address.slice(0, 200) } : {}),
    });
    if (attempt !== attemptSeq || useSosStore.getState().phase !== 'creating') {
      // 建立途中使用者已取消：立即解除新建的 session，不留孤兒求救（Web openRef 競態保護）。
      // 但伺服器回的是「既有的進行中求救」（200），或那筆正是目前畫面上的求救時不能解除——那是真的求救。
      if (created.existing || created.sessionId === useSosStore.getState().sessionId) return { ok: false, reason: 'failed' };
      const cleanup = async () => {
        try {
          await resolveSosSession(created.sessionId);
        } catch {
          // 盡力而為
        }
      };
      void cleanup();
      return { ok: false, reason: 'failed' };
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    enterActive(created.sessionId, created.shareToken);
    announce(i18n.t('sosActiveTitle'));
    // 第一次發起 SOS 時才請求推播權限（ROADMAP 3.4），之後家人接手等狀態可在背景收到
    const askPush = async () => {
      try {
        if ((await requestPushPermission()) === 'granted') await syncPushToken();
      } catch (error) {
        logger.warn('[sos] push permission failed', error);
      }
    };
    void askPush();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    stopAddressTracking();
    // 使用者已在建立途中取消時不必再提示
    const cancelled = useSosStore.getState().phase !== 'creating';
    useSosStore.setState({ phase: 'idle', startError: cancelled ? null : { reason: 'failed', message } });
    return { ok: false, reason: 'failed', message };
  }
}

/** 建立中按取消：標記為 idle，回應到了會被 `startSosSession` 清掉。 */
export function abortSosCreation(): void {
  if (useSosStore.getState().phase === 'creating') {
    stopAddressTracking();
    useSosStore.setState({ phase: 'idle' });
  }
}

function finishResolved(synced = true): void {
  stopAll();
  if (synced) clearActiveSos(appStorage);
  else markResolvePending(appStorage);
  useSosStore.setState({ phase: 'resolved' });
  announce(i18n.t('sosResolvedTitle'));
}

export type ResolveSosResult = { synced: boolean };

export async function resolveSos(): Promise<ResolveSosResult> {
  const { sessionId } = useSosStore.getState();
  let synced = true;
  if (sessionId) {
    try {
      await resolveSosSession(sessionId);
    } catch (error) {
      logger.warn('[sos] resolve failed', error);
      synced = false;
    }
  }
  finishResolved(synced);
  return { synced };
}

export function dismissResolvedSos(): void {
  if (useSosStore.getState().phase === 'resolved') useSosStore.setState(INITIAL_SOS_STATE);
}

let recoveryTried = false;

/**
 * 重啟後復原（SDD §6.8）：本機提示只代表「可能還在求救」，一律以 `GET /sessions/:id` 驗證；每次 App 執行只做一次。
 * 回傳 true＝已恢復到進行中（呼叫端開 SOS 畫面）。
 */
export async function recoverActiveSos(): Promise<boolean> {
  if (recoveryTried) return false;
  recoveryTried = true;
  const stored = loadActiveSos(appStorage);
  if (!stored) return false;
  // 同一台裝置換了帳號：那是別人的求救，不能用現在的身分去查（會 403）；留給原帳號登入時復原。
  if (stored.ownerId && stored.ownerId !== currentUserId()) return false;
  if (stored.resolvePending) {
    // 上次按了解除但沒送到：補送（冪等），成功或已不存在才清掉
    try {
      await resolveSosSession(stored.sessionId);
      clearActiveSos(appStorage);
    } catch (error) {
      if (error instanceof ApiError && [403, 404, 410].includes(error.code)) clearActiveSos(appStorage);
    }
    return false;
  }
  let outcome: RecoveryOutcome;
  try {
    const snapshot = await getSosSession(stored.sessionId);
    outcome = snapshot ? { kind: 'snapshot', status: snapshot.status } : { kind: 'empty' };
  } catch (error) {
    outcome =
      error instanceof ApiError && [403, 404, 410].includes(error.code) ? { kind: 'gone' } : { kind: 'transient' };
  }
  const action = recoveryAction(outcome);
  if (action === 'clear') clearActiveSos(appStorage);
  if (action !== 'resume') return false;
  const phase = useSosStore.getState().phase;
  if (phase === 'active' || phase === 'creating') return false;
  useSosStore.setState({ ...INITIAL_SOS_STATE });
  enterActive(stored.sessionId, stored.shareToken);
  return true;
}

/** 登出時：本機停止 SOS 追蹤（伺服器端不自動解除——求救者可能只是被登出，家人仍需看到）。 */
export function resetSosOnLogout(): void {
  stopAll();
  useSosStore.setState(INITIAL_SOS_STATE);
}
