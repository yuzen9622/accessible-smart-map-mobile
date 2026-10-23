import { Text } from '@/shared/ui/typography/Text';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { candidateDeparture, formatRouteClock } from '@/features/route/domain';
import { useAppTranslation } from '@/shared/i18n';
import { MAX_FONT_SCALE, TYPE, useSemanticColors, useThemeColors, SHAPE } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import type { BusDepartureChooserProps } from './BusDepartureChooser.types';
import { BUS_ON_ACCENT_COLOR } from './palette';

export type BusDepartureChooserVariant = 'ios' | 'material';

interface BaseProps extends BusDepartureChooserProps {
  variant: BusDepartureChooserVariant;
  /** 換班次時的觸覺回饋（iOS selection／Android segment tick）。 */
  onFeedback: () => void;
}

/**
 * 「可搭乘的班次」（Google Maps 的下一班列）：同一組上下車站之間每一班車一張小卡，橫向捲動，
 * 依後端順序排列。大字是「幾分後到」（即時）或發車時刻（時刻表），下方標出資料來源與低地板。
 * 點一張只是「查看」那班的時刻，導航仍搭規劃的那班（後端沒有改選班次的 API，對齊 Web）。
 * 整組是 radiogroup：VoiceOver／TalkBack 念「5 路公車，8 分鐘後到站，即時資料，已選取」。
 */
export default function BusDepartureChooserBase({ candidates, viewed, legColor, now, onView, variant, onFeedback }: BaseProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  const interactive = candidates.length > 1;

  return (
    <View style={styles.root}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textSecondary }]} maxFontSizeMultiplier={MAX_FONT_SCALE.label}>
        {t('nativeBusDeparturesTitle')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('nativeBusDeparturesTitle')}
        accessibilityHint={interactive ? t('nativeBusDeparturesHint') : undefined}
        contentContainerStyle={styles.strip}>
        {candidates.map((candidate) => {
          const checked = candidate.candidateId === viewed?.candidateId;
          const departure = candidateDeparture(candidate, now);
          const live = departure.kind === 'live';
          const arriving = live && departure.minutes <= 1;
          const alight = formatRouteClock(candidate.alightingTime);
          const lowFloor = candidate.vehicleAccessibility === 'low_floor';
          const timeA11y =
            departure.kind === 'live'
              ? arriving
                ? t('nativeBusDepartureArrivingA11y')
                : t('nativeBusDepartureLiveA11y', { count: departure.minutes })
              : departure.kind === 'scheduled'
                ? t('nativeBusDepartureScheduledA11y', { time: departure.clock })
                : t('nativeBusDepartureUnknown');
          const label = [
            t('nativeBusDepartureRoute', { route: candidate.routeName }),
            timeA11y,
            alight ? t('nativeBusDepartureAlightA11y', { time: alight }) : null,
            lowFloor ? t('nativeBusDepartureLowFloor') : null,
            candidate.selected ? t('nativeBusDeparturePlanned') : null,
          ]
            .filter(Boolean)
            .join('，');
          const tone = live ? semantic.ok.fg : colors.textSecondary;
          return (
            <Pressable
              key={candidate.candidateId}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked, disabled: !interactive }}
              disabled={!interactive}
              onPress={() => {
                if (checked) return;
                onFeedback();
                onView(candidate);
              }}
              android_ripple={variant === 'material' ? { color: semantic.accentSoft, borderless: false } : undefined}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: checked ? semantic.accentSoft : semantic.surface, borderColor: checked ? legColor : 'transparent' },
                pressed && variant === 'ios' && styles.pressed,
              ]}>
              <View style={styles.tileHeader}>
                <View style={[styles.routeBadge, { backgroundColor: legColor }]}>
                  <Text style={styles.routeBadgeText} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE.label}>
                    {candidate.routeName}
                  </Text>
                </View>
                {candidate.selected ? (
                  <Icon name="navigation" size={13} color={semantic.accent} />
                ) : null}
              </View>
              <Text
                style={[styles.time, { color: arriving ? semantic.ok.fg : colors.text }]}
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONT_SCALE.label}>
                {departure.kind === 'live'
                  ? arriving
                    ? t('nativeBusDepartureArriving')
                    : t('nativeBusDepartureMinutes', { count: departure.minutes })
                  : departure.kind === 'scheduled'
                    ? departure.clock
                    : '--:--'}
              </Text>
              <View style={styles.meta}>
                {live ? <Icon name="live" size={11} color={tone} /> : null}
                <Text style={[styles.metaText, { color: tone }]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE.label}>
                  {live ? t('nativeBusDepartureLive') : departure.kind === 'scheduled' ? t('nativeBusDepartureScheduled') : t('nativeBusDepartureUnknown')}
                </Text>
                {lowFloor ? <Icon name="accessibility" size={12} color={semantic.ok.fg} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  title: { fontSize: TYPE.footnote, fontWeight: '600' },
  strip: { gap: 8, paddingRight: 16 },
  tile: { minWidth: 96, borderRadius: SHAPE.card, borderCurve: 'continuous', borderWidth: 2, paddingHorizontal: 12, paddingVertical: 10, gap: 4, overflow: 'hidden' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  tileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  routeBadge: { borderRadius: SHAPE.badge, borderCurve: 'continuous', paddingHorizontal: 7, paddingVertical: 2, maxWidth: 200 },
  routeBadgeText: { color: BUS_ON_ACCENT_COLOR, fontSize: TYPE.footnote, fontWeight: '700' },
  time: { fontSize: TYPE.title3, fontWeight: '700', fontVariant: ['tabular-nums'] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: TYPE.caption, fontWeight: '600' },
});
