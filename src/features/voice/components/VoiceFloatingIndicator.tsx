import { router, usePathname } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { useFontScale } from '@/shared/preferences';
import { TYPE, scaledSize, useSemanticColors, useThemeColors, SHAPE, ICON_SIZE } from '@/shared/theme';
import { GlassCard, Icon } from '@/shared/ui';

import { dismissVoiceSession, endVoiceSession } from '../controller/voiceController';
import { waveformLevelSource, waveformMode } from '../domain/audioLevel';
import { getVoiceStatusLabel, isTerminalVoiceStatus, shouldShowVoicePill } from '../domain/voiceStatus';
import { voiceLevelFor } from '../store/voiceLevels';
import { useVoiceStore } from '../store/voiceStore';
import VoiceWaveform from './VoiceWaveform';
import PressableScale from '@/shared/ui/PressableScale';

/**
 * 地圖上的語音膠囊（對應 Web `VoiceFloatingIndicator.tsx`）：聊天 modal 關著、或使用者「切回文字」時顯示，
 * 讓語音對話在看地圖、看路線時繼續。迷你音波跟著麥克風／助理播放音量跳動；點膠囊回到語音面板，X 結束對話。
 */
export default function VoiceFloatingIndicator() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const tones = useSemanticColors();
  const fontScale = useFontScale();
  const pathname = usePathname();
  const routeSyncState = useVoiceStore((s) => s.routeSyncState);
  const status = useVoiceStore((s) => s.status);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const viewMode = useVoiceStore((s) => s.viewMode);
  const setViewMode = useVoiceStore((s) => s.setViewMode);
  const chatOpen = pathname === '/chat';

  if (!shouldShowVoicePill(status.status, chatOpen, viewMode)) return null;
  const label = routeSyncState === 'pending' ? t('nativeRouteSyncPending') : routeSyncState === 'error' ? t('nativeRouteSyncError') : getVoiceStatusLabel(status, t);
  const terminal = isTerminalVoiceStatus(status.status);

  const expand = () => {
    setViewMode('panel');
    if (!chatOpen) router.navigate('/chat');
  };

  return (
    <GlassCard style={styles.card} interactive>
      <View style={styles.row}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${label}，${t('chatbot.voice.pillExpand')}`}
          onPress={expand}
          style={styles.main}>
          <VoiceWaveform
            level={voiceLevelFor(waveformLevelSource(status.status, isMuted))}
            mode={terminal || routeSyncState === 'pending' || routeSyncState === 'error' ? 'flat' : waveformMode(status.status, isMuted)}
            color={terminal ? tones.neutral.fg : tones.accent}
            edgeColor={terminal ? tones.neutral.fg : tones.accent}
            height={20}
            barCount={5}
            barWidth={3}
            gap={2}
          />
          {isMuted ? <Icon name="volumeOff" size={ICON_SIZE.body} color={colors.text} /> : null}
          <Text numberOfLines={1} style={[styles.label, { color: colors.text, fontSize: scaledSize(TYPE.footnote, fontScale) }]}>
            {label}
          </Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={terminal ? t('close') : t('chatbot.voice.endSession')}
          onPress={terminal ? dismissVoiceSession : endVoiceSession}
          hitSlop={8}
          style={[styles.close, { backgroundColor: tones.neutral.bg }]}>
          <Icon name="close" size={ICON_SIZE.caption} color={colors.text} />
        </PressableScale>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: SHAPE.floating, borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, paddingRight: 8, minHeight: 44 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minHeight: 44 },
  label: { fontWeight: '600', flexShrink: 1 },
  close: { width: 28, height: 28, borderRadius: SHAPE.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
});
