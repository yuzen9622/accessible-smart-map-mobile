import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import type { ExplorePanelProps, ExploreRow } from './ExplorePanel.types';
import { PLACE_ACCENT_COLOR, PLACE_ACCENT_COLOR_DARK, PLACE_BORDER_COLOR, PLACE_SURFACE_COLOR } from './palette';

/**
 * 首頁／搜尋面板（`(sheet)/explore`），iOS／Android 共用同一實作。
 *
 * - 為什麼不用 SwiftUI `Form`：SDD ADR-16 規定 UI 圖示一律 Lucide（RN SVG），
 *   而 `@expo/ui` `Host` 內的 SwiftUI 內容不能承載 RN 子元件，放不進 Lucide；
 *   依 ADR-15「原生做不到時用 RN 並寫明理由」改為 RN 版型。
 * - 根節點只能有單一捲動容器：舊版 `View`（搜尋框）+ `FlatList` 兩個 sibling 在
 *   iOS 原生 formSheet 內被 `RNScreens` 警告「expects at most 2 subviews」並造成
 *   版面重疊，所以所有區塊都是這個 `ScrollView` 的子孫，不包外層 `View`、不加 sibling。
 * - detent 感知排序：展開（half/full）時順序為品牌 → 搜尋 → 你附近 → 快捷功能 →
 *   收藏地點 → 最近搜尋（對齊 Web `HomeContent.tsx`）；peek 只露出約 15% 高度，
 *   品牌列不渲染，搜尋框保持第一列（SDD §4.5）。代價是 peek ↔ half 切換時搜尋列
 *   位移一個品牌列高度，在不改 detent 的前提下這是唯一做法。
 * - Web 有、但本 App 沒有對應功能的元素（規劃路線入口、麥克風、無障礙篩選、帳號頭像、
 *   快捷功能編輯、回報障礙物／公車到站／無障礙停車 chips）刻意不畫，見 `docs/port-ledger.md`。
 */
