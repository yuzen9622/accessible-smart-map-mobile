import { router } from 'expo-router';
import { useRef } from 'react';
import { Alert, Keyboard, StyleSheet, View } from 'react-native';

import { selectIsLoggedIn, useAuthStore } from '@/features/auth';
import { useAppTranslation } from '@/shared/i18n';
import { ensureAiDataConsent } from '@/shared/privacy';
import { ACCENT_FILL, ON_ACCENT_FILL, ICON_SIZE } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import { startVoiceSession } from '../controller/voiceController';
import { isVoiceSessionActive } from '../domain/voiceStatus';
import { useVoiceStore } from '../store/voiceStore';
import PressableScale from '@/shared/ui/PressableScale';

const SIZE = 34;

/**
 * 聊天輸入列的語音對話鈕（對應 Web `AIChatBot.tsx` 的 mic 按鈕；設計稿 3a：輸入列右邊的波形鈕進語音模式）。
 * 未登入時提示登入（語音 `session.start` 需要 token）；已有 session（切回文字後）則回到語音面板，不另開一條
 * （後端同帳號第二條連線會把第一條踢掉，4409）。按下時先記下按鈕在視窗中的位置，語音畫面從這裡長出音波。
 */
export default function VoiceMicButton() {
  const { t } = useAppTranslation();
  const loggedIn = useAuthStore(selectIsLoggedIn);
  const status = useVoiceStore((s) => s.status.status);
  const setViewMode = useVoiceStore((s) => s.setViewMode);
  const setLaunchOrigin = useVoiceStore((s) => s.setLaunchOrigin);
  const buttonRef = useRef<View>(null);
  const resumable = isVoiceSessionActive(status) && status !== 'error' && status !== 'needs-login';

  const open = () => {
    if (resumable) setViewMode('panel');
    else startVoiceSession(t);
  };

  const onPress = async () => {
    if (!resumable && !loggedIn) {
      Alert.alert(t('chatbot.voice.loginRequired'), undefined, [
        { text: t('cancel'), style: 'cancel' },
        { text: t('auth.login'), onPress: () => router.navigate('/auth') },
      ]);
      return;
    }
    // 語音會即時串流給 Google Gemini：開麥克風前先確認使用者同意（App Store 5.1.2(i)）
    if (!resumable && !(await ensureAiDataConsent(t))) return;
    Keyboard.dismiss();
    const button = buttonRef.current;
    if (!button) {
      open();
      return;
    }
    button.measureInWindow((x, y, width, height) => {
      setLaunchOrigin(width > 0 ? { x: x + width / 2, y: y + height / 2, size: width, at: Date.now() } : null);
      open();
    });
  };

  return (
    <PressableScale
      ref={buttonRef}
      accessibilityRole="button"
      accessibilityLabel={t('chatbot.voice.micLabel')}
      onPress={() => void onPress()}
      hitSlop={6}
      style={styles.button}>
      <Icon name="audioLines" size={ICON_SIZE.body} color={ON_ACCENT_FILL} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: ACCENT_FILL },
});
