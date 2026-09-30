import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUserLocationStore } from '@/features/map';
import { formatDistance } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { ACCENT_FILL, ON_ACCENT_FILL, useThemeColors } from '@/shared/theme';
import { AnimatedNumberText, GlassCard, Icon } from '@/shared/ui';

import { localRerouteCoordinator } from '../controller/localRerouteCoordinator';
import { endNavigation } from '../controller/navigationSession';
import { rerouteStripText } from '../domain/hudProgress';
import { findLegHandoffIndex, isVehicleLegType, resolveActiveLegType } from '../domain/legMode';
import { stepIcon } from '../domain/navStepIcon';
import { useNavStore } from '../store/navStore';

const OK = '#1B7F3B';
const OK_DARK = '#4CD471';
const WARN = '#B25000';
const WARN_DARK = '#FF9F2E';
const DANGER = '#C02020';
const DANGER_DARK = '#FF6961';
const ACCENT = ACCENT_FILL;

/**
 * 導航 HUD（SDD §4.5「導航 HUD」、Web `NavigationHUD.tsx`；設計 1c 大字色塊）：疊在地圖上。
 * - 頂部：貼齊螢幕頂端（延伸到狀態列後方）的實心主色橫幅——64pt 轉向圖示、48pt 距離、22pt 指示文字（live region）、
 *   步驟進度／開車→步行交接提示；抵達時換成抵達橫幅。
 * - 橫幅下方：白色「接著」卡（下一步；資料沒有設施狀態就不編造，只顯示下一步的街名與距離）；
 *   偏航／重算時再加重算列（重新規劃／重試）；主動警報。
 * - 使用者拖曳地圖後出現「回到導航」。
 * 剩餘時間／預計抵達與語音、2D/3D、結束按鈕是 sheet 的收合列（`NavigationTripBar`），步驟清單在其下方，HUD 不重複。
 */
