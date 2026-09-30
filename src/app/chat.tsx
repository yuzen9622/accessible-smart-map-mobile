import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ChatScreen, clearChat, useChatStore } from '@/features/ai';
import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors } from '@/shared/theme';
import { HeaderCloseButton, Icon } from '@/shared/ui';

function ClearButton() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const empty = useChatStore((state) => state.entries.length === 0);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('chatbot.clearConversation')}
      accessibilityState={{ disabled: empty }}
      disabled={empty}
      onPress={clearChat}
      hitSlop={8}
      style={({ pressed }) => [styles.button, (pressed || empty) && styles.dim]}>
      <Icon name="trash" size={20} color={colors.text} />
    </Pressable>
  );
}

export default function ChatRoute() {
  const { t } = useAppTranslation();
  const { q } = useLocalSearchParams<{ q?: string }>();
  return (
    <>
      <Stack.Screen
        options={{ title: t('assist'), headerLeft: () => <HeaderCloseButton />, headerRight: () => <ClearButton /> }}
      />
      <ChatScreen initialPrompt={typeof q === 'string' ? q.slice(0, 500) : undefined} />
    </>
  );
}

const styles = StyleSheet.create({
  button: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.4 },
});
