import { Text } from '@/shared/ui/typography/Text';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUserLocationStore } from '@/features/map';
import { formatDistance } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { ACCENT_FILL, ON_ACCENT_FILL, useSemanticColors, useThemeColors, SHADOW_COLOR, WHITE } from '@/shared/theme';
import { AnimatedNumberText, GlassCard, Icon } from '@/shared/ui';

import { localRerouteCoordinator } from '../controller/localRerouteCoordinator';
import { endNavigation } from '../controller/navigationSession';
import { rerouteStripText, stripStepDistance } from '../domain/hudProgress';
import { findLegHandoffIndex, isVehicleLegType, resolveActiveLegType } from '../domain/legMode';
import { stepIcon } from '../domain/navStepIcon';
import { transitDetail, transitHeadline, transitInstruction, type Translate } from '../domain/transitCopy';
import { useNavStore } from '../store/navStore';

const ACCENT = ACCENT_FILL;
/** 卡片內次要文字（「接著」、補充資訊）：比主指示淡一階的白；0.9 疊在 ACCENT_FILL 上 ≈ 4.9:1（0.72 只有 3.7:1，不到 AA）。 */
const THEN_TEXT = 'rgba(255,255,255,0.9)';

/**
 * 導航 HUD（SDD §4.5「導航 HUD」、Web `NavigationHUD.tsx`）：疊在地圖上，版型對齊 Google／Apple Maps。
 * - 頂部：狀態列下方的浮動主色卡片，高度約螢幕 10%——轉向圖示、28pt 即時距離（數字滾動）、單行指示文字（live region，去掉寫死的距離）、
 *   右側「接著」與下一步圖示；開車／開車→步行交接／步驟警告／公車段細節收成一行小字。抵達時換成抵達卡片。
 *   字級固定（`fixedSize`），不跟 App 字級／Dynamic Type 放大，否則卡片會吃掉三成畫面（使用者回饋 2026-10-21）；
 *   完整指示與下一步走 accessibilityLabel。
 * - 卡片下方：偏航／重算時的重算列（重新規劃／重試）；主動警報。這兩者是需要細讀的警示，仍跟字級放大。
 * - 預覽（人不在路線附近，`stepMode === 'preview'`）：卡片內多一列上一步／下一步，VoiceOver 可上下滑調整；實際導航不顯示。
 * - 使用者拖曳地圖後出現「回到導航」。
 * 剩餘時間／預計抵達與語音、2D/3D、結束按鈕是 sheet 的收合列（`NavigationTripBar`），步驟清單在其下方，HUD 不重複。
 */
export interface NavigationHUDProps {
  /** 頂部橫幅實際渲染高度（pt，含 safe-area top）；呼叫端用來讓語音膠囊貼在橫幅下方，
   * 不用再憑經驗寫死一個高度猜測值（使用者回饋 2026-10-15：指示文字一多行就蓋到語音膠囊）。 */
  onBannerHeightChange?: (height: number) => void;
}

