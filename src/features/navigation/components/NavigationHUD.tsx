import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUserLocationStore } from '@/features/map';
import { formatDistance } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { ACCENT_FILL, ON_ACCENT_FILL, useSemanticColors, useThemeColors } from '@/shared/theme';
import { AnimatedNumberText, GlassCard, Icon } from '@/shared/ui';

import { localRerouteCoordinator } from '../controller/localRerouteCoordinator';
import { endNavigation } from '../controller/navigationSession';
import { rerouteStripText, stripStepDistance } from '../domain/hudProgress';
import { findLegHandoffIndex, isVehicleLegType, resolveActiveLegType } from '../domain/legMode';
import { stepIcon } from '../domain/navStepIcon';
import { transitDetail, transitHeadline, transitInstruction, type Translate } from '../domain/transitCopy';
import { useNavStore } from '../store/navStore';

const ACCENT = ACCENT_FILL;
/** 橫幅內「接著」列：比主指示淡一階的白；0.9 疊在 ACCENT_FILL 上 ≈ 4.9:1（0.72 只有 3.7:1，不到 AA）。 */
const THEN_TEXT = 'rgba(255,255,255,0.9)';

/**
 * 導航 HUD（SDD §4.5「導航 HUD」、Web `NavigationHUD.tsx`；設計 1c 大字色塊）：疊在地圖上。
 * - 頂部：貼齊螢幕頂端（延伸到狀態列後方）的實心主色橫幅——64pt 轉向圖示、60pt 即時距離（數字滾動）、24pt 指示文字（live region，去掉寫死的距離）、
 *   開車 chip／開車→步行交接提示；抵達時換成抵達橫幅。
 * - 橫幅底部：分隔線下的「接著」列（下一步的指示與距離，較小較淡的字）。
 * - 橫幅下方：偏航／重算時的重算列（重新規劃／重試）；主動警報。
 * - 預覽（人不在路線附近，`stepMode === 'preview'`）：橫幅內多一列上一步／下一步，VoiceOver 可上下滑調整；實際導航不顯示。
 * - 使用者拖曳地圖後出現「回到導航」。
 * 剩餘時間／預計抵達與語音、2D/3D、結束按鈕是 sheet 的收合列（`NavigationTripBar`），步驟清單在其下方，HUD 不重複。
 */
