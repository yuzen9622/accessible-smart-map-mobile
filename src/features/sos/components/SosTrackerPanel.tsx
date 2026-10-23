import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { useFontScale } from '@/shared/preferences';
import { BUTTON_HEIGHT, DANGER_FILL, MAX_FONT_SCALE, MIN_TOUCH, ON_ACCENT_FILL, SPACE, TYPE, scaledSize, useSemanticColors, useThemeColors, SHAPE } from '@/shared/theme';
import { Icon, type IconName } from '@/shared/ui';

import type { SosTrackerPanelProps, SosTrackerProgressStep } from './SosTrackerPanel.types';
import PressableScale from '@/shared/ui/PressableScale';

/**
 * 家人端即時求助追蹤（iOS／Android 共用 RN 實作，地圖 sheet 內）。
 * 為什麼不用 SwiftUI Form：處理進度條、位置新鮮度警示、64pt 緊急按鈕需要自訂版面（ADR-15）。
 *
 * 版面依「家人點開通知後最想知道的順序」排：對方在哪、多久前的位置 → 現在誰在處理 → 我能做什麼。
 * 緊急色一律用 `DANGER_FILL`／語意色 token；狀態不只靠顏色（每一步都有圖示與文字）。
 */

/** 緊急操作的觸控目標（SDD §10：≥ 64pt）。 */
const BIG_TARGET = 64;

interface ActionButtonProps {
  label: string;
  icon: IconName;
  onPress: () => void;
  tone: 'danger' | 'dangerSoft' | 'neutral';
  hint?: string;
  big?: boolean;
}

function ActionButton({ label, icon, onPress, tone, hint, big }: ActionButtonProps) {
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  const scale = useFontScale();
  const background = tone === 'danger' ? DANGER_FILL : tone === 'dangerSoft' ? semantic.danger.bg : semantic.surface;
  const foreground = tone === 'danger' ? ON_ACCENT_FILL : tone === 'dangerSoft' ? semantic.danger.fg : colors.text;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={[styles.action,
        { backgroundColor: background, minHeight: big ? BIG_TARGET : BUTTON_HEIGHT }]}>
      <Icon name={icon} size={big ? 24 : 20} color={foreground} />
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE.label}
        style={[styles.actionText, { color: foreground, fontSize: scaledSize(big ? TYPE.title3 : TYPE.body, scale) }]}>
        {label}
      </Text>
    </PressableScale>
  );
}

function ProgressStep({ step, index, total, last }: { step: SosTrackerProgressStep; index: number; total: number; last: boolean }) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  const scale = useFontScale();
  const dotColor = step.state === 'done' ? semantic.ok.fg : step.state === 'current' ? semantic.accent : semantic.neutral.fg;
  const stateText =
    step.state === 'done' ? t('nativeSosTrackerStepDone') : step.state === 'current' ? t('nativeSosTrackerStepCurrent') : '';
  return (
    <View
      style={styles.step}
      accessible
      accessibilityLabel={t('nativeSosTrackerStepLabel', { index: index + 1, total, label: step.label, state: stateText })}>
      <View style={styles.stepRail}>
        <View
          style={[
            styles.stepDot,
            {
              borderColor: dotColor,
              backgroundColor: step.state === 'todo' ? 'transparent' : dotColor,
            },
          ]}>
          {step.state === 'done' ? <Icon name="check" size={14} strokeWidth={3} color={ON_ACCENT_FILL} /> : null}
        </View>
        {last ? null : (
          <View style={[styles.stepLine, { backgroundColor: step.state === 'done' ? semantic.ok.fg : semantic.separator }]} />
        )}
      </View>
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE.body}
        style={{
          color: step.state === 'todo' ? colors.textSecondary : colors.text,
          fontSize: scaledSize(TYPE.body, scale),
          fontWeight: step.state === 'current' ? '700' : '400',
        }}>
        {step.label}
      </Text>
    </View>
  );
}

function StatusIllustration({ icon, tone }: { icon: IconName; tone: 'ok' | 'neutral' | 'warn' }) {
  const semantic = useSemanticColors();
  return (
    <View style={[styles.illustration, { backgroundColor: semantic[tone].bg }]}>
      <Icon name={icon} size={36} color={semantic[tone].fg} />
    </View>
  );
}

