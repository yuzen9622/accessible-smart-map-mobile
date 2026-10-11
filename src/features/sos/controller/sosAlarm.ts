import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { logger } from '@/shared/logger';
import { usePreferencesStore } from '@/shared/preferences';

const ALARM_SOURCE = require('../../../../assets/sounds/sos-alarm.wav') as number;

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

/** SOS 正式啟用時播放警報聲（迴圈），吸引旁人注意；使用者可在設定關閉。 */
export function startSosAlarm(): void {
  if (!usePreferencesStore.getState().sosAlarmSoundEnabled) return;
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

/** SOS 結束（解除／登出）時停止警報聲。 */
export function stopSosAlarm(): void {
  if (!player) return;
  try {
    player.pause();
    player.seekTo(0);
  } catch (error) {
    logger.warn('[sos] stop alarm failed', error);
  }
}
