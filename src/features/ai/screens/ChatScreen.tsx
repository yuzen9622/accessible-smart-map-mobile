import { useEffect, type ReactNode } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTranslation } from '@/shared/i18n';
import { useCloseScreen } from '@/shared/navigation';
import { useFontScale } from '@/shared/preferences';
import { TYPE, scaledSize, semanticColors, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import ChatComposer from '../components/ChatComposer';
import ChatMessageItem from '../components/ChatMessageItem';
import { openAiResult, registerChatDismiss } from '../controller/actionExecutor';
import { sendChatMessage, stopChatStreaming } from '../controller/chatController';
import { useChatStore } from '../store/chatStore';

/**
 * AI 聊天（SDD §6.6：全螢幕 modal、inverted 列表、鍵盤避讓）。對齊 Web `AIChatBot.tsx`：
 * 開場白＋免責說明、建議 chips（還沒問過問題時）、串流訊息與工具時間軸、送出／停止。
 * 清除對話在導覽列（`app/chat.tsx`）。
 */
export interface ChatScreenProps {
  /**
   * 語音模式畫面（voice feature，由 app 路由注入；ai 不 import voice，voice 依賴 ai）。有值時蓋在文字對話上
   * （文字對話留在底下，語音畫面自己的過場淡入時才看得到它淡出），文字對話同時對輔助技術隱藏。
   */
  voicePanel?: ReactNode;
  /** 輸入列的附加按鈕（語音麥克風）。 */
  composerAccessory?: ReactNode;
  /** 預填到輸入框的問題（不自動送出：外部連結不能代替使用者發問）。 */
  initialPrompt?: string;
}

export default function ChatScreen({ initialPrompt, voicePanel, composerAccessory }: ChatScreenProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const tones = semanticColors(isDark);
  const fontScale = useFontScale();
  const insets = useSafeAreaInsets();
  const entries = useChatStore((state) => state.entries);
  const isLoading = useChatStore((state) => state.isLoading);
  // inverted：最新一則在資料頭、畫在最下面，串流長高時不必手動捲動
  const data = [...entries].reverse();
  const suggestions = entries.length === 0 ? [t('nativeAiSuggestion1'), t('nativeAiSuggestion2'), t('nativeAiSuggestion3')] : [];

  const closeScreen = useCloseScreen();
  // AI action（開路線面板、點結果卡）要關掉的是這個 modal，不是當下最上層的任何畫面
  useEffect(() => registerChatDismiss(closeScreen), [closeScreen]);

  const send = (text: string) => void sendChatMessage(text, t);

  const voiceOpen = voicePanel != null && voicePanel !== false;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        accessibilityElementsHidden={voiceOpen}
        importantForAccessibility={voiceOpen ? 'no-hide-descendants' : 'auto'}
        pointerEvents={voiceOpen ? 'none' : 'auto'}
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 56 : 0}>
        <FlatList
          data={data}
          inverted={entries.length > 0}
          keyExtractor={(entry) => entry.id}
          renderItem={({ item }) => <ChatMessageItem entry={item} isDark={isDark} onOpenResult={openAiResult} />}
          contentContainerStyle={[styles.list, entries.length === 0 && styles.emptyList]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={
            <View style={styles.greeting}>
              <View style={[styles.greetingIcon, { backgroundColor: tones.accentSoft }]}>
                <Icon name="sparkles" size={28} color={tones.accent} />
              </View>
              <Text
                accessibilityRole="header"
                style={[styles.greetingText, { color: colors.text, fontSize: scaledSize(TYPE.body, fontScale) }]}>
                {t('assistFirstMessage')}
              </Text>
              <Text style={[styles.disclaimer, { color: colors.textSecondary, fontSize: scaledSize(TYPE.caption, fontScale) }]}>
                {t('AIwarning')}
              </Text>
            </View>
          }
        />
        <View style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
          <ChatComposer
            // 換了預填問題（modal 已開著時再開深層連結）就重建輸入框，讓新問題填進去
            key={initialPrompt ?? ''}
            isDark={isDark}
            isLoading={isLoading}
            placeholder={t('nativeAiPlaceholder')}
            sendLabel={t('nativeAiSend')}
            stopLabel={t('nativeAiStop')}
            suggestions={suggestions}
            initialText={initialPrompt}
            accessory={composerAccessory}
            onSend={send}
            onStop={stopChatStreaming}
          />
        </View>
      </KeyboardAvoidingView>
      {voiceOpen ? (
        <Animated.View exiting={FadeOut.duration(180)} style={StyleSheet.absoluteFill}>
          {voicePanel}
        </Animated.View>
      ) : null}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { paddingHorizontal: 16, paddingVertical: 16 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  separator: { height: 18 },
  greeting: { alignItems: 'center', gap: 12, paddingHorizontal: 12 },
  greetingIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  greetingText: { textAlign: 'center', fontWeight: '600', lineHeight: 24 },
  disclaimer: { textAlign: 'center' },
});
