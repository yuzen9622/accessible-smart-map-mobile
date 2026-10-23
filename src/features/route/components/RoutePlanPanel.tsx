import { Text, TextInput } from '@/shared/ui/typography/Text';
import { ActivityIndicator, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';

import { useCloseScreen } from '@/shared/navigation';
import { MAX_FONT_SCALE, TYPE, useSemanticColors, useThemeColors, SHAPE, ICON_SIZE } from '@/shared/theme';
import { Icon, SegmentedControl, type IconName } from '@/shared/ui';

import { ROUTE_DESTINATION_COLOR, ROUTE_ORIGIN_COLOR } from '../domain/routeLayerData';
import type { PlanOption, RoutePlanModel } from '../hooks/useRoutePlanViewModel';
import type { TravelMode } from '../types/route';

import RouteCard from './RouteCard';
import RouteSkeleton from './RouteSkeleton';
import {
  ROUTE_ACCENT_COLOR,
  ROUTE_BORDER_COLOR,
  ROUTE_ON_ACCENT_COLOR,
  routeStyles,
  routeTones,
} from './palette';
import PressableScale from '@/shared/ui/PressableScale';

const TRAVEL_MODE_ICON: Record<TravelMode, IconName> = {
  transit: 'bus',
  drive: 'car',
  motorcycle: 'bike',
  walk: 'footprints',
};

export interface RoutePlanPanelProps {
  model: RoutePlanModel;
  /** 由 app 路由注入 navigation feature 的開始導航（route 不 import navigation）。 */
  onStartNavigation: () => void;
}

/**
 * 路線規劃面板（`(sheet)/plan`），iOS／Android 共用，版面參考 Google Maps／Apple 地圖的路線規劃：
 * 標題列（路線＋關閉）→ 起訖點卡片（可交換）→ 無障礙模式分段控制 → 交通方式分頁 → 建議路線（標題列帶重新規劃）
 * → 沿途設施篩選。無障礙模式是這個 App 的核心條件，而且會停用不適用的交通方式，所以永遠排在結果之前；
 * 設施篩選只影響地圖圖示，排在結果之後，不擋住路線。
 * 選中的路線卡內含理由（階梯、坡度、電梯）與「開始導航」；條件齊全時自動算路，算路中顯示骨架卡，失敗才出現重試按鈕。
 * 分段控制用 RN 實作（`SegmentedControl`）：`@expo/ui` Host 的 matchContents 會讓 100% 寬度塌成 0。
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
        onPress={option.onSelect}
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
      onPress={option.onSelect}
      style={[
        routeStyles.chip,
        { borderColor: ROUTE_BORDER_COLOR },
        option.selected && { backgroundColor: ROUTE_ACCENT_COLOR, borderColor: ROUTE_ACCENT_COLOR },
        option.disabled && routeStyles.disabled,
      ]}>
      {icon ? <Icon name={icon} size={ICON_SIZE.body} color={option.selected ? ROUTE_ON_ACCENT_COLOR : colors.text} /> : null}
      <Text style={[routeStyles.chipText, { color: option.selected ? ROUTE_ON_ACCENT_COLOR : colors.text }]}>{option.label}</Text>
    </PressableScale>
  );

  /** 直接在起點／終點那一列輸入（不再另開搜尋框）；自動完成建議顯示在卡片下方。 */
  const renderInput = (label: string) => (
    <TextInput
      autoFocus
      value={model.query}
      onChangeText={model.onQueryChange}
      onFocus={model.onInputFocus}
      placeholder={model.labels.searchPlaceholder}
      placeholderTextColor={colors.textSecondary}
      accessibilityLabel={label}
      style={[routeStyles.flex, styles.searchInput, { color: colors.text }]}
      autoCorrect={false}
      returnKeyType="search"
    />
  );

  const renderEditorTrailing = () =>
    model.suggestionsLoading || model.resolving ? (
      <ActivityIndicator size="small" color={colors.textSecondary} />
    ) : (
      <PressableScale accessibilityRole="button" accessibilityLabel={model.labels.cancel} onPress={model.onCancelEdit} hitSlop={14}>
        <Icon name="close" size={ICON_SIZE.body} color={colors.textSecondary} />
      </PressableScale>
    );

  const renderEditor = () => (
    <View style={routeStyles.section}>
      {model.editing === 'origin' ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={model.labels.useMyLocation}
          onPress={model.onUseMyLocation}
          style={[routeStyles.listRow, { borderColor: ROUTE_BORDER_COLOR }]}>
          <Icon name="navigation" size={ICON_SIZE.body} color={ROUTE_ORIGIN_COLOR} />
          <Text style={[routeStyles.bodyText, routeStyles.flex, { color: colors.text }]}>{model.labels.useMyLocation}</Text>
        </PressableScale>
      ) : null}
      {model.suggestions.map((item) => (
        <PressableScale
          key={item.key}
          accessibilityRole="button"
          accessibilityLabel={item.subtitle ? `${item.title}，${item.subtitle}` : item.title}
          onPress={item.onPress}
          style={[routeStyles.listRow, { borderColor: ROUTE_BORDER_COLOR }]}>
          <Icon name="mapPin" size={ICON_SIZE.body} color={colors.textSecondary} />
          <View style={routeStyles.flex}>
            <Text style={[routeStyles.bodyText, { color: colors.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text style={[routeStyles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.subtitle}
              </Text>
            ) : null}
          </View>
        </PressableScale>
      ))}
    </View>
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
            {model.originIsMyLocation && model.editing !== 'origin' ? (
              <Icon name="navigation" size={ICON_SIZE.body} color={ROUTE_ORIGIN_COLOR} />
            ) : (
              <View style={[styles.dot, { borderColor: ROUTE_ORIGIN_COLOR }]} />
            )}
            {model.editing === 'origin' ? (
              renderInput(model.labels.origin)
            ) : (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${model.labels.origin}：${model.originLabel}，${model.labels.edit}`}
                onPress={() => model.onEdit('origin')}
                style={[routeStyles.flex, styles.endpointPress]}>
                <Text style={[routeStyles.bodyText, { color: colors.text }]} numberOfLines={2}>
                  {model.originLabel}
                </Text>
              </PressableScale>
            )}
            {model.editing === 'origin' ? renderEditorTrailing() : null}
          </View>
          <View style={[styles.divider, { backgroundColor: ROUTE_BORDER_COLOR }]} />
          <View style={styles.endpointRow}>
            <View style={[styles.dot, styles.dotFilled, { backgroundColor: ROUTE_DESTINATION_COLOR, borderColor: ROUTE_DESTINATION_COLOR }]} />
            {model.editing === 'destination' ? (
              renderInput(model.labels.destination)
            ) : (
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
            )}
            {model.editing === 'destination' ? (
              renderEditorTrailing()
            ) : model.destinationLabel ? (
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
          onPress={model.onSwap}
          hitSlop={4}
          style={[routeStyles.circleButton, styles.swapButton, { borderColor: ROUTE_BORDER_COLOR }]}>
          <Icon name="arrowUpDown" color={colors.text} />
        </PressableScale>
      </View>

      {model.editing ? renderEditor() : null}

      <SegmentedControl label={model.labels.a11yMode} options={model.routeModes} onSelect={model.onSelectRouteMode} />

      <View style={routeStyles.section}>
        <View accessibilityRole="tablist" accessibilityLabel={model.labels.travelMode} style={[styles.modeTabs, { backgroundColor: surface }]}>
          {model.travelModes.map(renderModeTab)}
        </View>
        {model.gatedHint ? (
          <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{model.gatedHint}</Text>
        ) : null}
      </View>

      {model.error ? (
        <View accessibilityLiveRegion="polite" style={[routeStyles.card, styles.errorCard]}>
          <Icon name="alert" size={ICON_SIZE.body} color={tones.danger} />
          <Text style={[routeStyles.bodyText, routeStyles.flex, { color: tones.danger }]}>{model.error}</Text>
        </View>
      ) : null}

      {model.results ? (
        <View style={styles.results}>
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
          <View style={styles.filters}>
            <Text accessibilityRole="header" style={[routeStyles.sectionTitle, { color: colors.textSecondary }]}>
              {model.labels.facilityFilterTitle}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterStrip}>
              {model.facilityFilters.map((option) => renderOption(option))}
            </ScrollView>
          </View>
        </View>
      ) : model.loading ? (
        <RouteSkeleton label={model.labels.loading} />
      ) : (
        // 不用 `model.canStart`（那是自動算路用的內部閘門，還要求已有定位／目的地）：缺定位或目的地時
        // 按鈕仍要可以按——`model.onStart` 自己會補上對應的錯誤訊息（見 `useRoutePlanViewModel.start`），
        // 不然按鈕會無聲地停用，使用者只會覺得「按了沒反應」，看不出原因。這裡只在真的有非同步操作
        // 進行中（地點解析）時才擋，避免重複送出。
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={model.labels.start}
          accessibilityState={{ disabled: model.resolving }}
          disabled={model.resolving}
          onPress={model.onStart}
          style={[routeStyles.primaryButton, model.resolving && routeStyles.disabled]}>
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
  searchInput: { fontSize: TYPE.callout, minHeight: 44, paddingVertical: 10 },
  modeTabs: { flexDirection: 'row', borderRadius: SHAPE.card, borderCurve: 'continuous', padding: 4, gap: 4 },
  modeTab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 56, borderRadius: SHAPE.control + 2, borderCurve: 'continuous', paddingHorizontal: 4 },
  modeTabText: { fontSize: TYPE.footnote, fontWeight: '600' },
  modeTabTextSelected: { fontWeight: '700' },
  results: { gap: 10 },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  resultsTitle: { fontSize: TYPE.title3, fontWeight: '700', flexShrink: 1 },
  refreshButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, borderRadius: SHAPE.pill, borderCurve: 'continuous', paddingHorizontal: 12 },
  refreshText: { fontSize: TYPE.footnote + 1, fontWeight: '600' },
  filters: { gap: 8, marginTop: 6 },
  filterStrip: { gap: 8, paddingRight: 16 },
  errorCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,59,48,0.12)' },
});
