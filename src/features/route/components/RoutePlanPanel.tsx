import { Text } from '@/shared/ui/typography/Text';
import { ScrollView, StyleSheet, useColorScheme, View } from 'react-native';

import { useCloseScreen } from '@/shared/navigation';
import { MAX_FONT_SCALE, TYPE, useSemanticColors, useThemeColors, SHAPE, ICON_SIZE } from '@/shared/theme';
import { Icon, type IconName } from '@/shared/ui';

import { ROUTE_DESTINATION_COLOR, ROUTE_ORIGIN_COLOR } from '../domain/routeLayerData';
import type { PlanOption, RoutePlanModel } from '../hooks/useRoutePlanViewModel';
import type { RouteMode, TravelMode } from '../types/route';

import RouteCard from './RouteCard';
import RouteSkeleton from './RouteSkeleton';
import {
  ROUTE_BORDER_COLOR,
  ROUTE_ON_ACCENT_COLOR,
  routeStyles,
  routeTones,
} from './palette';
import PressableScale from '@/shared/ui/PressableScale';
import { haptic } from '@/shared/haptics';
import { getAppLanguage } from '@/shared/i18n';
import { venueHandoffCopy } from '../domain/venueHandoffCopy';
import VenueHandoffCard from './VenueHandoffCard';
import IndoorRouteSummary from './IndoorRouteSummary';

const TRAVEL_MODE_ICON: Record<TravelMode, IconName> = {
  transit: 'bus',
  drive: 'car',
  motorcycle: 'bike',
  walk: 'footprints',
};

// 跟 onboarding 第 2 步的情況圖示同一套對照（`OnboardingPanel.tsx` 的 `SITUATION_ICON`）：
// wheelchair→accessibility、vision→eye、slow/walker→personStanding，一般用 user。
const ROUTE_MODE_ICON: Record<RouteMode, IconName> = {
  normal: 'user',
  wheelchair: 'accessibility',
  elderly: 'personStanding',
  visual_impaired: 'eye',
};

export interface RoutePlanPanelProps {
  model: RoutePlanModel;
  /** 由 app 路由注入 navigation feature 的開始導航（route 不 import navigation）。 */
  onStartNavigation: () => void;
}

/**
 * 路線規劃面板（`(sheet)/plan`），iOS／Android 共用，版面參考 Google Maps／Apple 地圖的路線規劃：
 * 標題列（路線＋關閉）→ 起訖點卡片（可交換）→ 無障礙模式膠囊 → 交通方式分頁 → 沿途設施篩選
 * → 建議路線（標題列帶重新規劃）。無障礙模式是這個 App 的核心條件，而且會停用不適用的交通方式，
 * 所以永遠排在結果之前；設施篩選改成規劃表單就常駐顯示（使用者回饋 2026-10-23：規劃前就能先選好
 * 要看哪些設施，不用等結果出來），同樣排在結果之前。
 * 選中的路線卡內含理由（階梯、坡度、電梯）與「開始導航」；條件齊全時自動算路，算路中顯示骨架卡，失敗才出現重試按鈕。
 * 無障礙模式跟交通方式用同一種有圖示的膠囊列，不用 iOS 原生分段控制那種無圖示的灰色軌道。
 * 根節點是單一 ScrollView（formSheet 對多個 sibling 會警告並重疊，見 place 面板註解）。
 */
