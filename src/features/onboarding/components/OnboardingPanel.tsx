import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFontScale } from '@/shared/preferences';
import {
  ACCENT_FILL,
  MAX_FONT_SCALE,
  MIN_TOUCH,
  ON_ACCENT_FILL,
  RADIUS,
  SPACE,
  TYPE,
  scaledSize,
  useSemanticColors,
  useThemeColors,
} from '@/shared/theme';
import { Icon, type IconName } from '@/shared/ui';

import type { FontSizeOption } from '../hooks/useOnboardingFlow';
import type { OnboardingPanelProps } from './OnboardingPanel.types';

/** onboarding 第 2 步六個情況對應的圖示；純裝飾，意義由卡片文字提供。 */
const SITUATION_ICON: Record<string, IconName> = {
  wheelchair: 'accessibility',
  walker: 'personStanding',
  vision: 'eye',
  slow: 'footprints',
  stroller: 'baby',
  companion: 'users',
};

/**
 * Onboarding 畫面（全平台共用，不分 iOS／Android）：取代原本的 SwiftUI `Form`／RN `Form` 兩套、
 * 各自看起來像「設定頁」的實作。這是使用者打開 App 看到的第一個畫面，刻意跟系統表單拉開距離：
 * 全螢幕卡片式版面、每步一個強調色圓底圖示、圓點進度（取代純文字「第 X 步」）、步驟間淡入轉場，
 * 按鈕統一用 App 真正的品牌色（`ACCENT_FILL`）而不是先前 `shared/ui/Button` 的黑白單色
 * （那顆元件只有這裡在用，黑白跟其他畫面的藍色主色對不上——這正是重做的起因）。
 *
 * 新增字級步驟（Web 沒有、原本的 onboarding 也沒有）：App 層級字級倍率藏在設定頁深處，
 * 但看不清楚字的人往往撐不到找到設定頁就先放棄了。放進 onboarding，選了馬上用一張
 * 真實情境的預覽卡看到效果，而不是盲選一個「中」或「大」的抽象標籤。
 */
export default function OnboardingPanel({ model, backLabel, skipLabel }: OnboardingPanelProps) {
  const colors = useThemeColors();
  const tones = useSemanticColors();
  const scale = useFontScale();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const entering = reduceMotion ? undefined : FadeIn.duration(220);

  const title: Record<typeof model.stepId, string> = {
    intro: model.intro.title,
    fontSize: model.fontSize.title,
    needs: model.needs.title,
    location: model.location.title,
    done: model.done.title,
  };
  const subtitle: Record<typeof model.stepId, string | null> = {
    intro: model.intro.body,
    fontSize: model.fontSize.subtitle,
    needs: null,
    location: null,
    done: model.done.subtitle,
  };
  const heroIcon: Record<typeof model.stepId, IconName> = {
    intro: 'accessibility',
    fontSize: 'type',
    needs: 'users',
    location: 'mapPinned',
    done: 'sparkles',
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        {model.canGoBack ? (
          <Pressable
            onPress={model.onBack}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            hitSlop={8}
            style={styles.headerSideButton}>
            <Icon name="chevronLeft" size={22} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.headerSideButton} />
        )}
        <View style={styles.dots} accessible accessibilityLabel={model.progressText}>
          {Array.from({ length: model.totalSteps }, (_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: index === model.stepIndex ? tones.accent : colors.backgroundElement,
                  width: index === model.stepIndex ? 20 : 7,
                },
              ]}
            />
          ))}
        </View>
        <Pressable
          onPress={model.onSkip}
          accessibilityRole="button"
          accessibilityLabel={skipLabel}
          hitSlop={8}
          style={styles.headerSideButton}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.skipText, { color: colors.textSecondary, fontSize: scaledSize(TYPE.callout, scale) }]}>
            {skipLabel}
          </Text>
        </Pressable>
      </View>

      <Animated.View key={model.stepId} style={styles.flex} entering={entering}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { backgroundColor: tones.accentSoft }]}>
            <Icon name={heroIcon[model.stepId]} size={36} color={tones.accent} strokeWidth={1.8} />
          </View>
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={MAX_FONT_SCALE.heading}
            style={[styles.title, { color: colors.text, fontSize: scaledSize(TYPE.title, scale) }]}>
            {title[model.stepId]}
          </Text>
          {subtitle[model.stepId] ? (
            <Text
              maxFontSizeMultiplier={MAX_FONT_SCALE.body}
              style={[styles.subtitle, { color: colors.textSecondary, fontSize: scaledSize(TYPE.body, scale) }]}>
              {subtitle[model.stepId]}
            </Text>
          ) : null}

          {model.stepId === 'fontSize' ? <FontSizeStep model={model.fontSize} /> : null}
          {model.stepId === 'needs' ? <NeedsStep model={model.needs} /> : null}
          {model.stepId === 'location' ? <LocationStep model={model.location} /> : null}
          {model.stepId === 'done' ? <DoneStep model={model.done} /> : null}
        </ScrollView>
      </Animated.View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACE.lg, borderTopColor: colors.backgroundElement }]}>
        {model.stepId === 'intro' ? <PrimaryButton label={model.intro.startLabel} onPress={model.intro.onStart} /> : null}
        {model.stepId === 'fontSize' ? <PrimaryButton label={model.fontSize.nextLabel} onPress={model.fontSize.onNext} /> : null}
        {model.stepId === 'needs' ? <PrimaryButton label={model.needs.nextLabel} onPress={model.needs.onNext} /> : null}
        {model.stepId === 'location' ? <LocationFooter model={model.location} /> : null}
        {model.stepId === 'done' ? <PrimaryButton label={model.done.startLabel} onPress={model.done.onStart} /> : null}
      </View>
    </View>
  );
}

