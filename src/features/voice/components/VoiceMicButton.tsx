import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, useColorScheme } from 'react-native';

import { selectIsLoggedIn, useAuthStore } from '@/features/auth';
import { useAppTranslation } from '@/shared/i18n';
import { semanticColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import { startVoiceSession } from '../controller/voiceController';
import { isVoiceSessionActive } from '../domain/voiceStatus';
import { useVoiceStore } from '../store/voiceStore';

/**
 * 聊天輸入列的麥克風（對應 Web `AIChatBot.tsx` 的 mic 按鈕）：未登入時提示登入（語音 `session.start` 需要 token）；
 * 已有 session（切回文字後）則回到語音面板，不另開一條（後端同帳號第二條連線會把第一條踢掉，4409）。
 */
export default function VoiceMicButton() {
  const { t } = useAppTranslation();
  const tones = semanticColors(useColorScheme() === 'dark');
  const loggedIn = useAuthStore(selectIsLoggedIn);
  const status = useVoiceStore((s) => s.status.status);
  const setViewMode = useVoiceStore((s) => s.setViewMode);

  const onPress = () => {
    if (isVoiceSessionActive(status) && status !== 'error' && status !== 'needs-login') {
      setViewMode('panel');
      return;
    }
    if (!loggedIn) {
      Alert.alert(t('chatbot.voice.loginRequired'), undefined, [
        { text: t('cancel'), style: 'cancel' },
        { text: t('auth.login'), onPress: () => router.push('/auth') },
      ]);
      return;
    }
    startVoiceSession(t);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('chatbot.voice.micLabel')}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.button, { backgroundColor: tones.accentSoft }, pressed && styles.pressed]}>
      <Icon name="mic" size={18} color={tones.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