export default function SosTrackerPanel({ model }: SosTrackerPanelProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  const scale = useFontScale();
  const active = model.phase === 'active' && model.addressText !== null;

  const ended = model.phase === 'resolved' || model.phase === 'notFound' || model.phase === 'expired' || model.invalidToken;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      {active ? (
        <View style={styles.hero}>
          <View style={[styles.liveChip, { backgroundColor: DANGER_FILL }]}>
            <Icon name="siren" size={16} color={ON_ACCENT_FILL} />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.liveChipText, { fontSize: scaledSize(TYPE.footnote, scale) }]}>
              {t('nativeSosTrackerActive')}
            </Text>
          </View>
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={MAX_FONT_SCALE.heading}
            style={[styles.heroTitle, { color: colors.text, fontSize: scaledSize(TYPE.title1, scale) }]}>
            {model.typeLabel}
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={{ color: colors.textSecondary, fontSize: scaledSize(TYPE.footnote, scale) }}>
            {t('nativeSosTrackerLiveHint')}
          </Text>
        </View>
      ) : (
        <View style={styles.headerRow}>
          <Icon name="siren" size={22} color={semantic.danger.fg} />
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={MAX_FONT_SCALE.heading}
            style={[styles.heroTitle, { color: colors.text, fontSize: scaledSize(TYPE.title3, scale) }]}>
            {model.title}
          </Text>
        </View>
      )}

      {model.phase === 'loading' ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator />
          <Text style={{ color: colors.textSecondary, fontSize: scaledSize(TYPE.body, scale) }}>{model.message}</Text>
        </View>
      ) : null}

      {ended ? (
        <View style={styles.centerBlock} accessible accessibilityLiveRegion="polite">
          <StatusIllustration icon={model.phase === 'resolved' ? 'shieldCheck' : 'circleX'} tone={model.phase === 'resolved' ? 'ok' : 'neutral'} />
          {model.phase === 'resolved' ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.heading} style={[styles.heroTitle, { color: colors.text, fontSize: scaledSize(TYPE.title3, scale) }]}>
              {t('sosResolvedTitle')}
            </Text>
          ) : null}
          <Text style={[styles.centerText, { color: colors.textSecondary, fontSize: scaledSize(TYPE.body, scale) }]}>{model.message}</Text>
        </View>
      ) : null}

      {model.phase === 'error' && !active ? (
        <View style={styles.centerBlock}>
          <StatusIllustration icon="wifiOff" tone="warn" />
          <Text accessibilityLiveRegion="polite" style={[styles.centerText, { color: colors.text, fontSize: scaledSize(TYPE.body, scale) }]}>
            {model.message}
          </Text>
          <ActionButton label={t('retry')} icon="refresh" tone="neutral" onPress={model.retry} />
        </View>
      ) : null}

      {active ? (
        <>
          <View style={[styles.card, { backgroundColor: semantic.surface }]} accessible>
            <View style={styles.cardLabelRow}>
              <Icon name="mapPin" size={16} color={semantic.danger.fg} />
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={{ color: colors.textSecondary, fontSize: scaledSize(TYPE.footnote, scale) }}>
                {t('sosTrackingRequesterLabel')}
              </Text>
            </View>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.address, { color: colors.text, fontSize: scaledSize(TYPE.title3, scale) }]}>
              {model.addressText}
            </Text>
            <View style={styles.cardLabelRow}>
              <Icon name="clock" size={14} color={model.stale ? semantic.warn.fg : colors.textSecondary} />
              <Text
                accessibilityLiveRegion="polite"
                maxFontSizeMultiplier={MAX_FONT_SCALE.label}
                style={{ color: model.stale ? semantic.warn.fg : colors.textSecondary, fontSize: scaledSize(TYPE.footnote, scale) }}>
                {model.freshnessText}
              </Text>
            </View>
            {model.stale ? (
              <View style={[styles.staleBanner, { backgroundColor: semantic.warn.bg }]}>
                <Icon name="alert" size={16} color={semantic.warn.fg} />
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.flexText, { color: semantic.warn.fg, fontSize: scaledSize(TYPE.footnote, scale) }]}>
                  {t('nativeSosTrackerStale')}
                </Text>
              </View>
            ) : null}
          </View>

          <ActionButton label={t('sosTrackingNavigate')} icon="navigation" tone="danger" big onPress={model.navigate} />
          <ActionButton label={t('sosTrackingLocate')} icon="crosshair" tone="neutral" onPress={model.locate} />

          {model.showProgress ? (
            <View style={[styles.card, { backgroundColor: semantic.surface }]}>
              <Text
                accessibilityRole="header"
                maxFontSizeMultiplier={MAX_FONT_SCALE.heading}
                style={[styles.sectionTitle, { color: colors.text, fontSize: scaledSize(TYPE.body, scale) }]}>
                {t('nativeSosTrackerProgressTitle')}
              </Text>
              {model.waitingForFamily ? (
                <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary, fontSize: scaledSize(TYPE.footnote, scale) }}>
                  {t('nativeSosTrackerWaiting')}
                </Text>
              ) : null}
              <View>
                {model.progressSteps.map((step, index) => (
                  <ProgressStep
                    key={step.key}
                    step={step}
                    index={index}
                    total={model.progressSteps.length}
                    last={index === model.progressSteps.length - 1}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {model.replyOnLine ? (
            <PressableScale feedback="highlight"
              accessibilityRole="button"
              accessibilityLabel={t('nativeSosTrackerReplyOnLine')}
              accessibilityHint={t('nativeSosTrackerReplyOnLineHint')}
              onPress={model.replyOnLine}
              style={[styles.lineRow, { backgroundColor: semantic.surface }]}>
              <View style={[styles.lineBadge, { backgroundColor: semantic.ok.bg }]}>
                <Icon name="messageSquare" size={20} color={semantic.ok.fg} />
              </View>
              <View style={styles.flexText}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.sectionTitle, { color: colors.text, fontSize: scaledSize(TYPE.body, scale) }]}>
                  {t('nativeSosTrackerReplyOnLine')}
                </Text>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={{ color: colors.textSecondary, fontSize: scaledSize(TYPE.footnote, scale) }}>
                  {t('nativeSosTrackerReplyOnLineHint')}
                </Text>
              </View>
              <Icon name="externalLink" size={18} color={colors.textSecondary} />
            </PressableScale>
          ) : null}

          <View style={styles.callsBlock}>
            <Text
              accessibilityRole="header"
              maxFontSizeMultiplier={MAX_FONT_SCALE.label}
              style={{ color: colors.textSecondary, fontSize: scaledSize(TYPE.footnote, scale) }}>
              {t('nativeSosTrackerEmergencyCalls')}
            </Text>
            <View style={styles.callsRow}>
              <View style={styles.flexText}>
                <ActionButton label={t('sosCall119')} icon="phone" tone="dangerSoft" onPress={model.call119} />
              </View>
              <View style={styles.flexText}>
                <ActionButton label={t('sosCall110')} icon="phone" tone="dangerSoft" onPress={model.call110} />
              </View>
            </View>
          </View>
        </>
      ) : null}

      <ActionButton label={t('close')} icon="close" tone="neutral" onPress={model.close} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACE.lg, paddingTop: SPACE.xl, gap: SPACE.md },
  hero: { gap: SPACE.xs, alignItems: 'flex-start' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: SHAPE.pill, borderCurve: 'continuous',
  },
  liveChipText: { color: ON_ACCENT_FILL, fontWeight: '700' },
  heroTitle: { fontWeight: '700' },
  centerBlock: { alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.lg },
  centerText: { textAlign: 'center' },
  illustration: { width: 72, height: 72, borderRadius: SHAPE.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: SHAPE.card, borderCurve: 'continuous', padding: SPACE.lg, gap: SPACE.sm },
  cardLabelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  address: { fontWeight: '700' },
  staleBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, borderRadius: SHAPE.control, borderCurve: 'continuous', padding: SPACE.md },
  sectionTitle: { fontWeight: '700' },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, minHeight: 40 },
  stepRail: { alignItems: 'center', width: 22 },
  stepDot: { width: 22, height: 22, borderRadius: SHAPE.pill, borderCurve: 'continuous', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, flex: 1, minHeight: 16, marginVertical: 2 },
  action: {
    borderRadius: SHAPE.card, borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    minWidth: MIN_TOUCH,
  },
  actionText: { fontWeight: '700' },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, borderRadius: SHAPE.card, borderCurve: 'continuous', padding: SPACE.lg, minHeight: MIN_TOUCH },
  lineBadge: { width: 40, height: 40, borderRadius: SHAPE.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  callsBlock: { gap: SPACE.sm },
  callsRow: { flexDirection: 'row', gap: SPACE.md },
  flexText: { flex: 1 },
});