function FontSizeStep({ model }: { model: OnboardingPanelProps['model']['fontSize'] }) {
  const colors = useThemeColors();
  const tones = useSemanticColors();
  return (
    <View style={styles.fontSizeBlock}>
      <View style={styles.fontChoiceRow}>
        {model.options.map((option: FontSizeOption) => (
          <Pressable
            key={option.value}
            onPress={() => model.onSelect(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: option.selected }}
            accessibilityLabel={option.label}
            style={[
              styles.fontChoice,
              {
                backgroundColor: option.selected ? ACCENT_FILL : colors.backgroundElement,
                borderColor: option.selected ? ACCENT_FILL : 'transparent',
              },
            ]}>
            <Text
              maxFontSizeMultiplier={MAX_FONT_SCALE.label}
              style={{
                color: option.selected ? ON_ACCENT_FILL : colors.text,
                fontSize: Math.min(scaledSize(TYPE.body, option.scale), 26),
                fontWeight: option.selected ? '700' : '500',
              }}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 即時預覽：真實情境（地點卡）而不是抽象的「這是中字級」，選完馬上知道效果。 */}
      <View style={[styles.previewCard, { backgroundColor: colors.backgroundElement }]}>
        <View style={styles.previewPin}>
          <Icon name="mapPin" size={18} color={tones.danger.fg} />
        </View>
        <View style={styles.flex}>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SCALE.body}
            style={{ color: colors.text, fontWeight: '700', fontSize: scaledSize(TYPE.body, model.scale) }}>
            {model.previewTitle}
          </Text>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SCALE.body}
            style={{ color: colors.textSecondary, fontSize: scaledSize(TYPE.subhead, model.scale), marginTop: 2 }}>
            {model.previewAddress}
          </Text>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SCALE.body}
            style={{ color: colors.textSecondary, fontSize: scaledSize(TYPE.subhead, model.scale), marginTop: 2 }}>
            {model.previewMeta}
          </Text>
          <View style={[styles.previewButton, { backgroundColor: ACCENT_FILL }]}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={{ color: ON_ACCENT_FILL, fontWeight: '700', fontSize: scaledSize(TYPE.callout, model.scale) }}>
              {model.previewButtonLabel}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function NeedsStep({ model }: { model: OnboardingPanelProps['model']['needs'] }) {
  const colors = useThemeColors();
  const tones = useSemanticColors();
  const scale = useFontScale();
  return (
    <View style={styles.needsBlock}>
      <View style={styles.needsGrid}>
        {model.options.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => model.onToggle(option.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: option.selected }}
            accessibilityLabel={`${option.label}，${option.description}`}
            style={[
              styles.needCard,
              {
                backgroundColor: option.selected ? tones.accentSoft : colors.backgroundElement,
                borderColor: option.selected ? tones.accent : 'transparent',
              },
            ]}>
            <Icon name={SITUATION_ICON[option.id] ?? 'accessibility'} size={22} color={option.selected ? tones.accent : colors.textSecondary} />
            <Text
              maxFontSizeMultiplier={MAX_FONT_SCALE.label}
              style={{ color: colors.text, fontWeight: '700', fontSize: scaledSize(TYPE.callout, scale), marginTop: SPACE.sm }}>
              {option.label}
            </Text>
            <Text
              maxFontSizeMultiplier={MAX_FONT_SCALE.body}
              style={{ color: colors.textSecondary, fontSize: scaledSize(TYPE.subhead, scale), marginTop: 2 }}>
              {option.description}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text
        accessibilityLiveRegion="polite"
        maxFontSizeMultiplier={MAX_FONT_SCALE.body}
        style={{ color: colors.textSecondary, fontSize: scaledSize(TYPE.subhead, scale), marginTop: SPACE.lg, textAlign: 'center' }}>
        {model.derivedModeText ?? model.hint}
      </Text>
    </View>
  );
}

function LocationStep({ model }: { model: OnboardingPanelProps['model']['location'] }) {
  const colors = useThemeColors();
  const tones = useSemanticColors();
  const scale = useFontScale();
  return (
    <View style={styles.locationBlock}>
      {model.benefits.map((benefit) => (
        <View key={benefit} style={styles.benefitRow}>
          <Icon name="check" size={16} color={tones.ok.fg} strokeWidth={2.5} />
          <Text
            maxFontSizeMultiplier={MAX_FONT_SCALE.body}
            style={{ color: colors.text, fontSize: scaledSize(TYPE.body, scale), flex: 1 }}>
            {benefit}
          </Text>
        </View>
      ))}
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE.body}
        style={{ color: colors.textSecondary, fontSize: scaledSize(TYPE.subhead, scale), marginTop: SPACE.md, textAlign: 'center' }}>
        {model.privacy}
      </Text>
      {model.outcomeText ? (
        <Text
          accessibilityLiveRegion="polite"
          maxFontSizeMultiplier={MAX_FONT_SCALE.body}
          style={{ color: tones.accent, fontWeight: '700', fontSize: scaledSize(TYPE.body, scale), marginTop: SPACE.lg, textAlign: 'center' }}>
          {model.outcomeText}
        </Text>
      ) : null}
    </View>
  );
}

