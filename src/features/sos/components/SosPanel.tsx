import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { useAppTranslation } from '@/shared/i18n';
import { useFontScale } from '@/shared/preferences';
import {
  DANGER_FILL,
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

import type { SosFlowModel } from '../hooks/useSosFlow';

/**
 * SOS 畫面（iOS／Android 共用 RN 實作）。
 * 為什麼不用 SwiftUI Form：倒數環、64 pt 以上的大型觸控目標（SDD §10）與高對比紅底需要自訂版面，
 * 系統表單元件做不到；依 ADR-15「原生做不到時用 RN 並寫明理由」。
 *
 * 2026-10 重做：原本整個檔案沒用到 `shared/theme` 的設計 token（間距、圓角、字級都是自己寫的數字，
 * 連顏色都另外寫死一份跟 `DANGER_FILL` 重複的紅），跟其餘畫面的視覺語言對不起來，使用者回報「介面設計
 * 有問題」。改成跟 onboarding／地點詳情一樣的卡片＋token 版型；倒數／求救中這兩個全版紅色畫面刻意
 * 保留滿版強烈紅——這是真實世界緊急 UI 的慣例（對齊 Apple 自己的 Emergency SOS），不隨淺／深色模式
 * 變淡，否則倒數畫面在淺色模式會變成粉紅色、失去緊急感；但顏色來源改成 `DANGER_FILL` token，不再
 * 自己重複定義一份一樣的紅。
 */

const DANGER_DEEP = '#8E0000';
const WHITE = '#FFFFFF';
/** SOS 主按鈕／倒數取消鈕的最小尺寸（SDD §10：緊急操作 ≥ 64pt，比一般按鈕的 `BUTTON_HEIGHT` 50pt 更大）。 */
const BIG_TARGET = 64;

interface BigButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  tone?: 'danger' | 'light' | 'outline';
  hint?: string;
}

function BigButton({ label, onPress, icon, tone = 'light', hint }: BigButtonProps) {
  const scale = useFontScale();
  const colors = useThemeColors();
  const background = tone === 'danger' ? DANGER_FILL : tone === 'light' ? WHITE : 'transparent';
  const foreground = tone === 'danger' ? WHITE : tone === 'light' ? DANGER_DEEP : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.bigButton,
        { backgroundColor: background, borderColor: tone === 'outline' ? colors.textSecondary : background },
        pressed && styles.pressed,
      ]}>
      {icon ? <Icon name={icon} size={24} color={foreground} /> : null}
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.bigButtonText, { color: foreground, fontSize: scaledSize(TYPE.body, scale) }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function CountdownRing({ progress, seconds }: { progress: number; seconds: number }) {
  const { t } = useAppTranslation();
  const r = 70;
  const circumference = 2 * Math.PI * r;
  return (
    <View style={styles.ringWrap} accessible accessibilityRole="timer" accessibilityLabel={t('nativeSosCountdownSeconds', { count: seconds })}>
      <Svg width={180} height={180} viewBox="0 0 180 180">
        <Circle cx={90} cy={90} r={r} stroke="rgba(255,255,255,0.3)" strokeWidth={10} fill="none" />
        <Circle
          cx={90}
          cy={90}
          r={r}
          stroke={WHITE}
          strokeWidth={10}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, progress)))}
          strokeLinecap="round"
          transform="rotate(-90 90 90)"
        />
      </Svg>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={styles.ringText}>
        {seconds}
      </Text>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const colors = useThemeColors();
  return <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>{children}</View>;
}

function Label({ children }: { children: React.ReactNode }) {
  const colors = useThemeColors();
  const scale = useFontScale();
  return (
    <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.label, { color: colors.textSecondary, fontSize: scaledSize(TYPE.subhead, scale) }]}>
      {children}
    </Text>
  );
}

function Body({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  const colors = useThemeColors();
  const scale = useFontScale();
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE.body}
      style={{ color: colors.text, fontSize: scaledSize(TYPE.callout, scale), fontWeight: bold ? '700' : '400' }}>
      {children}
    </Text>
  );
}

/** 圓底圖示（對齊 onboarding 的 hero roundel）：強調色用語意危險色，不是整片實心紅——這兩個狀態是
 * 一般白底畫面（未登入、已解除），不需要倒數畫面那種滿版強烈紅。 */
function HeroIcon({ name }: { name: IconName }) {
  const tones = useSemanticColors();
  return (
    <View style={[styles.heroIcon, { backgroundColor: tones.danger.bg }]}>
      <Icon name={name} size={36} color={tones.danger.fg} strokeWidth={1.8} />
    </View>
  );
}

