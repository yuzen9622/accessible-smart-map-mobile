import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toolDoneLabel, toolLoadingLabel } from '@/features/ai';
import { useAppTranslation } from '@/shared/i18n';
import { useFontScale } from '@/shared/preferences';
import { ACCENT_FILL, DANGER_FILL, MIN_TOUCH, ON_ACCENT_FILL, RADIUS, TYPE, scaledSize, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Icon, type IconName } from '@/shared/ui';

import { dismissVoiceSession, endVoiceSession, resumeVoicePlayback, toggleVoiceMute } from '../controller/voiceController';
import { waveformLevel, waveformMode } from '../domain/audioLevel';
import { getVoiceStatusLabel, isTerminalVoiceStatus } from '../domain/voiceStatus';
import { useVoiceStore, type VoiceLaunchOrigin } from '../store/voiceStore';
import VoiceWaveform from './VoiceWaveform';

/** 音波中央與兩側的顏色：一律藍色系，深色模式改用亮藍、兩側往背景收。 */
const WAVE_COLORS = {
  light: { center: ACCENT_FILL, edge: '#A8CFF5' },
  dark: { center: '#6BB2FF', edge: '#1F4A7A' },
} as const;
const WAVE_HEIGHT = 128;
/** 按下語音鈕後多久內掛載的才算「從按鈕進來」；過期的起點（例如當時連線沒成功）不重播飛入。 */
const LAUNCH_TTL_MS = 2000;
/** 量不到按鈕／音波位置時，最多等這麼久就改用一般淡入，畫面不會卡在全透明。 */
const MEASURE_TIMEOUT_MS = 400;

/** render 期間只讀不寫（寫 store 會在 render 中觸發其他元件更新）；清除在掛載後的 effect。 */
function readLaunchOrigin(reduceMotion: boolean): VoiceLaunchOrigin | null {
  const origin = useVoiceStore.getState().launchOrigin;
  if (reduceMotion || !origin || Date.now() - origin.at > LAUNCH_TTL_MS) return null;
  return origin;
}
const CONTROL_SIZE = 72;

/** 過場：語音按鈕（視窗座標）→ 音波中央（本畫面座標）。 */
interface MorphPath {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  size: number;
}