export default function NavigationHUD() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const tones = { ok: isDark ? OK_DARK : OK, warn: isDark ? WARN_DARK : WARN, danger: isDark ? DANGER_DARK : DANGER };
  const insets = useSafeAreaInsets();

  const instructions = useNavStore((s) => s.instructions);
  const currentStepIndex = useNavStore((s) => s.currentStepIndex);
  const distanceToNextM = useNavStore((s) => s.distanceToNextM);
  const isOffRoute = useNavStore((s) => s.isOffRoute);
  const arrived = useNavStore((s) => s.arrived);
  const navigationSource = useNavStore((s) => s.navigationSource);
  const rerouteStatus = useNavStore((s) => s.rerouteStatus);
  const rerouteError = useNavStore((s) => s.rerouteError);
  const rerouteRetryable = useNavStore((s) => s.rerouteRetryable);
  const lastRerouteReason = useNavStore((s) => s.lastRerouteReason);
  const warnings = useNavStore((s) => s.warnings);
  const advisories = useNavStore((s) => s.advisories);
  const followPaused = useNavStore((s) => s.followPaused);

  const step = instructions[currentStepIndex];
  const next = instructions[currentStepIndex + 1];
  const vehicle = isVehicleLegType(resolveActiveLegType(instructions, currentStepIndex));
  const handoff = findLegHandoffIndex(instructions, currentStepIndex) !== null;
  const showReroute = !arrived && (isOffRoute || rerouteStatus !== 'idle');
  const strip = rerouteStripText({ rerouteError, rerouteStatus, lastRerouteReason });
  const stripText = 'text' in strip ? strip.text : t(strip.key);
  const canReroute = navigationSource === 'local' && (rerouteStatus !== 'error' || rerouteRetryable);
  const stepWarning = warnings.some((w) => w === 'WALK_STEPS_UNAVAILABLE' || w === 'ORS_STEPS_UNAVAILABLE')
    ? t('walkStepsUnavailable')
    : warnings.includes('ROAD_STEPS_UNAVAILABLE')
      ? t('roadStepsUnavailable')
      : null;

  const reroute = () => {
    const position = useUserLocationStore.getState().position ?? undefined;
    if (rerouteStatus === 'error') void localRerouteCoordinator.retry(position);
    else void localRerouteCoordinator.triggerManualReroute('MANUAL', position);
  };

  const nextIsFacility = next?.type === 'facility';
  const nextDetail = next ? [next.streetName, next.distanceM != null ? formatDistance(next.distanceM) : null].filter(Boolean).join(' · ') : '';

  return (
    <>
      {/* 導航中橫幅是實心主色，狀態列一律淺色字 */}
      <StatusBar style="light" />
      <View pointerEvents="box-none" style={styles.top}>
        {arrived ? (
          <View style={[styles.banner, { paddingTop: insets.top + 8 }]}>
            <View accessible accessibilityLiveRegion="assertive" style={styles.bannerRow}>
              <Icon name="circleCheck" size={64} color={ON_ACCENT_FILL} />
              <View style={styles.flex}>
                <Text style={styles.bannerTitle}>{t('arrived')}</Text>
                <Text style={styles.bannerInstruction}>{t('arrivedDesc')}</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('endNav')} onPress={endNavigation} style={styles.arrivedButton}>
              <Text style={styles.arrivedButtonText}>{t('endNav')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.banner, { paddingTop: insets.top + 8 }]}>
            <View style={styles.bannerRow}>
              <Icon name={stepIcon(step)} size={64} color={ON_ACCENT_FILL} strokeWidth={2.4} />
              <View style={styles.flex}>
                {distanceToNextM != null && step ? (
                  <AnimatedNumberText text={formatDistance(distanceToNextM)} value={distanceToNextM} fontSize={48} fontWeight="heavy" color={ON_ACCENT_FILL} />
                ) : null}
                <Text accessibilityLiveRegion="assertive" style={styles.bannerInstruction} numberOfLines={3}>
                  {step?.text ?? t('preparingNav')}
                </Text>
              </View>
            </View>
            {instructions.length > 0 ? (
              <View style={styles.chips}>
                {vehicle ? (
                  <View style={styles.bannerChip}>
                    <Icon name={step?.legType === 'MOTORCYCLE' ? 'bike' : 'car'} size={14} color={ON_ACCENT_FILL} />
                    <Text style={styles.bannerChipText}>{t(step?.legType === 'MOTORCYCLE' ? 'motorcycle' : 'drive')}</Text>
                  </View>
                ) : null}
                <View style={styles.bannerChip}>
                  <Text style={styles.bannerChipText}>{t('stepOf', { current: currentStepIndex + 1, total: instructions.length })}</Text>
                </View>
              </View>
            ) : null}
            {handoff ? (
              <View style={styles.nextRow}>
                <Icon name="footprints" size={18} color={ON_ACCENT_FILL} />
                <Text style={[styles.bannerMeta, styles.flex]}>{t('parkThenWalk')}</Text>
              </View>
            ) : null}
            {stepWarning ? <Text style={styles.bannerMeta}>{stepWarning}</Text> : null}
          </View>
        )}

        <View pointerEvents="box-none" style={styles.stack}>
        {!arrived && next ? (
          <View
            accessible
            accessibilityLabel={[t('then'), next.text, nextDetail].filter(Boolean).join('，')}
            style={[styles.nextCard, { backgroundColor: colors.background }]}>
            <View style={[styles.nextIcon, { backgroundColor: nextIsFacility ? OK : ACCENT }]}>
              <Icon name={stepIcon(next)} size={20} color={ON_ACCENT_FILL} strokeWidth={2.4} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.nextTitle, { color: colors.text }]} numberOfLines={2}>
                {next.text}
              </Text>
              <Text style={[styles.nextSub, { color: nextIsFacility ? tones.ok : colors.textSecondary }]} numberOfLines={1}>
                {nextDetail || t('then')}
              </Text>
            </View>
          </View>
        ) : null}

        {showReroute ? (
          <GlassCard style={[styles.card, styles.strip]}>
            <View accessible accessibilityLiveRegion="polite" style={[styles.row, styles.flex]}>
              {rerouteStatus === 'pending' ? <ActivityIndicator color={tones.warn} /> : <Icon name="alert" color={tones.warn} />}
              <Text style={[styles.meta, styles.flex, { color: tones.warn }]}>{stripText}</Text>
            </View>
            {canReroute ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={rerouteStatus === 'error' ? t('retry') : t('recalculate')}
                accessibilityState={{ disabled: rerouteStatus === 'pending', busy: rerouteStatus === 'pending' }}
                disabled={rerouteStatus === 'pending'}
                onPress={reroute}
                style={[styles.smallButton, { borderColor: tones.warn }]}>
                <Icon name="refresh" size={14} color={tones.warn} />
                <Text style={[styles.chipText, { color: tones.warn }]}>{rerouteStatus === 'error' ? t('retry') : t('recalculate')}</Text>
              </Pressable>
            ) : null}
          </GlassCard>
        ) : null}

        {!arrived
          ? advisories.map((advisory) => {
              const color = advisory.severity === 'critical' ? tones.danger : advisory.severity === 'warning' ? tones.warn : colors.textSecondary;
              return (
                <GlassCard key={advisory.advisoryId} style={[styles.card, styles.advisory]}>
                  <View accessible accessibilityLabel={[advisory.title, advisory.detail].filter(Boolean).join('，')} style={styles.row}>
                    <Icon name="alert" color={color} />
                    <View style={styles.flex}>
                      <Text style={[styles.instructionSmall, { color }]}>{advisory.title}</Text>
                      {advisory.detail ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{advisory.detail}</Text> : null}
                    </View>
                  </View>
                  <View style={styles.chips}>
                    {advisory.action === 'reroute_suggested' && navigationSource === 'local' ? (
                      <>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            const position = useUserLocationStore.getState().position ?? undefined;
                            void localRerouteCoordinator.triggerManualReroute(advisory.rerouteReason ?? 'MANUAL', position);
                          }}
                          style={[styles.smallButton, { borderColor: color }]}>
                          <Text style={[styles.chipText, { color }]}>{t('viewAlternative')}</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => useNavStore.getState().dismissAdvisory(advisory.advisoryId)}
                          style={[styles.smallButton, { borderColor: colors.textSecondary }]}>
                          <Text style={[styles.chipText, { color: colors.textSecondary }]}>{t('keepRoute')}</Text>
                        </Pressable>
                      </>
                    ) : null}
                    {advisory.action === 'reroute_applied' ? (
                      <Text style={[styles.meta, { color: colors.textSecondary }]}>{t('rerouteApplied')}</Text>
                    ) : null}
                    {advisory.action === 'none' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('close')}
                        onPress={() => useNavStore.getState().dismissAdvisory(advisory.advisoryId)}
                        style={styles.iconButton}>
                        <Icon name="close" size={16} color={colors.textSecondary} />
                      </Pressable>
                    ) : null}
                  </View>
                </GlassCard>
              );
            })
          : null}

        {followPaused && !arrived ? (
          <GlassCard style={styles.resume} interactive>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('resumeFollow')}
              onPress={() => useNavStore.getState().setFollowPaused(false)}
              style={styles.resumeBody}>
              <Icon name="navigation" size={16} color={ACCENT} />
              <Text style={[styles.chipText, { color: ACCENT }]}>{t('resumeFollow')}</Text>
            </Pressable>
          </GlassCard>
        ) : null}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  stack: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  banner: {
    backgroundColor: ACCENT_FILL,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: 22,
    paddingBottom: 20,
    gap: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bannerTitle: { color: ON_ACCENT_FILL, fontSize: 34, fontWeight: '800' },
  bannerInstruction: { color: ON_ACCENT_FILL, fontSize: 22, fontWeight: '700', marginTop: 6 },
  bannerMeta: { color: ON_ACCENT_FILL, fontSize: 15, fontWeight: '600' },
  bannerChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 14, paddingHorizontal: 10, minHeight: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
  bannerChipText: { color: ON_ACCENT_FILL, fontSize: 14, fontWeight: '600' },
  arrivedButton: { minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: ON_ACCENT_FILL },
  arrivedButtonText: { color: ACCENT_FILL, fontSize: 19, fontWeight: '700' },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  nextIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  nextTitle: { fontSize: 17, fontWeight: '700' },
  nextSub: { fontSize: 13, fontWeight: '600' },
  card: { padding: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700' },
  instruction: { fontSize: 18, fontWeight: '600' },
  instructionSmall: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 8, minHeight: 24 },
  chipText: { fontSize: 13, fontWeight: '600' },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  strip: { flexDirection: 'row', alignItems: 'center' },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
  },
  advisory: { gap: 6 },
  resume: { alignSelf: 'center', borderRadius: 22 },
  resumeBody: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  primary: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