export default function RoutePlanPanel({ model, onStartNavigation }: RoutePlanPanelProps) {
  const colors = useThemeColors();
  const closeScreen = useCloseScreen();
  const isDark = useColorScheme() === 'dark';
  const tones = routeTones(isDark);
  const semantic = useSemanticColors();
  const surface = semantic.surface;

  /** 交通方式：等寬分頁（圖示在上、文字在下），選中用主色淡底；停用的分頁仍可被讀到並說明原因（gatedHint）。 */
  const renderModeTab = (option: PlanOption<TravelMode>) => {
    const tint = option.selected ? semantic.accent : colors.textSecondary;
    return (
      <PressableScale
        key={option.value}
        accessibilityRole="tab"
        accessibilityLabel={option.accessibilityLabel}
        accessibilityState={{ selected: option.selected, disabled: option.disabled }}
        disabled={option.disabled}
        onPress={() => {
          haptic.select();
          option.onSelect();
        }}
        style={[
          styles.modeTab,
          option.selected && { backgroundColor: semantic.accentSoft },
          option.disabled && routeStyles.disabled,
        ]}>
        <Icon name={TRAVEL_MODE_ICON[option.value]} size={ICON_SIZE.control} color={tint} />
        <Text
          style={[styles.modeTabText, { color: option.selected ? semantic.accent : colors.text }, option.selected && styles.modeTabTextSelected]}
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE.label}>
          {option.label}
        </Text>
      </PressableScale>
    );
  };

  const renderOption = <T extends string>(option: PlanOption<T>, icon?: IconName) => (
    <PressableScale
      key={option.value}
      accessibilityRole="button"
      accessibilityLabel={option.accessibilityLabel}
      accessibilityState={{ selected: option.selected, disabled: option.disabled }}
      disabled={option.disabled}
      onPress={() => {
        haptic.select();
        option.onSelect();
      }}
      style={[
        routeStyles.chip,
        { borderColor: ROUTE_BORDER_COLOR },
        option.selected && { backgroundColor: semantic.accentSoft, borderColor: semantic.accent, borderWidth: 2 },
        option.disabled && routeStyles.disabled,
      ]}>
      {icon ? <Icon name={icon} size={ICON_SIZE.body} color={option.selected ? semantic.accent : colors.text} /> : null}
      <Text style={[routeStyles.chipText, { color: option.selected ? semantic.accent : colors.text }]}>{option.label}</Text>
    </PressableScale>
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={routeStyles.content}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {model.labels.title}
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={model.labels.close}
          hitSlop={8}
          onPress={closeScreen}
          style={[styles.closeButton, { backgroundColor: surface }]}>
          <Icon name="close" size={ICON_SIZE.body} color={colors.textSecondary} />
        </PressableScale>
      </View>

      <View style={[routeStyles.card, styles.endpoints, { backgroundColor: surface }]}>
        <View style={routeStyles.flex}>
          <View style={styles.endpointRow}>
            {model.originIsMyLocation ? (
              <Icon name="navigation" size={ICON_SIZE.body} color={ROUTE_ORIGIN_COLOR} />
            ) : (
              <View style={[styles.dot, { borderColor: ROUTE_ORIGIN_COLOR }]} />
            )}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`${model.labels.origin}：${model.originLabel}，${model.labels.edit}`}
              onPress={() => model.onEdit('origin')}
              style={[routeStyles.flex, styles.endpointPress]}>
              <Text style={[routeStyles.bodyText, { color: colors.text }]} numberOfLines={2}>
                {model.originLabel}
              </Text>
            </PressableScale>
            {!model.originIsMyLocation ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={getAppLanguage() === 'en' ? 'Clear origin' : '清除起點'}
                onPress={model.onClearOrigin}
                hitSlop={14}>
                <Icon name="close" size={ICON_SIZE.body} color={colors.textSecondary} />
              </PressableScale>
            ) : null}
          </View>
          <View style={[styles.divider, { backgroundColor: ROUTE_BORDER_COLOR }]} />
          <View style={styles.endpointRow}>
            <View style={[styles.dot, styles.dotFilled, { backgroundColor: ROUTE_DESTINATION_COLOR, borderColor: ROUTE_DESTINATION_COLOR }]} />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={
                model.destinationLabel
                  ? `${model.labels.destination}：${model.destinationLabel}，${model.labels.edit}`
                  : model.labels.chooseDestination
              }
              onPress={() => model.onEdit('destination')}
              style={[routeStyles.flex, styles.endpointPress]}>
              <Text
                style={[routeStyles.bodyText, { color: model.destinationLabel ? colors.text : colors.textSecondary }]}
                numberOfLines={1}>
                {model.destinationLabel ?? model.labels.searchPlaceholder}
              </Text>
            </PressableScale>
            {model.destinationLabel ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={model.labels.clear}
                onPress={model.onClearDestination}
                hitSlop={14}>
                <Icon name="close" size={ICON_SIZE.body} color={colors.textSecondary} />
              </PressableScale>
            ) : null}
          </View>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={model.labels.swap}
          accessibilityHint={model.swapDisabled ? venueHandoffCopy(getAppLanguage()).swapUnavailable : undefined}
          accessibilityState={{ disabled: model.swapDisabled }}
          disabled={model.swapDisabled}
          onPress={model.onSwap}
          hitSlop={4}
          style={[routeStyles.circleButton, styles.swapButton, { borderColor: ROUTE_BORDER_COLOR }]}>
          <Icon name="arrowUpDown" color={colors.text} />
        </PressableScale>
      </View>

      {/* 跟「交通方式」同一種有圖示的膠囊列，不用 iOS 原生分段控制那種無圖示的灰色軌道
          （使用者回饋 2026-10-23，參考設計圖二：圖示讓「一般／輪椅／長者／視障」一眼分得出來）。 */}
      <View style={routeStyles.section}>
        <Text accessibilityRole="header" style={[routeStyles.sectionTitle, { color: colors.textSecondary }]}>
          {model.labels.a11yMode}
        </Text>
        <View accessibilityRole="radiogroup" style={routeStyles.chipsRow}>
          {model.routeModes.map((option) => renderOption(option, ROUTE_MODE_ICON[option.value]))}
        </View>
      </View>

      {!model.isIndoorJourney ? <View style={routeStyles.section}>
        <View accessibilityRole="tablist" accessibilityLabel={model.labels.travelMode} style={[styles.modeTabs, { backgroundColor: surface }]}>
          {model.travelModes.map(renderModeTab)}
        </View>
        {model.gatedHint ? (
          <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{model.gatedHint}</Text>
        ) : null}
      </View> : null}

      {/* 沿途顯示設施：以前只在已經有結果、按「重新規劃」時才看得到；改成規劃表單就常駐顯示
          （使用者回饋 2026-10-23，參考設計圖二：規劃前就能先選好要看哪些設施，不用等結果出來）。 */}
      {!model.isIndoorJourney ? <View style={routeStyles.section}>
        <Text accessibilityRole="header" style={[routeStyles.sectionTitle, { color: colors.textSecondary }]}>
          {model.labels.facilityFilterTitle}
        </Text>
        <View style={routeStyles.chipsRow}>{model.facilityFilters.map((option) => renderOption(option))}</View>
      </View> : null}

      {model.error ? (
        <View accessibilityLiveRegion="polite" style={[routeStyles.card, styles.errorCard]}>
          <Icon name="alert" size={ICON_SIZE.body} color={tones.danger} />
          <Text style={[routeStyles.bodyText, routeStyles.flex, { color: tones.danger }]}>{model.error}</Text>
        </View>
      ) : null}

      {model.indoorRoute ? (
        <IndoorRouteSummary route={model.indoorRoute} onStartNavigation={onStartNavigation} onOpenDetail={() => model.onOpenRouteDetail(0)} />
      ) : model.results ? (
        <View style={styles.results}>
          {model.venueHandoff ? <VenueHandoffCard handoff={model.venueHandoff} /> : null}
          <View style={styles.resultsHeader}>
            <Text accessibilityRole="header" style={[styles.resultsTitle, { color: colors.text }]} maxFontSizeMultiplier={MAX_FONT_SCALE.heading}>
              {model.labels.routeOptions}
            </Text>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={model.labels.replan}
              onPress={model.onStart}
              hitSlop={6}
              style={[styles.refreshButton, { backgroundColor: surface }]}>
              <Icon name="refresh" size={ICON_SIZE.body} color={semantic.accent} />
              <Text style={[styles.refreshText, { color: semantic.accent }]} maxFontSizeMultiplier={MAX_FONT_SCALE.label}>
                {model.labels.replan}
              </Text>
            </PressableScale>
          </View>
          {model.results.routes.map((route, index) => (
            <RouteCard
              key={route.routeId || String(index)}
              route={route}
              selected={model.results?.selectedIndex === index}
              onSelect={() => model.onSelectRoute(index)}
              onOpenDetail={() => model.onOpenRouteDetail(index)}
              onStartNavigation={onStartNavigation}
            />
          ))}
        </View>
      ) : model.loading ? (
        <RouteSkeleton label={model.labels.loading} />
      ) : (
        // 缺少定位／目的地時仍可按下，由 onStart 顯示缺少的條件。
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={model.labels.start}
          onPress={model.onStart}
          style={routeStyles.primaryButton}>
          <Icon name="navigation" color={ROUTE_ON_ACCENT_COLOR} />
          <Text style={routeStyles.primaryButtonText}>{model.labels.start}</Text>
        </PressableScale>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: TYPE.title1, fontWeight: '700' },
  closeButton: { width: 32, height: 32, borderRadius: SHAPE.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  swapButton: { width: 36, height: 36, borderRadius: SHAPE.pill, borderCurve: 'continuous' },
  endpoints: { borderRadius: SHAPE.card, borderCurve: 'continuous', paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
  endpointRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  endpointPress: { minHeight: 44, justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 26 },
  dot: { width: 14, height: 14, borderRadius: SHAPE.pill, borderCurve: 'continuous', borderWidth: 3, marginHorizontal: 1 },
  dotFilled: { borderWidth: 0 },
  modeTabs: { flexDirection: 'row', borderRadius: SHAPE.card, borderCurve: 'continuous', padding: 4, gap: 4 },
  modeTab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 56, borderRadius: SHAPE.control + 2, borderCurve: 'continuous', paddingHorizontal: 4 },
  modeTabText: { fontSize: TYPE.footnote, fontWeight: '600' },
  modeTabTextSelected: { fontWeight: '700' },
  results: { gap: 10 },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  resultsTitle: { fontSize: TYPE.title3, fontWeight: '700', flexShrink: 1 },
  refreshButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, borderRadius: SHAPE.pill, borderCurve: 'continuous', paddingHorizontal: 12 },
  refreshText: { fontSize: TYPE.footnote + 1, fontWeight: '600' },
  errorCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,59,48,0.12)' },
});
