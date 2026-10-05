import * as Notifications from 'expo-notifications';
import { create } from 'zustand';

import { requestPushPermission } from '@/features/notifications';

import type { TrackableBusDirection } from '../types/transit';

/** 車子預計到站前幾分鐘提醒。 */
export const REMINDER_LEAD_MINUTES = 3;
/** 已經快到了也至少延後這麼久，避免在按下按鈕的同一瞬間跳通知。 */
const MIN_DELAY_SECONDS = 5;
/** 觸發時間要差超過這麼多才重排（大於 ETA 的一分鐘取整誤差）。 */
const RESCHEDULE_THRESHOLD_MS = 90_000;

interface Reminder {
  notificationId: string;
  /** 預計觸發時間（epoch ms）。 */
  fireAt: number;
}

/** 觸發時間一到就把提醒從 store 移除，按鈕回到「提醒我」。 */
const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleExpiry(key: string, delayMs: number): void {
  const previous = expiryTimers.get(key);
  if (previous) clearTimeout(previous);
  if (delayMs < 0) {
    expiryTimers.delete(key);
    return;
  }
  expiryTimers.set(
    key,
    setTimeout(() => {
      expiryTimers.delete(key);
      useReminderStore.getState().set(key, null);
    }, delayMs),
  );
}

interface ReminderState {
  reminders: Record<string, Reminder>;
  set: (key: string, reminder: Reminder | null) => void;
}

const useReminderStore = create<ReminderState>()((set) => ({
  reminders: {},
  set: (key, reminder) =>
    set((state) => {
      const reminders = { ...state.reminders };
      if (reminder) reminders[key] = reminder;
      else delete reminders[key];
      return { reminders };
    }),
}));

/**
 * 提醒目標的識別：城市、路線、支線、方向、站名。方向 255（未知）型別上就排除——不能據此判斷車往哪邊開。
 * 同一路線不同支線或不同方向（包含 2／10）的提醒互相獨立。
 */
export function arrivalReminderKey(
  city: string,
  routeName: string,
  subRouteUid: string | undefined,
  direction: TrackableBusDirection,
  stopName: string,
): string {
  return `${city}::${routeName}::${subRouteUid ?? ''}::${direction}::${stopName}`;
}

/** 這一站目前有沒有排定、還沒觸發的提醒。 */
export function useArrivalReminderActive(key: string): boolean {
  return useReminderStore((s) => s.reminders[key] !== undefined);
}

export interface ReminderContent {
  title: string;
  body: string;
}

function delaySeconds(etaMinutes: number): number {
  return Math.max(MIN_DELAY_SECONDS, Math.round((etaMinutes - REMINDER_LEAD_MINUTES) * 60));
}

/**
 * 每個 key 的操作世代：start／refresh／stop 一開始就遞增。晚到的 await（權限、取消、排程）回來時
 * 若世代已被後來的操作取代，就不得再寫入 store 或留下通知——切換目標、卸載、同 key 連續操作
 * 都不會讓舊請求「復活」提醒。
 */
const generations = new Map<string, number>();

function bump(key: string): number {
  const next = (generations.get(key) ?? 0) + 1;
  generations.set(key, next);
  return next;
}

function isCurrent(key: string, generation: number): boolean {
  return generations.get(key) === generation;
}

function isValidEta(etaMinutes: number | null): etaMinutes is number {
  return typeof etaMinutes === 'number' && Number.isFinite(etaMinutes) && etaMinutes >= 0;
}

/** 回傳 false：這次操作已被取代（排好的通知已取消，store 沒有被動到）。 */
async function replace(key: string, generation: number, etaMinutes: number, content: ReminderContent): Promise<boolean> {
  const previous = useReminderStore.getState().reminders[key];
  if (previous) {
    await Notifications.cancelScheduledNotificationAsync(previous.notificationId);
    if (!isCurrent(key, generation)) return false;
  }
  const seconds = delaySeconds(etaMinutes);
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: { title: content.title, body: content.body, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
  if (!isCurrent(key, generation)) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    return false;
  }
  useReminderStore.getState().set(key, { notificationId, fireAt: Date.now() + seconds * 1000 });
  scheduleExpiry(key, seconds * 1000);
  return true;
}

export type StartReminderResult = 'scheduled' | 'denied' | 'superseded';

/**
 * 開啟提醒。沒有通知權限回 `denied`；等權限期間被 stop／換目標／再次 start 取代回 `superseded`
 * （不是錯誤，畫面不該顯示失敗）。ETA 為 null／NaN／負數時沒有可提醒的時間：取消原本排定的通知。
 */
export async function startArrivalReminder(
  key: string,
  etaMinutes: number | null,
  content: ReminderContent,
): Promise<StartReminderResult> {
  if (!isValidEta(etaMinutes)) {
    await stopArrivalReminder(key);
    return 'superseded';
  }
  const generation = bump(key);
  const permission = await requestPushPermission();
  if (!isCurrent(key, generation)) return 'superseded';
  if (permission !== 'granted') return 'denied';
  return (await replace(key, generation, etaMinutes, content)) ? 'scheduled' : 'superseded';
}

/** 到站時間更新時重新排程；沒有開提醒或已經觸發過就不動。ETA 失效（無 ETA）時取消原通知。 */
export async function refreshArrivalReminder(key: string, etaMinutes: number | null, content: ReminderContent): Promise<void> {
  // 沒有 store 紀錄仍可能正在等權限／第一次排程；ETA 失效必須先讓那個世代作廢。
  if (!isValidEta(etaMinutes)) {
    await stopArrivalReminder(key);
    return;
  }
  const reminder = useReminderStore.getState().reminders[key];
  if (!reminder || reminder.fireAt <= Date.now()) return;
  // ETA 以分鐘為單位（後端四捨五入），同一班車每輪算出的觸發時間本來就會抖動最多 60 秒；
  // 變動小於這個門檻就不重排，否則每 30 秒一輪的輪詢會把提醒一直往後推。
  const nextFireAt = Date.now() + delaySeconds(etaMinutes) * 1000;
  if (Math.abs(nextFireAt - reminder.fireAt) < RESCHEDULE_THRESHOLD_MS) return;
  await replace(key, bump(key), etaMinutes, content);
}

/** 取消提醒；即使 store 裡還沒有（start 還在等權限或排程），也要讓進行中的 start 作廢。 */
export async function stopArrivalReminder(key: string): Promise<void> {
  bump(key);
  const reminder = useReminderStore.getState().reminders[key];
  if (!reminder) return;
  scheduleExpiry(key, -1);
  useReminderStore.getState().set(key, null);
  await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
}
