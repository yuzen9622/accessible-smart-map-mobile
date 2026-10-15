import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Vibration } from 'react-native';

import { logger } from '@/shared/logger';
import { usePreferencesStore } from '@/shared/preferences';

const ALARM_SOURCE = require('../../../../assets/sounds/sos-alarm.wav') as number;

/** 重複震動：響 1 秒、停 0.5 秒，持續到 `stopSosAlarm`（`Vibration.vibrate` 的 repeat 需要陣列）。 */
const VIBRATE_PATTERN = [0, 1000, 500];

let player: AudioPlayer | null = null;
let audioModeReady = false;

async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  audioModeReady = true;
  try {
    // 靜音模式下也要響，才能有效吸引旁人注意（測試人員回饋 2026-10-11）；不需要背景播放。
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
  } catch (error) {
    logger.warn('[sos] set audio mode failed', error);
  }
}

/**
 * SOS 正式啟用時依使用者偏好吸引旁人注意：
 * - `sound`：播放警報聲（迴圈）
 * - `vibrate`：只重複震動，不出聲（只有單一音檔，沒有「選音效」的空間，改給震動選項）
 * - `silent`：都不觸發
 */
export function startSosAlarm(): void {
  const mode = usePreferencesStore.getState().sosAlarmMode;
  if (mode === 'silent') return;
  if (mode === 'vibrate') {
    Vibration.vibrate(VIBRATE_PATTERN, true);
    return;
  }
  try {
    void ensureAudioMode();
    if (!player) player = createAudioPlayer(ALARM_SOURCE);
    player.loop = true;
    player.seekTo(0);
    player.play();
  } catch (error) {
    logger.warn('[sos] start alarm failed', error);
  }
}

/** SOS 結束（解除／登出）時停止警報聲／震動。 */
export function stopSosAlarm(): void {
  Vibration.cancel();
  if (!player) return;
  try {
    player.pause();
    player.seekTo(0);
  } catch (error) {
    logger.warn('[sos] stop alarm failed', error);
  }
}