function ControlButton({
  icon,
  label,
  accessibilityLabel,
  onPress,
  background,
  foreground,
}: {
  icon: IconName;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  background: string;
  foreground: string;
}) {
  const fontScale = useFontScale();
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.control, pressed && styles.pressed]}>
      <View style={[styles.controlCircle, { backgroundColor: background }]}>
        <Icon name={icon} size={28} color={foreground} />
      </View>
      <Text numberOfLines={1} style={[styles.controlLabel, { color: colors.text, fontSize: scaledSize(TYPE.subhead, fontScale) }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * 聊天 modal 裡的語音模式（對應 Web `components/Voice/VoiceModeView.tsx`，版面依設計稿 3b「即時大字幕」）：
 * 上方狀態＋目前工具、中間逐字稿（助理最新一句用大字幕，較早的縮小變淡）、下方一整排音波與靜音／結束兩顆 72pt 控制鈕。
 * 結束＝回到打字：這段逐字稿與工具結果會併進文字對話（controller `mergeIntoChat`），接著打字 AI 接得上。
 * 音波聆聽時跟麥克風音量、助理說話時跟實際播放音量。
 *
 * 從輸入列的語音按鈕進來時（`launchOrigin`），按鈕先飛到音波中央、再攤平成整排直條，文字聊天在底下淡出。
 */
export default function VoiceModeView() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const tones = useSemanticColors();
  const wave = isDark ? WAVE_COLORS.dark : WAVE_COLORS.light;
  const fontScale = useFontScale();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const status = useVoiceStore((s) => s.status);
  const transcripts = useVoiceStore((s) => s.transcripts);
  const activeTool = useVoiceStore((s) => s.activeTool);
  const micLevel = useVoiceStore((s) => s.micLevel);
  const modelLevel = useVoiceStore((s) => s.modelLevel);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const scrollRef = useRef<ScrollView>(null);
  const rootRef = useRef<View>(null);
  const waveRef = useRef<View>(null);
  // 過場起點只在掛載時讀一次並清掉（下次從膠囊回來不再重播飛入）；量測逾時就放棄（設回 null 改走淡入）
  const [origin, setOrigin] = useState<VoiceLaunchOrigin | null>(() => readLaunchOrigin(reduceMotion));
  const [morph, setMorph] = useState<MorphPath | null>(null);

  const backdrop = useSharedValue(0);
  const content = useSharedValue(0);
  const reveal = useSharedValue(0);
  const flight = useSharedValue(0);
  const flatten = useSharedValue(0);

  const terminal = isTerminalVoiceStatus(status.status) || status.status === 'ended';
  const statusLabel = getVoiceStatusLabel(status, t);
  const level = waveformLevel(status.status, micLevel, modelLevel, isMuted);
  const mode = waveformMode(status.status, isMuted);
  const latestModelId = [...transcripts].reverse().find((entry) => entry.role === 'model')?.id;
  const hint =
    status.status === 'connecting'
      ? t('chatbot.voice.connectingHint')
      : status.status === 'listening' || status.status === 'ready'
        ? t('chatbot.voice.listeningHint')
        : null;

  useEffect(() => {
    useVoiceStore.getState().setLaunchOrigin(null);
  }, []);

  useEffect(() => {
    if (origin) return; // 等量到音波位置再開始（measureWave）
    backdrop.set(withTiming(1, { duration: 180 }));
    content.set(withTiming(1, { duration: reduceMotion ? 0 : 260 }));
    reveal.set(reduceMotion ? 1 : withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }));
  }, [backdrop, content, origin, reduceMotion, reveal]);

  useEffect(() => {
    if (!origin || morph) return;
    const timer = setTimeout(() => setOrigin(null), MEASURE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [morph, origin]);

  useEffect(() => {
    if (!morph || !origin) return;
    const ease = Easing.out(Easing.cubic);
    backdrop.set(withTiming(1, { duration: 240 }));
    flight.set(withTiming(1, { duration: 360, easing: ease }));
    flatten.set(withDelay(300, withTiming(1, { duration: 280, easing: Easing.in(Easing.quad) })));
    reveal.set(withDelay(320, withTiming(1, { duration: 560, easing: Easing.out(Easing.quad) })));
    content.set(withDelay(200, withTiming(1, { duration: 420, easing: ease })));
  }, [backdrop, content, flatten, flight, morph, origin, reveal]);

  const measureWave = (_event: LayoutChangeEvent) => {
    if (!origin || morph) return;
    rootRef.current?.measureInWindow((rootX, rootY) => {
      waveRef.current?.measureInWindow((waveX, waveY, waveWidth, waveHeight) => {
        setMorph({
          fromX: origin.x - rootX,
          fromY: origin.y - rootY,
          toX: waveX - rootX + waveWidth / 2,
          toY: waveY - rootY + waveHeight / 2,
          size: origin.size,
        });
      });
    });
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: content.value,
    transform: [{ translateY: interpolate(content.value, [0, 1], [-12, 0]) }],
  }));
  const controlsStyle = useAnimatedStyle(() => ({
    opacity: content.value,
    transform: [{ translateY: interpolate(content.value, [0, 1], [28, 0]) }],
  }));
  const morphStyle = useAnimatedStyle(() => {
    if (!morph) return { opacity: 0 };
    const x = interpolate(flight.value, [0, 1], [morph.fromX, morph.toX]);
    // 往上飛時帶一點弧度，不走直線
    const y = interpolate(flight.value, [0, 1], [morph.fromY, morph.toY]) - Math.sin(flight.value * Math.PI) * 40;
    const grow = interpolate(flight.value, [0, 1], [1, 1.9]);
    return {
      opacity: interpolate(flatten.value, [0, 0.7, 1], [1, 0.6, 0]),
      transform: [
        { translateX: x - morph.size / 2 },
        { translateY: y - morph.size / 2 },
        { scaleX: grow * interpolate(flatten.value, [0, 1], [1, 4]) },
        { scaleY: grow * interpolate(flatten.value, [0, 1], [1, 0.18]) },
      ],
    };
  });
  const morphIconStyle = useAnimatedStyle(() => ({ opacity: interpolate(flight.value, [0, 0.5], [1, 0], 'clamp') }));

  return (
    // 疊在聊天畫面上的全版覆蓋層：VoiceOver 焦點只在覆蓋層內（底下的聊天另以 no-hide-descendants 隱藏給 TalkBack）
    <View ref={rootRef} collapsable={false} accessibilityViewIsModal style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }, backdropStyle]} />

      <Animated.View style={[styles.main, contentStyle]}>
        <View style={styles.header}>
          <Text
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            style={[
              styles.status,
              {
                color: status.status === 'error' || status.status === 'needs-login' ? tones.danger.fg : colors.text,
                fontSize: scaledSize(TYPE.headline, fontScale),
              },
            ]}>
            {statusLabel}
          </Text>
          {activeTool ? (
            <View accessibilityLiveRegion="polite" style={styles.tool}>
              <Icon
                name={activeTool.type === 'call' ? 'loader' : 'check'}
                size={14}
                color={activeTool.type === 'call' ? colors.textSecondary : tones.ok.fg}
              />
              <Text numberOfLines={1} style={[styles.toolText, { color: colors.textSecondary, fontSize: scaledSize(TYPE.subhead, fontScale) }]}>
                {activeTool.type === 'call' ? toolLoadingLabel(activeTool.name, t) : toolDoneLabel(activeTool.name, t)}
              </Text>
            </View>
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
          contentContainerStyle={[styles.transcriptContent, transcripts.length === 0 && styles.transcriptEmpty]}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {transcripts.length === 0 && hint ? (
            <Text style={[styles.hint, { color: colors.textSecondary, fontSize: scaledSize(26, fontScale), lineHeight: scaledSize(34, fontScale) }]}>
              {hint}
            </Text>
          ) : null}
          {transcripts.map((entry) => {
            if (entry.role === 'user') {
              return (
                <View
                  key={entry.id}
                  accessible
                  accessibilityLabel={`${t('chatbot.voice.transcriptUser')}：${entry.text}`}
                  style={styles.userEntry}>
                  <Text style={[styles.youSaid, { color: colors.textSecondary, fontSize: scaledSize(TYPE.subhead, fontScale) }]}>
                    {t('chatbot.voice.youSaid')}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: scaledSize(17, fontScale), lineHeight: scaledSize(24, fontScale) }}>
                    {entry.text}
                  </Text>
                </View>
              );
            }
            const latest = entry.id === latestModelId;
            return (
              <Text
                key={entry.id}
                accessibilityLabel={`${t('chatbot.voice.transcriptModel')}：${entry.text}`}
                style={[
                  latest ? styles.captionLatest : styles.captionOld,
                  {
                    color: latest ? colors.text : colors.textSecondary,
                    fontSize: scaledSize(latest ? 28 : 19, fontScale),
                    lineHeight: scaledSize(latest ? 38 : 27, fontScale),
                  },
                ]}>
                {entry.text}
              </Text>
            );
          })}
        </ScrollView>
      </Animated.View>

      <View ref={waveRef} collapsable={false} onLayout={measureWave} style={styles.wave}>
        <VoiceWaveform
          level={level}
          mode={terminal ? 'flat' : mode}
          color={terminal ? tones.neutral.fg : wave.center}
          edgeColor={terminal ? tones.neutral.bg : wave.edge}
          height={WAVE_HEIGHT}
          reveal={reveal}
        />
      </View>

      <Animated.View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 12) }, controlsStyle]}>
        {terminal ? (
          <ControlButton
            icon="close"
            label={t('close')}
            accessibilityLabel={t('close')}
            onPress={dismissVoiceSession}
            background={tones.neutral.bg}
            foreground={colors.text}
          />
        ) : (
          <>
            <ControlButton
              icon={isMuted ? 'volumeOff' : 'volumeOn'}
              label={isMuted ? t('nativeVoiceUnmute') : t('nativeVoiceMute')}
              accessibilityLabel={isMuted ? t('nativeVoiceUnmute') : t('nativeVoiceMute')}
              onPress={toggleVoiceMute}
              background={isMuted ? tones.warn.bg : tones.neutral.bg}
              foreground={isMuted ? tones.warn.fg : colors.text}
            />
            <ControlButton
              icon="close"
              label={t('chatbot.voice.endShort')}
              accessibilityLabel={t('chatbot.voice.endSession')}
              onPress={endVoiceSession}
              background={DANGER_FILL}
              foreground={ON_ACCENT_FILL}
            />
          </>
        )}
      </Animated.View>

      {morph && origin ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.morph, { width: morph.size, height: morph.size, borderRadius: morph.size / 2 }, morphStyle]}>
          <Animated.View style={morphIconStyle}>
            <Icon name="audioLines" size={morph.size * 0.5} color={ON_ACCENT_FILL} strokeWidth={2.4} />
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  main: { flex: 1 },
  header: { alignItems: 'center', gap: 4, paddingTop: 16, paddingHorizontal: 24 },
  status: { fontWeight: '700', textAlign: 'center' },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  toolText: { flexShrink: 1, fontWeight: '500' },
  resume: { borderRadius: RADIUS.pill, paddingHorizontal: 16, minHeight: MIN_TOUCH, justifyContent: 'center', marginTop: 6 },
  transcripts: { flex: 1 },
  transcriptContent: { paddingHorizontal: 24, paddingVertical: 20, gap: 18 },
  transcriptEmpty: { flexGrow: 1, justifyContent: 'center' },
  hint: { fontWeight: '600', textAlign: 'center' },
  userEntry: { gap: 2 },
  youSaid: { fontWeight: '600' },
  captionLatest: { fontWeight: '700' },
  captionOld: { fontWeight: '600' },
  wave: { height: WAVE_HEIGHT + 24, alignItems: 'center', justifyContent: 'center' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 56, paddingHorizontal: 16, paddingTop: 12 },
  control: { alignItems: 'center', gap: 8, minWidth: CONTROL_SIZE + 16 },
  controlCircle: { width: CONTROL_SIZE, height: CONTROL_SIZE, borderRadius: CONTROL_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  controlLabel: { fontWeight: '600', textAlign: 'center' },
  morph: { position: 'absolute', left: 0, top: 0, backgroundColor: ACCENT_FILL, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
