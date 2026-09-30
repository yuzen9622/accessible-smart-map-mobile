import { useEffect, useRef } from 'react';

import { useAppTranslation } from '@/shared/i18n';
import { getLocationPort } from '@/shared/location';
import { appStateVisibility } from '@/shared/polling';

import { localRerouteCoordinator } from '../controller/localRerouteCoordinator';
import {
  createNavigationController,
  silentSpeech,
  type NavigationController,
  type SpeechPort,
} from '../controller/navigationController';
import { getNavigationSpeechOwner, subscribeSpeechOwner } from '../controller/speechOwnerPort';
import { useNavStore } from '../store/navStore';

/**
 * 地圖畫面掛一次：導航進行中時啟動 NavigationController，結束時停止（對齊 Web 只在 `isNavigating`
 * 時掛載 `useNavigation`）。`speech` 由呼叫端注入——expo-speech 的實作在 Mac 上實機驗證後接上，
 * 在那之前預設不發聲。
 */
export function useNavigationSession(speech: SpeechPort = silentSpeech): void {
  const isNavigating = useNavStore((s) => s.isNavigating);
  const { i18n, t } = useAppTranslation();
  const env = useRef({ speech, language: i18n.language, arrived: t('arrivedDesc') });

  useEffect(() => {
    env.current = { speech, language: i18n.language, arrived: t('arrivedDesc') };
  });

  useEffect(() => {
    if (!isNavigating) return;
    const controller: NavigationController = createNavigationController({
      location: getLocationPort(),
      visibility: appStateVisibility,
      reroute: localRerouteCoordinator,
      speech: {
        speak: (text, language) => env.current.speech.speak(text, language),
        stop: () => env.current.speech.stop(),
      },
      language: () => (env.current.language === 'en' ? 'en' : 'zh-TW'),
      arrivedText: () => env.current.arrived,
      // 喇叭仲裁：語音助理擁有播報時本機 TTS 不發聲（port 由語音 feature 注入，見 speechOwnerPort.ts）
      geminiOwnsSpeech: () => getNavigationSpeechOwner().geminiOwnsSpeech(),
      subscribeSpeechOwner,
    });
    controller.start();
    return () => controller.stop();
  }, [isNavigating]);
}
