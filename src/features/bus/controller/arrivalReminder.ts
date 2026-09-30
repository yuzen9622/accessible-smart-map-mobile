import * as Notifications from 'expo-notifications';
import { create } from 'zustand';

import { requestPushPermission } from '@/features/notifications';

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

export function arrivalReminderKey(city: string, routeName: string, direction: 0 | 1, stopName: string): string {
  return `${city}::${routeName}::${direction}::${stopName}`;
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

async function replace(key: string, etaMinutes: number, content: ReminderContent): Promise<void> {
  const previous = useReminderStore.getState().reminders[key];
  if (previous) await Notifications.cancelScheduledNotificationAsync(previous.notificationId);
  const seconds = delaySeconds(etaMinutes);
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: { title: content.title, body: content.body, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
  useReminderStore.getState().set(key, { notificationId, fireAt: Date.now() + seconds * 1000 });
  scheduleExpiry(key, seconds * 1000);
}

/** 開啟提醒；沒有通知權限時回傳 false。 */
export async function startArrivalReminder(key: string, etaMinutes: number, content: ReminderContent): Promise<boolean> {
  if ((await requestPushPermission()) !== 'granted') return false;
  await replace(key, etaMinutes, content);
  return true;
}

/** 到站時間更新時重新排程；沒有開提醒或已經觸發過就不動。 */
export async function refreshArrivalReminder(key: string, etaMinutes: number, content: ReminderContent): Promise<void> {
  const reminder = useReminderStore.getState().reminders[key];
  if (!reminder || reminder.fireAt <= Date.now()) return;
  // ETA 以分鐘為單位（後端四捨五入），同一班車每輪算出的觸發時間本來就會抖動最多 60 秒；
  // 變動小於這個門檻就不重排，否則每 30 秒一輪的輪詢會把提醒一直往後推。
  const nextFireAt = Date.now() + delaySeconds(etaMinutes) * 1000;
  if (Math.abs(nextFireAt - reminder.fireAt) < RESCHEDULE_THRESHOLD_MS) return;
  await replace(key, etaMinutes, content);
}

export async function stopArrivalReminder(key: string): Promise<void> {
  const reminder = useReminderStore.getState().reminders[key];
  if (!reminder) return;
  scheduleExpiry(key, -1);
  useReminderStore.getState().set(key, null);
  await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
}