export default function NavigationHUD() {
  const { t } = useAppTranslation();
  const instructionError = useNavStore((s) => s.instructionError);
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  const tones = { ok: semantic.ok.fg, warn: semantic.warn.fg, danger: semantic.danger.fg };
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
  const stepMode = useNavStore((s) => s.stepMode);
  const transitGuide = useNavStore((s) => s.transitGuide);

  const step = instructions[currentStepIndex];
  // 第一個定位樣本進來前引擎還沒算出距離：先用這一步的規劃距離，大字不會空著。
  const distanceM = distanceToNextM ?? step?.distanceM ?? null;
  // 公車段：大字改成等車分鐘數／剩幾站，指示改成含即時分鐘數的導引（後端的上下車指令是靜態文字）。
  const translate: Translate = (key, options) => t(key, options);
  const transitHead = transitGuide ? transitHeadline(translate, transitGuide) : null;
  const transitValue =
    transitGuide?.phase === 'riding'
      ? (transitGuide.stopsLeft ?? transitGuide.minutes ?? 0)
      : transitGuide?.phase === 'waiting'
        ? (transitGuide.waitMinutes ?? 0)
        : 0;
  const transitLine = transitGuide ? transitDetail(translate, transitGuide) : null;
  const instructionText = transitGuide ? transitInstruction(translate, transitGuide) : step ? stripStepDistance(step.text) : t('preparingNav');
  const instructionLabel = transitGuide ? [instructionText, transitLine].filter(Boolean).join('，') : step?.text;
  const next = instructions[currentStepIndex + 1];
  const vehicle = isVehicleLegType(resolveActiveLegType(instructions, currentStepIndex));
  const handoff = findLegHandoffIndex(instructions, currentStepIndex) !== null;
  const showReroute = !arrived && (isOffRoute || rerouteStatus !== 'idle');
  // 預覽（人不在路線附近）：步驟改由使用者切換；實際導航只由定位推進。
  const previewing = stepMode === 'preview' && navigationSource === 'local' && instructions.length > 0;
  const canPrev = currentStepIndex > 0;
  const canNext = currentStepIndex < instructions.length - 1;
  const selectStep = (index: number) => useNavStore.getState().selectPreviewStep(index);
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

  const nextDetail = next ? [next.streetName, next.distanceM != null ? formatDistance(next.distanceM) : null].filter(Boolean).join(' · ') : '';

  return (
    <>
      {/* 導航中橫幅是實心主色，狀態列一律淺色字 */}
      <StatusBar style="light" />
      <View pointerEvents="box-none" style={styles.top}>
        {instructionError ? (
          <View style={[styles.banner, { paddingTop: insets.top + 8 }]}>
            <Text accessibilityLiveRegion="assertive" style={styles.bannerInstruction}>{t(instructionError === 'expired' ? 'nativeRouteTokenExpired' : 'nativeInstructionsUnavailable')}</Text>
            <Pressable accessibilityRole="button" onPress={() => { endNavigation(); router.navigate('/plan'); }} style={styles.arrivedButton}>
              <Text style={styles.arrivedButtonText}>{t('nativePlanAgain')}</Text>
            </Pressable>
          </View>
        ) : arrived ? (
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
            {/* 預覽列放最上方：上面沒有會變高的內容，連按上一步／下一步時按鈕不會隨指示文字長短跳位 */}
            {previewing ? (
              <View style={styles.previewRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('prevStep')}
                  accessibilityState={{ disabled: !canPrev }}
                  disabled={!canPrev}
                  onPress={() => selectStep(currentStepIndex - 1)}
                  style={[styles.previewButton, !canPrev && styles.previewButtonDisabled]}>
                  <Icon name="chevronLeft" size={26} color={ON_ACCENT_FILL} strokeWidth={2.6} />
                </Pressable>
                <View
                  accessible
                  accessibilityRole="adjustable"
                  accessibilityLabel={[t('routePreviewMode'), t('stepOf', { current: currentStepIndex + 1, total: instructions.length })].join('，')}
                  accessibilityHint={t('routePreviewHint')}
                  accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                  onAccessibilityAction={(event) => {
                    if (event.nativeEvent.actionName === 'increment' && canNext) selectStep(currentStepIndex + 1);
                    if (event.nativeEvent.actionName === 'decrement' && canPrev) selectStep(currentStepIndex - 1);
                  }}
                  style={styles.previewLabel}>
                  <Text style={styles.previewTitle}>{t('routePreviewMode')}</Text>
                  <Text style={styles.previewMeta}>{t('stepOf', { current: currentStepIndex + 1, total: instructions.length })}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('nextStep')}
                  accessibilityState={{ disabled: !canNext }}
                  disabled={!canNext}
                  onPress={() => selectStep(currentStepIndex + 1)}
                  style={[styles.previewButton, !canNext && styles.previewButtonDisabled]}>
                  <Icon name="chevronRight" size={26} color={ON_ACCENT_FILL} strokeWidth={2.6} />
                </Pressable>
              </View>
            ) : null}
            <View style={styles.bannerRow}>
              <Icon name={stepIcon(step)} size={64} color={ON_ACCENT_FILL} strokeWidth={2.2} />
              <View style={styles.flex}>
                {transitHead ? (
                  <AnimatedNumberText text={transitHead} value={transitValue} fontSize={45} fontWeight="heavy" color={ON_ACCENT_FILL} />
                ) : distanceM != null && step ? (
                  <AnimatedNumberText text={formatDistance(distanceM)} value={distanceM} fontSize={45} fontWeight="heavy" color={ON_ACCENT_FILL} />
                ) : null}
                <Text
                  accessibilityLiveRegion="assertive"
                  accessibilityLabel={instructionLabel}
                  style={step ? styles.bannerInstruction : styles.bannerTitle}>
                  {instructionText}
                </Text>
                {transitLine ? <Text style={styles.bannerMeta}>{transitLine}</Text> : null}
              </View>
            </View>
            {vehicle ? (
              <View style={styles.chips}>
                <View style={styles.bannerChip}>
                  <Icon name={step?.legType === 'MOTORCYCLE' ? 'bike' : 'car'} size={14} color={ON_ACCENT_FILL} />
                  <Text style={styles.bannerChipText}>{t(step?.legType === 'MOTORCYCLE' ? 'motorcycle' : 'drive')}</Text>
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
            {next ? (
              <View
                accessible
                accessibilityLabel={[t('then'), next.text, nextDetail].filter(Boolean).join('，')}
                style={styles.thenRow}>
                <Text style={styles.thenLabel}>{t('then')}</Text>
                <Icon name={stepIcon(next)} size={18} color={THEN_TEXT} strokeWidth={2.4} />
                <Text style={[styles.thenText, styles.flex]} numberOfLines={2}>
                  {[stripStepDistance(next.text), next.distanceM != null ? formatDistance(next.distanceM) : null].filter(Boolean).join(' ')}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        <View pointerEvents="box-none" style={styles.stack}>
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
  bannerInstruction: { color: ON_ACCENT_FILL, fontSize: 24, fontWeight: '700', marginTop: 2 },
  bannerMeta: { color: ON_ACCENT_FILL, fontSize: 15, fontWeight: '600' },
  bannerChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 14, paddingHorizontal: 10, minHeight: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
  bannerChipText: { color: ON_ACCENT_FILL, fontSize: 14, fontWeight: '600' },
  arrivedButton: { minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: ON_ACCENT_FILL },
  arrivedButtonText: { color: ACCENT_FILL, fontSize: 19, fontWeight: '700' },
  thenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.35)',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.35)',
  },
  previewButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  previewButtonDisabled: { opacity: 0.4 },
  previewLabel: { flex: 1, alignItems: 'center' },
  previewTitle: { color: ON_ACCENT_FILL, fontSize: 17, fontWeight: '700' },
  previewMeta: { color: THEN_TEXT, fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
  thenLabel: { color: THEN_TEXT, fontSize: 17, fontWeight: '600' },
  thenText: { color: THEN_TEXT, fontSize: 17, fontWeight: '500' },
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
