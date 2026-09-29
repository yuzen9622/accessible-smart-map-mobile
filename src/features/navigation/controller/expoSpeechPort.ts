import * as Speech from 'expo-speech';

import type { SpeechPort } from './navigationController';

/**
 * 本機 TTS（SDD §6.4）：`expo-speech`。語速 0.9、語系 zh-TW／en-US，對齊 Web `NavigationHUD` 的
 * `SpeechSynthesisUtterance`。喇叭仲裁（語音助理擁有播報時不發聲）在 controller 的 `shouldSpeakLocally`。
 */
export const expoSpeechPort: SpeechPort = {
  speak(text, language) {
    Speech.speak(text, { language: language === 'en' ? 'en-US' : 'zh-TW', rate: 0.9 });
  },
  stop() {
    void Speech.stop();
  },
};

/** 裝置是否有該語系的語音；缺 zh-TW 語音時 HUD 顯示提示（SDD §6.4）。 */
export async function hasVoiceFor(language: 'zh-TW' | 'en'): Promise<boolean> {
  const voices = await Speech.getAvailableVoicesAsync();
  const prefix = language === 'en' ? 'en' : 'zh-TW';
  return voices.some((voice) => voice.language.replace('_', '-').startsWith(prefix));
}
