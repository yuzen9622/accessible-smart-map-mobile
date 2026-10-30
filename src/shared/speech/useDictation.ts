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

export type DictationStatus = 'idle' | 'starting' | 'listening' | 'denied' | 'error';

export interface UseDictationResult {
  status: DictationStatus;
  /** 開始聽語音輸入；呼叫端自行決定收到結果後要做什麼（例如塞進搜尋框）。 */
  start: () => Promise<void>;
  /** 主動停止；會先觸發最後一次 `onResult`（若有講到話）才真正結束。 */
  stop: () => void;
  /** 放棄本次語音輸入，不再接收辨識結果。 */
  cancel: () => void;
}

/**
 * 原地語音輸入（不開對話 UI，講完直接回傳辨識文字）；給搜尋框這類「講話→填字」的場景用。
 * 跟 `features/voice` 的 AI 語音對話 pipeline是分開的兩件事：那套是對話/下指令，這個只是聽寫。
 * 放 `shared/` 而不是某個 feature 底下：`place` 需要用，但 `voice` 經 `route` 反向依賴
 * `place`，`place` 直接 import `voice` 會形成 require cycle（測試人員回饋 2026-10-11）。
 */
export function useDictation(onResult: (transcript: string) => void): UseDictationResult {
  const [status, setStatus] = useState<DictationStatus>('idle');
  const active = useRef(false);
  const nativePhase = useRef<'idle' | 'active' | 'ending'>('idle');
  const restartRequested = useRef(false);
  const requestId = useRef(0);
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const start = useCallback(async () => {
    if (active.current || restartRequested.current) return;
    setStatus('starting');
    // 原生 abort/stop 會延遲送出 end；等舊 session 完全結束，避免舊事件清掉新收音。
    if (nativePhase.current !== 'idle') {
      restartRequested.current = true;
      return;
    }
    active.current = true;
    const currentRequest = ++requestId.current;
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!active.current || currentRequest !== requestId.current) return;
      if (!permission.granted) {
        active.current = false;
        setStatus('denied');
        return;
      }
      nativePhase.current = 'active';
      ExpoSpeechRecognitionModule.start({ lang: SPEECH_LANG[getAppLanguage()], interimResults: false });
    } catch (error) {
      if (!active.current || currentRequest !== requestId.current) return;
      active.current = false;
      nativePhase.current = 'idle';
      logger.warn('[speech] start dictation failed', error);
      setStatus('error');
    }
  }, []);

  useSpeechRecognitionEvent('start', () => {
    if (active.current) setStatus('listening');
  });
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript.trim();
    if (active.current && event.isFinal && transcript) onResultRef.current(transcript);
  });
  useSpeechRecognitionEvent('error', (event) => {
    if (!active.current) return;
    active.current = false;
    nativePhase.current = 'ending';
    logger.warn('[speech] recognition error', event.error, event.message);
    setStatus(event.error === 'not-allowed' ? 'denied' : 'error');
  });
  useSpeechRecognitionEvent('end', () => {
    active.current = false;
    nativePhase.current = 'idle';
    if (restartRequested.current) {
      restartRequested.current = false;
      void start();
    } else {
      setStatus((current) => (current === 'starting' || current === 'listening' ? 'idle' : current));
    }
  });

  useEffect(
    () => () => {
      requestId.current += 1;
      active.current = false;
      restartRequested.current = false;
      // 只中止這個 hook 啟動的收音，並取消尚未完成的權限請求。
      if (nativePhase.current === 'active') ExpoSpeechRecognitionModule.abort();
      nativePhase.current = 'idle';
    },
    [],
  );

  const stop = useCallback(() => {
    requestId.current += 1;
    restartRequested.current = false;
    if (nativePhase.current === 'active') {
      nativePhase.current = 'ending';
      ExpoSpeechRecognitionModule.stop();
    } else if (nativePhase.current === 'idle' || !active.current) {
      active.current = false;
      setStatus('idle');
    }
  }, []);

  const cancel = useCallback(() => {
    requestId.current += 1;
    active.current = false;
    restartRequested.current = false;
    setStatus('idle');
    if (nativePhase.current === 'active') {
      nativePhase.current = 'ending';
      ExpoSpeechRecognitionModule.abort();
    }
  }, []);

  return { status, start, stop, cancel };
}