export default function NavigationHUD({ onBannerHeightChange }: NavigationHUDProps) {
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
  const localTransitGuide = useNavStore((s) => s.transitGuide);
  const voiceTransit = useNavStore((s) => s.voiceTransit);
  const transitGuide = navigationSource === 'local' ? localTransitGuide : null;
  const voiceLeg = navigationSource === 'voice' && voiceTransit?.onVehicle ? voiceTransit.leg : null;
  const voiceTransitLine = voiceLeg ? [voiceLeg.routeName, `${voiceLeg.from} → ${voiceLeg.to}`].filter(Boolean).join(' · ') : null;

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
  // 主列以外的補充資訊收成一行小字：開車／交接／步驟警告／公車段細節，橫幅高度才不會隨狀態一路疊高
  const metaIcon = handoff ? 'footprints' : vehicle ? (step?.legType === 'MOTORCYCLE' ? 'bike' : 'car') : null;
  const metaText = [
    voiceTransitLine,
    transitLine,
    handoff ? t('parkThenWalk') : vehicle ? t(step?.legType === 'MOTORCYCLE' ? 'motorcycle' : 'drive') : null,
    stepWarning,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <StatusBar style="auto" />
      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <View
          pointerEvents="box-none"
          onLayout={onBannerHeightChange ? (event) => onBannerHeightChange(insets.top + 4 + event.nativeEvent.layout.height) : undefined}>
        {instructionError ? (
          <View style={[styles.banner, styles.bannerRow]}>
            <Text fixedSize accessibilityLiveRegion="assertive" numberOfLines={2} style={[styles.bannerMessage, styles.flex]}>
              {t(instructionError === 'expired' ? 'nativeRouteTokenExpired' : 'nativeInstructionsUnavailable')}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => { endNavigation(); router.dismissTo('/plan'); }} style={styles.bannerButton}>
              <Text fixedSize style={styles.bannerButtonText}>{t('nativePlanAgain')}</Text>
            </Pressable>
          </View>
        ) : arrived ? (
          <View style={[styles.banner, styles.bannerRow]}>
            <View accessible accessibilityLiveRegion="assertive" style={[styles.bannerRow, styles.flex]}>
              <Icon name="circleCheck" size={36} color={ON_ACCENT_FILL} />
              <View style={styles.flex}>
                <Text fixedSize numberOfLines={1} style={styles.bannerTitle}>{t('arrived')}</Text>
                <Text fixedSize numberOfLines={1} style={styles.bannerMeta}>{t('arrivedDesc')}</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('endNav')} onPress={endNavigation} style={styles.bannerButton}>
              <Text fixedSize style={styles.bannerButtonText}>{t('endNav')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.banner}>
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
                  <Icon name="chevronLeft" size={22} color={ON_ACCENT_FILL} strokeWidth={2.6} />
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
                  <Text fixedSize numberOfLines={1} style={styles.previewTitle}>
                    {t('routePreviewMode')}
                    <Text fixedSize style={styles.previewMeta}>{`  ${t('stepOf', { current: currentStepIndex + 1, total: instructions.length })}`}</Text>
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('nextStep')}
                  accessibilityState={{ disabled: !canNext }}
                  disabled={!canNext}
                  onPress={() => selectStep(currentStepIndex + 1)}
                  style={[styles.previewButton, !canNext && styles.previewButtonDisabled]}>
                  <Icon name="chevronRight" size={22} color={ON_ACCENT_FILL} strokeWidth={2.6} />
                </Pressable>
              </View>
            ) : null}
            <View style={styles.bannerRow}>
              <Icon name={stepIcon(step)} size={40} color={ON_ACCENT_FILL} strokeWidth={2.4} />
              <View style={styles.flex}>
                {transitHead ? (
                  <AnimatedNumberText text={transitHead} value={transitValue} fontSize={28} fontWeight="heavy" fixedSize color={ON_ACCENT_FILL} />
                ) : distanceM != null && step ? (
                  <AnimatedNumberText text={formatDistance(distanceM)} value={distanceM} fontSize={28} fontWeight="heavy" fixedSize color={ON_ACCENT_FILL} />
                ) : null}
                {/* 一行為限：長路名先縮字再截斷；完整指示走 accessibilityLabel，步驟清單也看得到全文 */}
                <Text
                  fixedSize
                  accessibilityLiveRegion="assertive"
                  accessibilityLabel={instructionLabel}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  style={styles.bannerInstruction}>
                  {instructionText}
                </Text>
              </View>
              {next ? (
                <View
                  accessible
                  accessibilityLabel={[t('then'), next.text, nextDetail].filter(Boolean).join('，')}
                  style={styles.then}>
                  <Text fixedSize style={styles.thenLabel}>{t('then')}</Text>
                  <Icon name={stepIcon(next)} size={22} color={ON_ACCENT_FILL} strokeWidth={2.4} />
                </View>
              ) : null}
            </View>
            {metaText ? (
              <View style={styles.metaRow}>
                {metaIcon ? <Icon name={metaIcon} size={14} color={THEN_TEXT} /> : null}
                <Text fixedSize numberOfLines={1} style={[styles.bannerMeta, styles.flex]}>{metaText}</Text>
              </View>
            ) : null}
          </View>
        )}
        </View>

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
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 8 },
  stack: { paddingHorizontal: 8, paddingTop: 10, gap: 10 },
  banner: {
    backgroundColor: ACCENT_FILL,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    shadowColor: SHADOW_COLOR,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerTitle: { color: ON_ACCENT_FILL, fontSize: 22, fontWeight: '800' },
  bannerInstruction: { color: ON_ACCENT_FILL, fontSize: 18, fontWeight: '700' },
  bannerMessage: { color: ON_ACCENT_FILL, fontSize: 16, fontWeight: '700' },
  bannerMeta: { color: THEN_TEXT, fontSize: 13, fontWeight: '600' },
  bannerButton: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: ON_ACCENT_FILL },
  bannerButtonText: { color: ACCENT_FILL, fontSize: 16, fontWeight: '700' },
  then: {
    alignItems: 'center',
    gap: 2,
    paddingLeft: 12,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.35)',
  },
  thenLabel: { color: THEN_TEXT, fontSize: 12, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.35)',
  },
  previewButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  previewButtonDisabled: { opacity: 0.4 },
  previewLabel: { flex: 1, alignItems: 'center' },
  previewTitle: { color: ON_ACCENT_FILL, fontSize: 15, fontWeight: '700' },
  previewMeta: { color: THEN_TEXT, fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] },
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
  primaryText: { color: WHITE, fontSize: 15, fontWeight: '700' },
});
