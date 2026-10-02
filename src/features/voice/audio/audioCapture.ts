import { AudioManager, AudioRecorder } from 'react-native-audio-api';

import { createFrameChunker, float32ToPcm16 } from '../domain/pcm';
import type { VoiceCapture } from '../domain/voiceSession';
import { activateVoiceAudioSession, currentVoiceAudioEpoch, trackAudioTeardown } from './audioSession';
import { logger } from '@/shared/logger';

/** 協定（後端 VOICE_WS_PROTOCOL §3.4）：PCM16 LE、16 kHz、mono，每 1600 samples（100 ms）一個 frame。 */
const CAPTURE_RATE = 16000;
const FRAME_LENGTH = 1600;

export class MicPermissionError extends Error {
  constructor() {
    super('Microphone permission denied');
    this.name = 'MicPermissionError';
  }
}

/**
 * `VoiceCapture` 原生實作（取代 Web `lib/voice/audioCapture.ts` 的 AudioWorklet）。
 * 取樣率轉換交給 `react-native-audio-api` 內建重取樣（iOS `AVAudioConverter` 最高品質；Spike B），
 * **不在 JS 抽稀**（協定 §7 明文禁止裸抽稀）。原生 `bufferLength` 已固定 1600 frame，chunker 只是保險。
 * reject 時 controller 會轉成 `MIC_UNAVAILABLE`。
 */
export async function createCapture(onFrame: (frame: ArrayBuffer) => void): Promise<VoiceCapture> {
  // 在等權限之前記下世代：對話若在權限對話框期間結束，啟用會被作廢而不是把 session 留著
  const epoch = currentVoiceAudioEpoch();
  const permission = await AudioManager.requestRecordingPermissions();
  if (permission !== 'Granted') throw new MicPermissionError();
  await activateVoiceAudioSession(epoch);

  const recorder = new AudioRecorder();
  const chunker = createFrameChunker(FRAME_LENGTH);
  const ready = recorder.onAudioReady({ sampleRate: CAPTURE_RATE, bufferLength: FRAME_LENGTH, channelCount: 1 }, (event) => {
    for (const frame of chunker.push(event.buffer.getChannelData(0))) onFrame(float32ToPcm16(frame));
  });
  if (ready.status === 'error') throw new Error(ready.message);
  const started = await recorder.start();
  if (started.status === 'error') {
    recorder.clearOnAudioReady();
    throw new Error(started.message);
  }

  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      recorder.clearOnAudioReady();
      trackAudioTeardown(stopRecorder(recorder));
    },
  };
}

async function stopRecorder(recorder: AudioRecorder): Promise<void> {
  try {
    await recorder.stop();
  } catch (error) {
    logger.warn('[voice] stop recorder failed', error);
  }
}