export default function ExplorePanel({ model }: ExplorePanelProps) {
  const colors = useThemeColors();
  const accentText = useColorScheme() === 'dark' ? PLACE_ACCENT_COLOR_DARK : PLACE_ACCENT_COLOR;

  const renderRow = (row: ExploreRow, icon: 'clock' | 'bookmark') => (
    <Pressable
      key={row.key}
      accessibilityRole="button"
      accessibilityLabel={row.title}
      onPress={row.onPress}
      style={[styles.listRow, { borderColor: PLACE_BORDER_COLOR }]}>
      <Icon name={icon} size={16} color={icon === 'bookmark' ? accentText : colors.textSecondary} />
      <Text style={[styles.listRowText, { color: colors.text }]} numberOfLines={1}>
        {row.title}
      </Text>
      <Icon name="chevronRight" size={16} color={colors.textSecondary} />
    </Pressable>
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      {model.showBrand ? (
        <View style={styles.brandRow}>
          <Icon name="accessibility" size={22} color={accentText} />
          <Text accessibilityRole="header" style={[styles.brandText, { color: colors.text }]}>
            {model.labels.appTitle}
          </Text>
        </View>
      ) : null}

      <View style={[styles.searchBar, { backgroundColor: colors.backgroundElement }]}>
        <Icon name="search" color={colors.textSecondary} />
        <TextInput
          value={model.query}
          onChangeText={model.onQueryChange}
          placeholder={model.labels.searchPlaceholder}
          placeholderTextColor={colors.textSecondary}
          style={[styles.searchInput, { color: colors.text }]}
          accessibilityLabel={model.labels.searchPlaceholder}
          autoCorrect={false}
          returnKeyType="search"
        />
        {model.loading ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
      </View>

      {model.mode === 'history' ? (
        <>
          {model.nearby.cards.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="mapPin" size={16} color={colors.textSecondary} />
                <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  {model.nearby.title}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsRow}>
                {model.nearby.cards.map((card) => (
                  <Pressable
                    key={card.key}
                    accessibilityRole="button"
                    accessibilityLabel={card.accessibilityLabel}
                    onPress={card.onPress}
                    style={[styles.nearbyCard, { backgroundColor: PLACE_SURFACE_COLOR }]}>
                    <View style={[styles.nearbyIcon, { backgroundColor: colors.background }]}>
                      <Icon name={card.iconName} size={18} color={accentText} />
                    </View>
                    <Text style={[styles.nearbyTitle, { color: colors.text }]} numberOfLines={1}>
                      {card.title}
                    </Text>
                    <Text style={[styles.nearbyDistance, { color: colors.textSecondary }]}>{card.distanceText}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {model.labels.quickActions}
            </Text>
            <View style={styles.chipsRow}>
              {model.quickActions.map((action) => (
                <Pressable
                  key={action.key}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={action.onPress}
                  style={[styles.chip, { borderColor: PLACE_BORDER_COLOR, backgroundColor: colors.background }]}>
                  <Icon name={action.iconName} color={accentText} />
                  <Text style={[styles.chipText, { color: colors.text }]}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {model.savedRows.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="bookmark" size={16} color={colors.textSecondary} />
                <Text accessibilityRole="header" style={[styles.sectionTitle, styles.flex, { color: colors.textSecondary }]}>
                  {model.labels.savedPlacesTitle}
                </Text>
                {model.savedViewAll ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={model.savedViewAll.label}
                    onPress={model.savedViewAll.onPress}
                    style={styles.viewAll}>
                    <Text style={[styles.viewAllText, { color: accentText }]}>{model.savedViewAll.label}</Text>
                  </Pressable>
                ) : null}
              </View>
              {model.savedRows.map((row) => renderRow(row, 'bookmark'))}
            </View>
          ) : null}

          {model.historyRows.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="clock" size={16} color={colors.textSecondary} />
                <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  {model.labels.recentSearches}
                </Text>
              </View>
              {model.historyRows.map((row) => renderRow(row, 'clock'))}
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.section}>
          {model.resultRows.length > 0 ? (
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {model.labels.searchResults}
            </Text>
          ) : null}
          {model.resultRows.map((row) => (
            <Pressable
              key={row.key}
              accessibilityRole="button"
              accessibilityLabel={row.subtitle ? `${row.title}，${row.subtitle}` : row.title}
              accessibilityState={{ disabled: row.disabled }}
              disabled={row.disabled}
              onPress={row.onPress}
              style={[styles.resultRow, { borderColor: PLACE_BORDER_COLOR }, row.disabled && !row.resolving && styles.disabled]}>
              <Icon name="mapPin" size={16} color={colors.textSecondary} />
              <View style={styles.flex}>
                <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
                  {row.title}
                </Text>
                {row.subtitle ? (
                  <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {row.subtitle}
                  </Text>
                ) : null}
              </View>
              {row.resolving ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
            </Pressable>
          ))}
          {model.resultRows.length === 0 && !model.loading ? (
            <View style={styles.empty}>
              <Icon name="search" size={28} color={colors.textSecondary} />
              <Text accessibilityRole="text" style={[styles.emptyText, { color: colors.textSecondary }]}>
                {model.labels.noResults}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 16 },
  flex: { flex: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  brandText: { fontSize: 20, fontWeight: '700', flexShrink: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 22,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '600' },
  cardsRow: { gap: 10, paddingRight: 16 },
  nearbyCard: { width: 132, minHeight: 88, borderRadius: 14, padding: 12, gap: 4 },
  nearbyIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  nearbyTitle: { fontSize: 14, fontWeight: '600' },
  nearbyDistance: { fontSize: 12 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  viewAll: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  viewAllText: { fontSize: 14, fontWeight: '500' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listRowText: { flex: 1, fontSize: 15 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  disabled: { opacity: 0.4 },
  resultTitle: { fontSize: 15, fontWeight: '500' },
  resultSubtitle: { fontSize: 12 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
