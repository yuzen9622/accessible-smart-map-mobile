import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toolDoneLabel, toolLoadingLabel } from '@/features/ai';
import { useAppTranslation } from '@/shared/i18n';
import { useFontScale } from '@/shared/preferences';
import { ACCENT_FILL, DANGER_FILL, MIN_TOUCH, ON_ACCENT_FILL, RADIUS, TYPE, scaledSize, semanticColors, useThemeColors } from '@/shared/theme';
import { Icon, type IconName } from '@/shared/ui';

import { dismissVoiceSession, endVoiceSession, resumeVoicePlayback, toggleVoiceMute } from '../controller/voiceController';
import { getVoiceStatusLabel, isTerminalVoiceStatus } from '../domain/voiceStatus';
import { useVoiceStore } from '../store/voiceStore';
import VoiceOrb from './VoiceOrb';

function ControlButton({
  icon,
  label,
  onPress,
  background,
  foreground,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  background: string;
  foreground: string;
}) {
  const fontScale = useFontScale();
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.control, pressed && styles.pressed]}>
      <View style={[styles.controlCircle, { backgroundColor: background }]}>
        <Icon name={icon} size={24} color={foreground} />
      </View>
      <Text numberOfLines={2} style={[styles.controlLabel, { color: colors.text, fontSize: scaledSize(TYPE.caption, fontScale) }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * 聊天 modal 裡的語音模式（對應 Web `components/Voice/VoiceModeView.tsx`）：上方狀態球＋狀態文字，
 * 中間逐字稿（使用者右、助理左，純文字、`accessibilityLiveRegion`），下方目前工具與控制列（靜音、結束、切回文字）。
 */
export default function VoiceModeView() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const tones = semanticColors(isDark);
  const fontScale = useFontScale();
  const insets = useSafeAreaInsets();
  const status = useVoiceStore((s) => s.status);
  const transcripts = useVoiceStore((s) => s.transcripts);
  const activeTool = useVoiceStore((s) => s.activeTool);
  const micLevel = useVoiceStore((s) => s.micLevel);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const setViewMode = useVoiceStore((s) => s.setViewMode);
  const scrollRef = useRef<ScrollView>(null);
  const terminal = isTerminalVoiceStatus(status.status) || status.status === 'ended';
  const statusLabel = getVoiceStatusLabel(status, t);
  const hint =
    status.status === 'connecting'
      ? t('chatbot.voice.connectingHint')
      : status.status === 'listening' || status.status === 'ready'
        ? t('chatbot.voice.listeningHint')
        : null;
  const orbColor = terminal ? tones.neutral.fg : status.status === 'model-speaking' ? '#7B3FE4' : ACCENT_FILL;

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.header}>
        <VoiceOrb status={status.status} micLevel={isMuted ? 0 : micLevel} color={orbColor} />
        <Text
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={[styles.status, { color: terminal && status.status === 'error' ? tones.danger.fg : colors.text, fontSize: scaledSize(TYPE.headline, fontScale) }]}>
          {statusLabel}
        </Text>
        {hint && transcripts.length === 0 ? (
          <Text style={{ color: colors.textSecondary, fontSize: scaledSize(TYPE.callout, fontScale) }}>{hint}</Text>
        ) : null}
        {status.status === 'playback-blocked' ? (
          <Pressable accessibilityRole="button" onPress={resumeVoicePlayback} style={[styles.resume, { backgroundColor: tones.accentSoft }]}>
            <Text style={{ color: tones.accent, fontWeight: '600' }}>{t('chatbot.voice.resumePlayback')}</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.transcripts}
        contentContainerStyle={styles.transcriptContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {transcripts.map((entry) => {
          const user = entry.role === 'user';
          return (
            <View
              key={entry.id}
              accessible
              accessibilityLabel={`${user ? t('chatbot.voice.transcriptUser') : t('chatbot.voice.transcriptModel')}：${entry.text}`}
              style={[styles.bubbleRow, user ? styles.userRow : styles.modelRow]}>
              <View style={[styles.bubble, { backgroundColor: user ? ACCENT_FILL : tones.surface }]}>
                <Text style={{ color: user ? ON_ACCENT_FILL : colors.text, fontSize: scaledSize(TYPE.body, fontScale), lineHeight: scaledSize(22, fontScale) }}>
                  {entry.text}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {activeTool ? (
        <View accessibilityLiveRegion="polite" style={[styles.tool, { backgroundColor: tones.surface }]}>
          <Icon name={activeTool.type === 'call' ? 'loader' : 'check'} size={16} color={activeTool.type === 'call' ? colors.textSecondary : tones.ok.fg} />
          <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: scaledSize(TYPE.subhead, fontScale), flexShrink: 1 }}>
            {activeTool.type === 'call' ? toolLoadingLabel(activeTool.name, t) : toolDoneLabel(activeTool.name, t)}
          </Text>
        </View>
      ) : null}

      <View style={styles.controls}>
        {terminal ? (
          <ControlButton icon="close" label={t('close')} onPress={dismissVoiceSession} background={tones.neutral.bg} foreground={colors.text} />
        ) : (
          <>
            <ControlButton
              icon={isMuted ? 'volumeOff' : 'volumeOn'}
              label={isMuted ? t('nativeVoiceUnmute') : t('nativeVoiceMute')}
              onPress={toggleVoiceMute}
              background={isMuted ? tones.warn.bg : tones.neutral.bg}
              foreground={isMuted ? tones.warn.fg : colors.text}
            />
            <ControlButton icon="close" label={t('chatbot.voice.endSession')} onPress={endVoiceSession} background={DANGER_FILL} foreground={ON_ACCENT_FILL} />
            <ControlButton
              icon="messageSquare"
              label={t('chatbot.voice.backToText')}
              onPress={() => setViewMode('pill')}
              background={tones.neutral.bg}
              foreground={colors.text}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { alignItems: 'center', gap: 6, paddingTop: 12 },
  status: { fontWeight: '700', textAlign: 'center' },
  resume: { borderRadius: RADIUS.pill, paddingHorizontal: 16, minHeight: 40, justifyContent: 'center', marginTop: 4 },
  transcripts: { flex: 1 },
  transcriptContent: { padding: 16, gap: 10 },
  bubbleRow: { flexDirection: 'row' },
  userRow: { justifyContent: 'flex-end', paddingLeft: 48 },
  modelRow: { justifyContent: 'flex-start', paddingRight: 48 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 8, maxWidth: '90%' },
  controls: { flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: 16, paddingTop: 8 },
  control: { alignItems: 'center', gap: 6, minWidth: MIN_TOUCH + 32 },
  controlCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  controlLabel: { fontWeight: '600', textAlign: 'center' },
  pressed: { opacity: 0.6 },
});