export default function SosPanel({ model }: { model: SosFlowModel }) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const tones = useSemanticColors();
  const insets = useSafeAreaInsets();
  const scale = useFontScale();
  const pad = { paddingTop: insets.top + SPACE.lg, paddingBottom: insets.bottom + SPACE.xl };

  if (!model.loggedIn) {
    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, pad]}>
        {/* 置中的警示標頭：以前左上角只有一個小小的「SOS」字，看不出這是緊急畫面 */}
        <View style={styles.hero}>
          <HeroIcon name="alert" />
          <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.heading} style={[styles.title, styles.centerText, { color: colors.text }]}>
            SOS
          </Text>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SCALE.body}
            style={[styles.centerText, { color: colors.textSecondary, fontSize: scaledSize(TYPE.body, scale), lineHeight: scaledSize(TYPE.body + 7, scale) }]}>
            {t('nativeSosLoginRequired')}
          </Text>
        </View>
        <BigButton label={t('sosCall110')} icon="phone" tone="danger" onPress={model.call110} />
        <BigButton label={t('sosCall119')} icon="phone" tone="danger" onPress={model.call119} />
        <View style={styles.spacer} />
        <BigButton label={t('loginRegisterCta')} tone="outline" onPress={model.login} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={model.minimize} style={styles.textButton}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.textButtonText, { color: colors.textSecondary, fontSize: scaledSize(TYPE.body, scale) }]}>
            {t('close')}
          </Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (model.phase === 'countdown' || model.phase === 'idle') {
    return (
      <View style={[styles.countdown, pad]}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.heading} style={styles.countdownTitle}>
          {t('sosCountdownTitle')}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={styles.countdownDesc}>
          {t('sosCountdownDesc')}
        </Text>
        <CountdownRing progress={model.progress} seconds={model.secondsLeft} />
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={styles.countdownDesc}>
          {t('sosCountdownHint')}
        </Text>
        <View style={styles.countdownActions}>
          <BigButton label={t('sosCountdownCancel')} icon="close" tone="light" onPress={model.cancelCountdown} />
          <BigButton label={t('sosSendNow')} icon="siren" tone="outline" onPress={model.sendNow} />
        </View>
      </View>
    );
  }

  if (model.phase === 'creating') {
    return (
      <View style={[styles.countdown, pad]}>
        <ActivityIndicator size="large" color={WHITE} />
        <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.heading} style={styles.countdownTitle}>
          {t('sosActiveTitle')}
        </Text>
        <BigButton label={t('cancel')} tone="light" onPress={model.cancelCreating} />
      </View>
    );
  }

  if (model.phase === 'resolved') {
    return (
      <View style={[styles.content, styles.center, pad, { backgroundColor: colors.background, flex: 1 }]}>
        <HeroIcon name="shieldCheck" />
        <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.heading} style={[styles.title, { color: colors.text }]}>
          {t('sosResolvedTitle')}
        </Text>
        <Body>{t('sosResolvedDesc')}</Body>
        <BigButton label={t('sosClose')} tone="outline" onPress={model.closeResolved} />
      </View>
    );
  }

  const chips: { type: 'body' | 'trapped' | 'share_location'; label: string }[] = [
    { type: 'body', label: t('sosBodyDiscomfort') },
    { type: 'trapped', label: t('sosTrapped') },
    { type: 'share_location', label: t('sosFall') },
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, pad]}>
      <View style={[styles.activeHeader, { backgroundColor: DANGER_FILL }]} accessible accessibilityLiveRegion="polite">
        <View style={styles.pulse} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.heading} style={[styles.activeTitle, { fontSize: scaledSize(TYPE.headline, scale) }]}>
            {t('sosActiveTitle')}
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.activeSummary, { fontSize: scaledSize(TYPE.body, scale) }]}>
            {model.summaryText}
          </Text>
        </View>
      </View>

      {model.backgroundDenied ? (
        <Card>
          <Body>{t('nativeSosBackgroundDenied')}</Body>
        </Card>
      ) : null}
      {model.locationSyncFailed ? (
        <Card>
          <Body>{t('sosLocationSyncFailed')}</Body>
        </Card>
      ) : null}

      <Card>
        <Label>{t('sosHandlingLabel')}</Label>
        <Body bold>{model.handlingLabel}</Body>
        <Body>{model.waitingText}</Body>
      </Card>

      <View style={styles.row}>
        <View style={styles.flex}>
          <BigButton label={t('sosCall110')} icon="phone" tone="danger" onPress={model.call110} />
        </View>
        <View style={styles.flex}>
          <BigButton label={t('sosCall119')} icon="phone" tone="danger" onPress={model.call119} />
        </View>
      </View>

      <Card>
        <Label>{t('sosNotifiedContacts')}</Label>
        <Body>{model.notifiedText}</Body>
        {!model.hasBoundContacts ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('sosManageContactsLink')} onPress={model.manageContacts} style={styles.link}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.linkText, { color: tones.accent }]}>
              {t('sosManageContactsLink')}
            </Text>
          </Pressable>
        ) : null}
      </Card>

      <Card>
        <Label>{t('sosCurrentLocation')}</Label>
        <Body>{model.addressText}</Body>
      </Card>

      <Card>
        <Label>{t('sosSupplementType')}</Label>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {chips.map((chip) => {
            const selected = model.supplementedType === chip.type;
            return (
              <Pressable
                key={chip.type}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={chip.label}
                onPress={() => model.setSupplementedType(chip.type)}
                style={[styles.chip, { borderColor: selected ? DANGER_FILL : colors.textSecondary, backgroundColor: selected ? DANGER_FILL : 'transparent' }]}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={{ color: selected ? WHITE : colors.text, fontSize: scaledSize(TYPE.callout, scale) }}>
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <BigButton label={t('sosManualShareLabel')} icon="share" tone="outline" onPress={model.share} />

      <Card>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: model.timelineOpen }}
          accessibilityLabel={t('sosTimelineLabel')}
          onPress={model.toggleTimeline}
          style={styles.disclosure}>
          <Body bold>{t('sosTimelineLabel')}</Body>
          <Icon name={model.timelineOpen ? 'chevronUp' : 'chevronDown'} color={colors.text} />
        </Pressable>
        {model.timelineOpen
          ? model.timeline.map((entry) => (
              <View key={entry.key} style={styles.timelineRow} accessible>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={{ color: colors.textSecondary, fontSize: scaledSize(TYPE.subhead, scale) }}>
                  {entry.time}
                </Text>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.flex, { color: colors.text, fontSize: scaledSize(TYPE.callout, scale) }]}>
                  {entry.text}
                </Text>
              </View>
            ))
          : null}
      </Card>

      <BigButton label={t('sosResolveButton')} icon="shieldCheck" tone="danger" onPress={model.resolve} />
      <BigButton label={t('nativeSosMinimize')} tone="outline" hint={t('nativeSosMinimizeHint')} onPress={model.minimize} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACE.lg, gap: SPACE.md + 2 },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: SPACE.md },
  title: { fontSize: TYPE.title + 8, fontWeight: '800' },
  centerText: { textAlign: 'center' },
  hero: { alignItems: 'center', gap: SPACE.sm + 2, paddingTop: SPACE.xl, paddingBottom: SPACE.lg },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { height: SPACE.sm },
  textButton: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  textButtonText: { fontWeight: '600' },
  bigButton: {
    minHeight: BIG_TARGET,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm + 2,
    paddingHorizontal: SPACE.lg,
  },
  bigButtonText: { fontWeight: '700' },
  pressed: { opacity: 0.7 },
  countdown: { flex: 1, backgroundColor: DANGER_DEEP, alignItems: 'center', justifyContent: 'center', padding: SPACE.xl, gap: SPACE.lg + 2 },
  countdownTitle: { color: WHITE, fontSize: TYPE.title + 4, fontWeight: '800', textAlign: 'center' },
  countdownDesc: { color: WHITE, fontSize: TYPE.body + 1, textAlign: 'center' },
  countdownActions: { alignSelf: 'stretch', gap: SPACE.lg - 2 },
  ringWrap: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  ringText: { position: 'absolute', color: WHITE, fontSize: 64, fontWeight: '800' },
  activeHeader: { borderRadius: RADIUS.card, padding: SPACE.lg, flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  pulse: { width: 14, height: 14, borderRadius: RADIUS.pill, backgroundColor: ON_ACCENT_FILL },
  activeTitle: { color: WHITE, fontWeight: '800' },
  activeSummary: { color: WHITE, marginTop: 2 },
  card: { borderRadius: RADIUS.card, padding: SPACE.md + 2, gap: SPACE.xs + 2 },
  label: { fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.xs },
  chip: { minHeight: MIN_TOUCH, borderRadius: RADIUS.pill, borderWidth: 1.5, paddingHorizontal: SPACE.md + 2, justifyContent: 'center' },
  link: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  linkText: { fontSize: TYPE.body, fontWeight: '600' },
  disclosure: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timelineRow: { flexDirection: 'row', gap: SPACE.sm + 2, paddingVertical: SPACE.xs },
});
