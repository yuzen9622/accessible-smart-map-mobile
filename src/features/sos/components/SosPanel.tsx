import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { useAppTranslation } from '@/shared/i18n';
import { useFontScale } from '@/shared/preferences';
import { scaledSize, useThemeColors } from '@/shared/theme';
import { Icon, type IconName } from '@/shared/ui';

import type { SosFlowModel } from '../hooks/useSosFlow';

/**
 * SOS 畫面（iOS／Android 共用 RN 實作）。
 * 為什麼不用 SwiftUI Form：倒數環、64 pt 以上的大型觸控目標（SDD §10）與高對比紅底需要自訂版面，
 * 系統表單元件做不到；依 ADR-15「原生做不到時用 RN 並寫明理由」。
 */

const SOS_RED = '#C62828';
const SOS_RED_DARK = '#8E0000';
const WHITE = '#FFFFFF';
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
  const background = tone === 'danger' ? SOS_RED : tone === 'light' ? WHITE : 'transparent';
  const foreground = tone === 'danger' ? WHITE : tone === 'light' ? SOS_RED_DARK : colors.text;
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
      <Text style={[styles.bigButtonText, { color: foreground, fontSize: scaledSize(18, scale) }]}>{label}</Text>
    </Pressable>
  );
}

function CountdownRing({ progress, seconds }: { progress: number; seconds: number }) {
  const r = 70;
  const circumference = 2 * Math.PI * r;
  return (
    <View style={styles.ringWrap} accessible accessibilityRole="timer" accessibilityLabel={`${seconds}`}>
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
      <Text style={styles.ringText}>{seconds}</Text>
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
  return <Text style={[styles.label, { color: colors.textSecondary, fontSize: scaledSize(13, scale) }]}>{children}</Text>;
}

function Body({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  const colors = useThemeColors();
  const scale = useFontScale();
  return (
    <Text style={{ color: colors.text, fontSize: scaledSize(17, scale), fontWeight: bold ? '700' : '400' }}>{children}</Text>
  );
}

export default function SosPanel({ model }: { model: SosFlowModel }) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const scale = useFontScale();
  const pad = { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 };

  if (!model.loggedIn) {
    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, pad]}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          SOS
        </Text>
        <Body>{t('nativeSosLoginRequired')}</Body>
        <BigButton label={t('sosCall110')} icon="phone" tone="danger" onPress={model.call110} />
        <BigButton label={t('sosCall119')} icon="phone" tone="danger" onPress={model.call119} />
        <BigButton label={t('loginRegisterCta')} tone="outline" onPress={model.login} />
        <BigButton label={t('close')} tone="outline" onPress={model.minimize} />
      </ScrollView>
    );
  }

  if (model.phase === 'countdown' || model.phase === 'idle') {
    return (
      <View style={[styles.countdown, pad]}>
        <Text accessibilityRole="header" style={styles.countdownTitle}>
          {t('sosCountdownTitle')}
        </Text>
        <Text style={styles.countdownDesc}>{t('sosCountdownDesc')}</Text>
        <CountdownRing progress={model.progress} seconds={model.secondsLeft} />
        <Text style={styles.countdownDesc}>{t('sosCountdownHint')}</Text>
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
        <Text accessibilityRole="header" style={styles.countdownTitle}>
          {t('sosActiveTitle')}
        </Text>
        <BigButton label={t('cancel')} tone="light" onPress={model.cancelCreating} />
      </View>
    );
  }

  if (model.phase === 'resolved') {
    return (
      <View style={[styles.content, styles.center, pad, { backgroundColor: colors.background, flex: 1 }]}>
        <Icon name="shieldCheck" size={56} color={colors.text} />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
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
      <View style={[styles.activeHeader, { backgroundColor: SOS_RED }]} accessible accessibilityLiveRegion="polite">
        <View style={styles.pulse} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={[styles.activeTitle, { fontSize: scaledSize(22, scale) }]}>
            {t('sosActiveTitle')}
          </Text>
          <Text style={[styles.activeSummary, { fontSize: scaledSize(16, scale) }]}>{model.summaryText}</Text>
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
            <Text style={styles.linkText}>{t('sosManageContactsLink')}</Text>
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
                style={[styles.chip, { borderColor: selected ? SOS_RED : colors.textSecondary, backgroundColor: selected ? SOS_RED : 'transparent' }]}>
                <Text style={{ color: selected ? WHITE : colors.text, fontSize: scaledSize(15, scale) }}>{chip.label}</Text>
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
                <Text style={{ color: colors.textSecondary, fontSize: scaledSize(14, scale) }}>{entry.time}</Text>
                <Text style={[styles.flex, { color: colors.text, fontSize: scaledSize(15, scale) }]}>{entry.text}</Text>
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
  content: { padding: 16, gap: 14 },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
  title: { fontSize: 28, fontWeight: '800' },
  bigButton: {
    minHeight: BIG_TARGET,
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  bigButtonText: { fontWeight: '700' },
  pressed: { opacity: 0.7 },
  countdown: { flex: 1, backgroundColor: SOS_RED_DARK, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 18 },
  countdownTitle: { color: WHITE, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  countdownDesc: { color: WHITE, fontSize: 17, textAlign: 'center' },
  countdownActions: { alignSelf: 'stretch', gap: 14 },
  ringWrap: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  ringText: { position: 'absolute', color: WHITE, fontSize: 64, fontWeight: '800' },
  activeHeader: { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pulse: { width: 14, height: 14, borderRadius: 7, backgroundColor: WHITE },
  activeTitle: { color: WHITE, fontWeight: '800' },
  activeSummary: { color: WHITE, marginTop: 2 },
  card: { borderRadius: 14, padding: 14, gap: 6 },
  label: { fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { minHeight: 44, borderRadius: 22, borderWidth: 1.5, paddingHorizontal: 14, justifyContent: 'center' },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { color: '#1565C0', fontSize: 16, fontWeight: '600' },
  disclosure: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timelineRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
});
