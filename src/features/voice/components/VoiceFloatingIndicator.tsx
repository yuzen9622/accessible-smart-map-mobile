import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withSpring } from 'react-native-reanimated';

import { useAppTranslation } from '@/shared/i18n';
import { useFontScale } from '@/shared/preferences';
import { DANGER_FILL, TYPE, scaledSize, semanticColors, useThemeColors } from '@/shared/theme';
import { GlassCard, Icon } from '@/shared/ui';

import { dismissVoiceSession, endVoiceSession } from '../controller/voiceController';
import { recordingDotPresentation } from '../domain/audioLevel';
import { getVoiceStatusLabel, isTerminalVoiceStatus, shouldShowVoicePill } from '../domain/voiceStatus';
import { useVoiceStore } from '../store/voiceStore';

/**
 * 地圖上的語音膠囊（對應 Web `VoiceFloatingIndicator.tsx`）：聊天 modal 關著、或使用者「切回文字」時顯示，
 * 讓語音對話在看地圖、看路線時繼續。紅點隨麥克風音量縮放；點膠囊回到語音面板，X 結束對話。
 */
export default function VoiceFloatingIndicator() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const tones = semanticColors(useColorScheme() === 'dark');
  const fontScale = useFontScale();
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();
  const status = useVoiceStore((s) => s.status);
  const micLevel = useVoiceStore((s) => s.micLevel);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const viewMode = useVoiceStore((s) => s.viewMode);
  const setViewMode = useVoiceStore((s) => s.setViewMode);
  const chatOpen = pathname === '/chat';
  const dot = recordingDotPresentation(isMuted ? 0 : micLevel, status.status, reduceMotion);
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: withSpring(dot.scale, { damping: 14 }) }] }));

  if (!shouldShowVoicePill(status.status, chatOpen, viewMode)) return null;
  const label = getVoiceStatusLabel(status, t);
  const terminal = isTerminalVoiceStatus(status.status);

  const expand = () => {
    setViewMode('panel');
    if (!chatOpen) router.push('/chat');
  };

  return (
    <GlassCard style={styles.card} interactive>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}，${t('chatbot.voice.pillExpand')}`}
          onPress={expand}
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
          <Animated.View style={[styles.dot, { backgroundColor: terminal ? tones.neutral.fg : DANGER_FILL }, dotStyle]} />
          <Icon name={isMuted ? 'volumeOff' : 'mic'} size={16} color={colors.text} />
          <Text numberOfLines={1} style={[styles.label, { color: colors.text, fontSize: scaledSize(TYPE.subhead, fontScale) }]}>
            {label}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={terminal ? t('close') : t('chatbot.voice.endSession')}
          onPress={terminal ? dismissVoiceSession : endVoiceSession}
          hitSlop={8}
          style={({ pressed }) => [styles.close, { backgroundColor: tones.neutral.bg }, pressed && styles.pressed]}>
          <Icon name="close" size={14} color={colors.text} />
        </Pressable>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, paddingRight: 8, minHeight: 44 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minHeight: 44 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontWeight: '600', flexShrink: 1 },
  close: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
