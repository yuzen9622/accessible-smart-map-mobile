import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';
import { Icon, type IconName } from '@/shared/ui';

import { ROUTE_DESTINATION_COLOR, ROUTE_ORIGIN_COLOR } from '../domain/routeLayerData';
import type { PlanOption, RoutePlanModel } from '../hooks/useRoutePlanViewModel';
import type { TravelMode } from '../types/route';

import RouteCard from './RouteCard';

import {
  ROUTE_ACCENT_COLOR,
  ROUTE_BORDER_COLOR,
  ROUTE_ON_ACCENT_COLOR,
  ROUTE_SURFACE_COLOR,
  routeStyles,
  routeTones,
} from './palette';

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
 * 路線規劃面板（`(sheet)/plan`），iOS／Android 共用。對齊 Web `RoutePlanContent.tsx` 的區塊順序：
 * 起訖點卡片（可交換）→ 無障礙模式 → 交通方式 → 路線選擇。無障礙模式是這個 App 的核心條件，
 * 而且會停用不適用的交通方式，所以排在交通方式之前；路線結果緊接在後（Apple 地圖的路線卡）。
 * 與 Web 不同：像 Apple 地圖的路線卡，條件齊全就自動算路並把路線直接列在下方（開始導航也在這裡），
 * 不再經過「開始規劃」→ 另一頁結果清單；失敗時才出現重試按鈕。
 *
 * 為什麼不用 SwiftUI `Picker(segmented)`（SDD §4.5 表格）：ADR-16 要求模式圖示一律 Lucide，
 * `@expo/ui` `Host` 內放不進 RN SVG；依 ADR-15 以 RN pill 實作並補齊無障礙語意（selected／disabled）。
 * 根節點是單一 ScrollView（formSheet 對多個 sibling 會警告並重疊，見 place 面板註解）。
 */
