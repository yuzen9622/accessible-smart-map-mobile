import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { getAppLanguage } from '@/shared/i18n';
import { logger } from '@/shared/logger';

const SPEECH_LANG: Record<ReturnType<typeof getAppLanguage>, string> = {
  'zh-TW': 'zh-TW',
  en: 'en-US',
};

export type DictationStatus = 'idle' | 'listening' | 'denied' | 'error';

export interface UseDictationResult {
  status: DictationStatus;
  /** 開始聽語音輸入；呼叫端自行決定收到結果後要做什麼（例如塞進搜尋框）。 */
  start: () => Promise<void>;
  /** 主動停止；會先觸發最後一次 `onResult`（若有講到話）才真正結束。 */
  stop: () => void;
}

/**
 * 原地語音輸入（不開對話 UI，講完直接回傳辨識文字）；給搜尋框這類「講話→填字」的場景用。
 * 跟 `features/voice` 的 AI 語音對話 pipeline是分開的兩件事：那套是對話/下指令，這個只是聽寫。
 * 放 `shared/` 而不是某個 feature 底下：`place` 需要用，但 `voice` 經 `route` 反向依賴
 * `place`，`place` 直接 import `voice` 會形成 require cycle（測試人員回饋 2026-10-11）。
 */
export function useDictation(onResult: (transcript: string) => void): UseDictationResult {
  const [status, setStatus] = useState<DictationStatus>('idle');
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useSpeechRecognitionEvent('result', (event) => {
    if (!event.results[0]?.transcript) return;
    if (event.isFinal) onResultRef.current(event.results[0].transcript.trim());
  });
  useSpeechRecognitionEvent('error', (event) => {
    logger.warn('[speech] recognition error', event.error, event.message);
    setStatus('error');
  });
  useSpeechRecognitionEvent('end', () => {
    setStatus((current) => (current === 'listening' ? 'idle' : current));
  });

  useEffect(
    () => () => {
      // 卸載時（例如離開搜尋頁）確保麥克風真的關掉，不留著繼續收音
      ExpoSpeechRecognitionModule.abort();
    },
    [],
  );

  const start = useCallback(async () => {
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setStatus('denied');
        return;
      }
      setStatus('listening');
      ExpoSpeechRecognitionModule.start({ lang: SPEECH_LANG[getAppLanguage()], interimResults: false });
    } catch (error) {
      logger.warn('[speech] start dictation failed', error);
      setStatus('error');
    }
  }, []);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { status, start, stop };
}
