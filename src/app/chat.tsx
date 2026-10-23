import { Stack, useLocalSearchParams } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';

import { ChatScreen, clearChat, useChatStore } from '@/features/ai';
import { VoiceMicButton, VoiceModeView, isVoiceSessionActive, useVoiceStore } from '@/features/voice';
import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors } from '@/shared/theme';
import { HeaderCloseButton, Icon } from '@/shared/ui';
import PressableScale from '@/shared/ui/PressableScale';

function ClearButton() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const empty = useChatStore((state) => state.entries.length === 0);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('chatbot.clearConversation')}
      accessibilityState={{ disabled: empty }}
      disabled={empty}
      onPress={clearChat}
      hitSlop={8}
      style={[styles.button, empty && styles.dim]}>
      <Icon name="trash" size={20} color={colors.text} />
    </PressableScale>
  );
}

export default function ChatRoute() {
  const { t } = useAppTranslation();
  const { q } = useLocalSearchParams<{ q?: string }>();
  // 語音 session 進行中且在面板模式：整個 modal 換成語音畫面（對齊 Web AIChatBot.tsx:296）
  const voiceActive = useVoiceStore((s) => isVoiceSessionActive(s.status.status) && s.viewMode === 'panel');
  return (
    <>
      <Stack.Screen
        options={{ title: t('assist'), headerLeft: () => <HeaderCloseButton />, headerRight: () => <ClearButton /> }}
      />
      <ChatScreen
        initialPrompt={typeof q === 'string' ? q.slice(0, 500) : undefined}
        voicePanel={voiceActive ? <VoiceModeView /> : null}
        composerAccessory={<VoiceMicButton />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // 同 HeaderCloseButton：iOS 26 導覽列的玻璃背景自帶內距，內容需與圖示同尺寸才會是正圓
  button: Platform.select({
    ios: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
    default: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  }),
  dim: { opacity: 0.4 },
});
