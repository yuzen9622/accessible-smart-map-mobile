import { AudioManager } from 'react-native-audio-api';
import { logger } from '@/shared/logger';

/**
 * 語音對話的 iOS audio session（SDD §6.7）：`playAndRecord` + `voiceChat`（系統回音消除），允許藍牙耳機、
 * 預設走喇叭。擷取與播放共用；對話結束時恢復播放模式並關閉 session。
 *
 * 啟用／關閉全部排進同一條序列，並以「世代」判斷過期：
 * - 麥克風權限對話框還開著時對話就結束了（結束鈕、1011、4409、登出），權限之後才回來的啟用要作廢，
 *   否則 session 會一直掛著（`VoiceSessionController` 的過期擷取路徑只會停 recorder）。
 * - 關閉前先等錄音與播放拆完（`trackAudioTeardown`），播放引擎還在跑時關閉會被 iOS 以 busy 拒絕。
 */
export class StaleAudioSessionError extends Error {
  constructor() {
    super('Voice audio session was released before activation finished');
    this.name = 'StaleAudioSessionError';
  }
}

let epoch = 0;
let wanted = false;
let active = false;
let queue: Promise<void> = Promise.resolve();
const teardowns = new Set<Promise<void>>();

function enqueue(task: () => Promise<void>): Promise<void> {
  const next = queue.then(task, task);
  // 序列本身不因單一步驟失敗而斷掉
  queue = next.catch(() => undefined);
  return next;
}

/** 開始一段語音對話；回傳這段對話的世代，擷取啟用時用來判斷是否已過期。 */
export function beginVoiceAudio(): void {
  epoch += 1;
  wanted = true;
}

export function currentVoiceAudioEpoch(): number {
  return epoch;
}

/** 擷取開始前啟用 session；`epochAtRequest` 已不是目前世代（對話已結束）時丟 `StaleAudioSessionError`。 */
export function activateVoiceAudioSession(epochAtRequest: number): Promise<void> {
  return enqueue(async () => {
    if (!wanted || epochAtRequest !== epoch) throw new StaleAudioSessionError();
    if (active) return;
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playAndRecord',
      iosMode: 'voiceChat',
      iosOptions: ['allowBluetoothHFP', 'defaultToSpeaker'],
    });
    await AudioManager.setAudioSessionActivity(true);
    active = true;
    if (!wanted || epochAtRequest !== epoch) throw new StaleAudioSessionError();
  });
}

/** 錄音停止、播放 context 關閉等非同步拆除；關閉 session 前會等它們完成。 */
export function trackAudioTeardown(teardown: Promise<void>): void {
  teardowns.add(teardown);
  void teardown.finally(() => teardowns.delete(teardown));
}

/** 對話結束：等拆除完成後，先還原播放模式，再停用 session。 */
export function releaseVoiceAudio(): void {
  wanted = false;
  epoch += 1;
  void enqueue(async () => {
    await Promise.allSettled([...teardowns]);
    if (!active) return;
    try {
      // 原生 manager 只在 session 啟用時立即套用選項，必須先還原再停用。
      AudioManager.setAudioSessionOptions({
        iosCategory: 'playback',
        iosMode: 'default',
        iosOptions: [],
      });
      await AudioManager.setAudioSessionActivity(false);
    } catch (error) {
      logger.warn('[voice] release audio session failed', error);
    } finally {
      active = false;
    }
  });
}