function LocationFooter({ model }: { model: OnboardingPanelProps['model']['location'] }) {
  if (model.state === 'granted' || model.state === 'denied' || model.state === 'unsupported') {
    return <PrimaryButton label={model.nextLabel} onPress={model.onNext} />;
  }
  return (
    <>
      <PrimaryButton label={model.allowLabel} onPress={model.onRequest} loading={model.state === 'requesting'} />
      <SecondaryButton label={model.manualLabel} onPress={model.onNext} disabled={model.state === 'requesting'} />
    </>
  );
}

function DoneStep({ model }: { model: OnboardingPanelProps['model']['done'] }) {
  const colors = useThemeColors();
  const tones = useSemanticColors();
  const scale = useFontScale();
  const rows: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'toilet', label: model.tryToiletLabel, onPress: model.onTryToilet },
    { icon: 'route', label: model.tryRouteLabel, onPress: model.onTryRoute },
    { icon: 'sparkles', label: model.tryAiLabel, onPress: model.onTryAi },
  ];
  return (
    <View style={styles.doneBlock}>
      {rows.map((row) => (
        <Pressable
          key={row.icon}
          onPress={row.onPress}
          accessibilityRole="button"
          accessibilityLabel={row.label}
          style={[styles.doneRow, { backgroundColor: colors.backgroundElement }]}>
          <View style={[styles.doneRowIcon, { backgroundColor: tones.accentSoft }]}>
            <Icon name={row.icon} size={18} color={tones.accent} />
          </View>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={{ color: colors.text, fontWeight: '600', fontSize: scaledSize(TYPE.body, scale), flex: 1 }}>
            {row.label}
          </Text>
          <Icon name="chevronRight" size={18} color={colors.textSecondary} />
        </Pressable>
      ))}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const scale = useFontScale();
  return (
    <Pressable
      onPress={loading ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor: ACCENT_FILL, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={{ color: ON_ACCENT_FILL, fontWeight: '700', fontSize: scaledSize(TYPE.body, scale) }}>
        {loading ? '…' : label}
      </Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const colors = useThemeColors();
  const scale = useFontScale();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.secondaryButton, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={{ color: colors.textSecondary, fontWeight: '600', fontSize: scaledSize(TYPE.callout, scale) }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.sm,
    height: 52,
  },
  headerSideButton: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontWeight: '600' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 7, borderRadius: RADIUS.pill },
  content: { padding: SPACE.xl, alignItems: 'center', flexGrow: 1 },
  hero: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.lg,
  },
  title: { fontWeight: '800', textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: SPACE.sm, lineHeight: 22 },
  footer: { paddingHorizontal: SPACE.xl, paddingTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth, gap: SPACE.sm },
  primaryButton: {
    minHeight: 52,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },

  fontSizeBlock: { width: '100%', marginTop: SPACE.lg, gap: SPACE.lg },
  fontChoiceRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SPACE.sm },
  fontChoice: {
    minHeight: 48,
    minWidth: 64,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCard: {
    width: '100%',
    flexDirection: 'row',
    gap: SPACE.md,
    padding: SPACE.lg,
    borderRadius: RADIUS.card,
  },
  previewPin: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  previewButton: { alignSelf: 'flex-start', marginTop: SPACE.sm, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.pill },

  needsBlock: { width: '100%', marginTop: SPACE.lg },
  needsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, justifyContent: 'space-between' },
  needCard: {
    width: '47%',
    minHeight: 112,
    borderRadius: RADIUS.card,
    borderWidth: 2,
    padding: SPACE.md,
  },

  locationBlock: { width: '100%', marginTop: SPACE.lg, gap: SPACE.sm },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },

  doneBlock: { width: '100%', marginTop: SPACE.lg, gap: SPACE.sm },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: 56,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACE.md,
  },
  doneRowIcon: { width: 36, height: 36, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
});