export default function RoutePlanPanel({ model, onStartNavigation }: RoutePlanPanelProps) {
  const colors = useThemeColors();
  const tones = routeTones(useColorScheme() === 'dark');

  const renderOption = <T extends string>(option: PlanOption<T>, icon?: IconName) => (
    <Pressable
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
      {icon ? <Icon name={icon} size={16} color={option.selected ? ROUTE_ON_ACCENT_COLOR : colors.text} /> : null}
      <Text style={[routeStyles.chipText, { color: option.selected ? ROUTE_ON_ACCENT_COLOR : colors.text }]}>{option.label}</Text>
    </Pressable>
  );

  /** 直接在起點／終點那一列輸入（不再另開搜尋框）；自動完成建議顯示在卡片下方。 */
  const renderInput = (label: string) => (
    <TextInput
      autoFocus
      value={model.query}
      onChangeText={model.onQueryChange}
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
      <Pressable accessibilityRole="button" accessibilityLabel={model.labels.cancel} onPress={model.onCancelEdit} hitSlop={10}>
        <Icon name="close" size={16} color={colors.textSecondary} />
      </Pressable>
    );

  const renderEditor = () => (
    <View style={routeStyles.section}>
      {model.editing === 'origin' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.labels.useMyLocation}
          onPress={model.onUseMyLocation}
          style={[routeStyles.listRow, { borderColor: ROUTE_BORDER_COLOR }]}>
          <Icon name="navigation" size={16} color={ROUTE_ORIGIN_COLOR} />
          <Text style={[routeStyles.bodyText, routeStyles.flex, { color: colors.text }]}>{model.labels.useMyLocation}</Text>
        </Pressable>
      ) : null}
      {model.suggestions.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          accessibilityLabel={item.subtitle ? `${item.title}，${item.subtitle}` : item.title}
          onPress={item.onPress}
          style={[routeStyles.listRow, { borderColor: ROUTE_BORDER_COLOR }]}>
          <Icon name="mapPin" size={16} color={colors.textSecondary} />
          <View style={routeStyles.flex}>
            <Text style={[routeStyles.bodyText, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text style={[routeStyles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.subtitle}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={routeStyles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      <View style={[routeStyles.card, styles.endpoints, { backgroundColor: ROUTE_SURFACE_COLOR }]}>
        <View style={routeStyles.flex}>
          <View style={styles.endpointRow}>
            {model.originIsMyLocation && model.editing !== 'origin' ? (
              <Icon name="navigation" size={16} color={ROUTE_ORIGIN_COLOR} />
            ) : (
              <View style={[styles.dot, { borderColor: ROUTE_ORIGIN_COLOR }]} />
            )}
            {model.editing === 'origin' ? (
              renderInput(model.labels.origin)
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${model.labels.origin}：${model.originLabel}，${model.labels.edit}`}
                onPress={() => model.onEdit('origin')}
                style={[routeStyles.flex, styles.endpointPress]}>
                <Text style={[routeStyles.bodyText, { color: colors.text }]} numberOfLines={1}>
                  {model.originLabel}
                </Text>
              </Pressable>
            )}
            {model.editing === 'origin' ? renderEditorTrailing() : null}
          </View>
          <View style={[styles.divider, { backgroundColor: ROUTE_BORDER_COLOR }]} />
          <View style={styles.endpointRow}>
            <View style={[styles.dot, styles.dotFilled, { backgroundColor: ROUTE_DESTINATION_COLOR, borderColor: ROUTE_DESTINATION_COLOR }]} />
            {model.editing === 'destination' ? (
              renderInput(model.labels.destination)
            ) : (
              <Pressable
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
              </Pressable>
            )}
            {model.editing === 'destination' ? (
              renderEditorTrailing()
            ) : model.destinationLabel ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={model.labels.clear}
                onPress={model.onClearDestination}
                hitSlop={10}>
                <Icon name="close" size={16} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.labels.swap}
          onPress={model.onSwap}
          style={[routeStyles.circleButton, { borderColor: ROUTE_BORDER_COLOR }]}>
          <Icon name="arrowUpDown" color={colors.text} />
        </Pressable>
      </View>

      {model.editing ? renderEditor() : null}

      <View style={routeStyles.section}>
        <Text accessibilityRole="header" style={[routeStyles.sectionTitle, { color: colors.textSecondary }]}>
          {model.labels.a11yMode}
        </Text>
        <View style={routeStyles.chipsRow}>{model.routeModes.map((option) => renderOption(option, option.value === 'normal' ? undefined : 'accessibility'))}</View>
      </View>

      <View style={routeStyles.section}>
        <Text accessibilityRole="header" style={[routeStyles.sectionTitle, { color: colors.textSecondary }]}>
          {model.labels.travelMode}
        </Text>
        <View style={routeStyles.chipsRow}>{model.travelModes.map((option) => renderOption(option, TRAVEL_MODE_ICON[option.value]))}</View>
        {model.gatedHint ? (
          <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{model.gatedHint}</Text>
        ) : null}
      </View>

      {model.error ? (
        <View accessibilityLiveRegion="polite" style={[routeStyles.card, styles.errorCard]}>
          <Icon name="alert" size={16} color={tones.danger} />
          <Text style={[routeStyles.bodyText, routeStyles.flex, { color: tones.danger }]}>{model.error}</Text>
        </View>
      ) : null}

      {model.results ? (
        <View style={routeStyles.section}>
          {model.results.selectedIndex !== null ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={model.labels.startNav}
              onPress={onStartNavigation}
              style={routeStyles.primaryButton}>
              <Icon name="navigation" color={ROUTE_ON_ACCENT_COLOR} />
              <Text style={routeStyles.primaryButtonText}>{model.labels.startNav}</Text>
            </Pressable>
          ) : null}
          <Text accessibilityRole="header" style={[routeStyles.sectionTitle, { color: colors.textSecondary }]}>
            {model.labels.routeOptions}
          </Text>
          {model.results.routes.map((route, index) => (
            <RouteCard
              key={route.routeId || String(index)}
              route={route}
              selected={model.results?.selectedIndex === index}
              onSelect={() => model.onSelectRoute(index)}
              onOpenDetail={() => model.onOpenRouteDetail(index)}
            />
          ))}
        </View>
      ) : model.loading ? (
        <View accessible accessibilityLabel={model.labels.loading} style={styles.loadingRow}>
          <ActivityIndicator color={colors.textSecondary} />
          <Text style={[routeStyles.bodyText, { color: colors.textSecondary }]}>{model.labels.loading}</Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.labels.start}
          accessibilityState={{ disabled: !model.canStart }}
          disabled={!model.canStart}
          onPress={model.onStart}
          style={[routeStyles.primaryButton, !model.canStart && routeStyles.disabled]}>
          <Icon name="navigation" color={ROUTE_ON_ACCENT_COLOR} />
          <Text style={routeStyles.primaryButtonText}>{model.labels.start}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  endpoints: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  endpointRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  endpointPress: { minHeight: 44, justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 26 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, marginHorizontal: 1 },
  dotFilled: { borderWidth: 0 },
  searchInput: { fontSize: 16, minHeight: 44, paddingVertical: 10 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 56 },
  errorCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,59,48,0.12)' },
});
