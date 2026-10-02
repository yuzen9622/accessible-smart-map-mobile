import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { useAppTranslation } from '@/shared/i18n';
import { useFontScale } from '@/shared/preferences';
import { ACCENT_FILL, ON_ACCENT_FILL, RADIUS, TYPE, scaledSize, useSemanticColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import { buildTraceRows, describeThinking, shouldShowTrace } from '../domain/thinkingTrace';
import { getAggregatedToolResults, type ToolResultItem } from '../domain/toolResultCards';
import type { ChatEntry } from '../store/chatStore';
import StreamingMarkdown from './StreamingMarkdown';
import ThinkingTrace from './ThinkingTrace';
import ToolResultsBox from './ToolResultsBox';

export interface ChatMessageItemProps {
  entry: ChatEntry;
  isDark: boolean;
  onOpenResult: (item: ToolResultItem) => void;
}

/**
 * 一則訊息（對齊 Web `AIChatBot.tsx` `ChatBubbleRow`）：使用者＝右側主色氣泡；AI＝全寬 markdown，
 * 上方工具時間軸、下方結果卡（串流結束後才出現，對齊 Web）。
 */
export default function ChatMessageItem({ entry, isDark, onOpenResult }: ChatMessageItemProps) {
  const { t } = useAppTranslation();
  const tones = useSemanticColors();
  const fontScale = useFontScale();
  const reduceMotion = useReducedMotion();
  const entering = reduceMotion ? undefined : FadeInDown.duration(240);
  const fromVoice = entry.source === 'voice';
  const voiceTag = fromVoice ? (
    <View style={styles.voiceTag} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Icon name="audioLines" size={12} color={tones.neutral.fg} />
      <Text style={{ color: tones.neutral.fg, fontSize: scaledSize(TYPE.caption, fontScale), fontWeight: '600' }}>
        {t('chatbot.voice.fromVoice')}
      </Text>
    </View>
  ) : null;
  const voicePrefix = fromVoice ? `${t('chatbot.voice.fromVoice')}，` : '';

  if (entry.role === 'user') {
    return (
      <Animated.View entering={entering} style={styles.userRow}>
        {voiceTag}
        <View
          accessible
          accessibilityLabel={`${voicePrefix}${t('nativeAiYou')}：${entry.content}`}
          style={[styles.userBubble, { backgroundColor: ACCENT_FILL }]}>
          <Text selectable style={{ color: ON_ACCENT_FILL, fontSize: scaledSize(TYPE.body, fontScale), lineHeight: scaledSize(22, fontScale) }}>
            {entry.content}
          </Text>
        </View>
      </Animated.View>
    );
  }

  const activities = entry.toolActivities ?? [];
  const streaming = entry.isStreaming === true;
  const header = describeThinking({
    activities,
    isStreaming: streaming,
    hasContent: entry.content.length > 0,
    thinkingMs: entry.thinkingMs,
    t,
  });
  const groups = streaming ? [] : getAggregatedToolResults(activities.filter((a) => a.status === 'done'), t);

  return (
    <Animated.View entering={entering} style={styles.assistantRow}>
      {voiceTag}
      {shouldShowTrace({ activities, header }) ? (
        <ThinkingTrace rows={buildTraceRows(activities, t)} header={header} isDark={isDark} />
      ) : null}
      {entry.content.length > 0 ? (
        entry.isError ? (
          <View accessibilityRole="alert" style={[styles.errorRow, { backgroundColor: tones.danger.bg }]}>
            <Icon name="circleX" size={16} color={tones.danger.fg} />
            <Text style={[styles.errorText, { color: tones.danger.fg, fontSize: scaledSize(TYPE.callout, fontScale) }]}>{entry.content}</Text>
          </View>
        ) : (
          <StreamingMarkdown content={entry.content} streaming={streaming} isDark={isDark} />
        )
      ) : null}
      {groups.length > 0 ? <ToolResultsBox groups={groups} isDark={isDark} onOpenItem={onOpenResult} /> : null}
      {entry.notice ? (
        <View accessibilityRole="alert" style={[styles.notice, { backgroundColor: tones.warn.bg }]}>
          <Icon name="info" size={16} color={tones.warn.fg} />
          <Text style={[styles.errorText, { color: tones.warn.fg, fontSize: scaledSize(TYPE.subhead, fontScale) }]}>{entry.notice}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  userRow: { alignItems: 'flex-end', paddingLeft: 48 },
  userBubble: { borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 9 },
  assistantRow: { alignItems: 'stretch', paddingRight: 8 },
  voiceTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: RADIUS.small, padding: 10 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: RADIUS.small, padding: 10, marginTop: 8 },
  errorText: { flex: 1, fontWeight: '500' },
});
