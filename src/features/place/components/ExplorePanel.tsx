import { Text, TextInput } from '@/shared/ui/typography/Text';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useFontScale } from '@/shared/preferences';
import { ACCENT_FILL, RADIUS, SPACE, TYPE, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import type { ExplorePanelProps, ExploreRow } from './ExplorePanel.types';
import { PLACE_BORDER_COLOR } from './palette';

/**
 * 首頁／搜尋面板（`(sheet)/explore`），iOS／Android 共用同一實作。
 *
 * - 為什麼不用 SwiftUI `Form`：SDD ADR-16 規定 UI 圖示一律 Lucide（RN SVG），
 *   而 `@expo/ui` `Host` 內的 SwiftUI 內容不能承載 RN 子元件；依 ADR-15 改為 RN 版型。
 * - 根節點只能有單一捲動容器：舊版 `View`（搜尋框）+ `FlatList` 兩個 sibling 在
 *   iOS 原生 formSheet 內被 `RNScreens` 警告「expects at most 2 subviews」並造成
 *   版面重疊，所以所有區塊都是這個 `ScrollView` 的子孫，不包外層 `View`、不加 sibling。
 * - 版型（2026-10-11 調整，使用者回饋）：拿掉「去哪裡？」大標，搜尋框往上移，只留右側行動需求 pill；
 *   搜尋框下面是「快速服務」3 欄格狀（AI 助理／公車到站／回報障礙，拿掉規劃路線——地點詳情頁本來就有
 *   主按鈕）→ 附近設施摘要 → 常去地點（標題旁一顆小「新增」，不再混在圓鈕那排裡）。「最近搜尋」從首頁
 *   移除，改成搜尋框取得焦點、還沒打字時才出現（`mode === 'history'`），每筆可直接刪除。
 *   地圖圖層開關是 `features/map` 的 `LayerChips`，貼在 sheet 上緣，不在這個面板內。
 */
export default function ExplorePanel({ model }: ExplorePanelProps) {
  const colors = useThemeColors();
  const tones = useSemanticColors();
  const accentText = tones.accent;
  const appScale = useFontScale();
  const { fontScale: systemScale } = useWindowDimensions();
  const largeText = appScale * systemScale > 1.3;

  const renderHistoryRow = (row: ExploreRow) => (
    <View key={row.key} style={[styles.historyRow, { borderColor: PLACE_BORDER_COLOR }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={row.title} onPress={row.onPress} style={styles.historyRowPress}>
        <Icon name="clock" size={16} color={colors.textSecondary} />
        <Text style={[styles.listRowText, { color: colors.text }]} numberOfLines={1}>
          {row.title}
        </Text>
      </Pressable>
      {row.onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={row.deleteA11yLabel ?? row.title}
          onPress={row.onDelete}
          hitSlop={8}
          style={styles.historyDelete}>
          <Icon name="close" size={16} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      {model.showBrand ? (
        <View style={styles.needsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={model.header.needs.accessibilityLabel}
            onPress={model.header.needs.onPress}
            hitSlop={4}
            style={({ pressed }) => [styles.needsPill, largeText && styles.needsPillStack, { backgroundColor: tones.accentSoft }, pressed && styles.pressed]}>
            <Icon name="accessibility" size={17} color={accentText} />
            <Text style={[styles.needsText, { color: accentText }]} numberOfLines={largeText ? undefined : 1}>
              {model.header.needs.label}
            </Text>
            <Icon name="chevronDown" size={14} color={accentText} />
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.searchBar, { backgroundColor: colors.backgroundElement }]}>
        <Icon name="search" color={colors.textSecondary} />
        <TextInput
          value={model.query}
          onChangeText={model.onQueryChange}
          onFocus={model.onSearchFocus}
          onBlur={model.onSearchBlur}
          placeholder={model.labels.searchPlaceholder}
          placeholderTextColor={colors.textSecondary}
          style={[styles.searchInput, { color: colors.text }]}
          accessibilityLabel={model.labels.searchPlaceholder}
          autoCorrect={false}
          returnKeyType="search"
        />
        {model.loading ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.account.label}
          onPress={model.account.onPress}
          hitSlop={6}
          style={[styles.avatar, { backgroundColor: model.account.initial ? ACCENT_FILL : colors.background }]}>
          {model.account.initial ? (
            <Text style={styles.avatarText}>{model.account.initial}</Text>
          ) : (
            <Icon name="user" size={22} color={colors.textSecondary} />
          )}
        </Pressable>
      </View>

      {model.mode === 'history' ? (
        // 搜尋框取得焦點、還沒打字：只顯示最近搜尋，每筆可直接刪除
        <View style={styles.section}>
          {model.historyRows.length > 0 ? (
            <>
              <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
                {model.labels.recentSearches}
              </Text>
              {model.historyRows.map(renderHistoryRow)}
            </>
          ) : (
            <View style={styles.empty}>
              <Icon name="clock" size={28} color={colors.textSecondary} />
              <Text accessibilityRole="text" style={[styles.emptyText, { color: colors.textSecondary }]}>
                {model.labels.recentSearches}
              </Text>
            </View>
          )}
        </View>
      ) : model.mode === 'idle' ? (
        <>
          <View style={styles.section}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
              {model.labels.quickServices}
            </Text>
            <View style={styles.quickGrid}>
              {model.quickActions.map((action) => (
                <Pressable
                  key={action.key}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={action.onPress}
                  style={({ pressed }) => [styles.quickTile, { backgroundColor: tones.accentSoft }, pressed && styles.pressed]}>
                  <Icon name={action.iconName} size={22} color={accentText} />
                  <Text style={[styles.quickTileText, { color: accentText }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {model.nearbySummary ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={model.nearbySummary.text}
              onPress={model.nearbySummary.onPress}
              style={({ pressed }) => [styles.summaryCard, { backgroundColor: colors.backgroundElement }, pressed && styles.pressed]}>
              {model.nearbySummary.dots.length > 0 ? (
                <View style={styles.summaryDots}>
                  {model.nearbySummary.dots.map((dot, index) => (
                    <View
                      key={dot.key}
                      style={[
                        styles.summaryDot,
                        { backgroundColor: dot.color, borderColor: colors.backgroundElement },
                        index > 0 && styles.summaryDotOverlap,
                      ]}>
                      <Icon name={dot.iconName} size={15} color="#FFFFFF" />
                    </View>
                  ))}
                </View>
              ) : (
                <Icon name="accessibility" size={22} color={colors.textSecondary} />
              )}
              <Text style={[styles.summaryText, { color: colors.text }]}>{model.nearbySummary.text}</Text>
              <Icon name="chevronRight" size={16} color={colors.textSecondary} />
            </Pressable>
          ) : null}

          {/* 常去地點：標題旁一顆小「新增」開收藏清單；不再是圓鈕那排裡的第 4 顆（設計調整 2026-10-11） */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text accessibilityRole="header" style={[styles.sectionTitle, styles.flex, { color: colors.text }]}>
                {model.labels.savedPlaces}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={model.addShortcut.accessibilityLabel}
                onPress={model.addShortcut.onPress}
                hitSlop={8}
                style={styles.addShortcutButton}>
                <Icon name="plus" size={18} color={accentText} />
              </Pressable>
            </View>
            {model.shortcuts.length > 0 ? (
              <View style={styles.shortcutsRow}>
                {model.shortcuts.map((shortcut) => (
                  <Pressable
                    key={shortcut.key}
                    accessibilityRole="button"
                    accessibilityLabel={shortcut.meta ? `${shortcut.title}，${shortcut.meta}` : shortcut.title}
                    onPress={shortcut.onPress}
                    style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}>
                    <View style={[styles.shortcutIcon, { backgroundColor: tones.accentSoft }]}>
                      <Icon name={shortcut.iconName} size={24} color={accentText} />
                    </View>
                    <Text style={[styles.shortcutTitle, { color: colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
                      {shortcut.title}
                    </Text>
                    {shortcut.meta ? (
                      <Text style={[styles.shortcutMeta, { color: colors.textSecondary }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
                        {shortcut.meta}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
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
                <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={2}>
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
          {model.error ? (
            <View style={styles.empty} accessibilityRole="alert" accessible accessibilityLabel={model.labels.networkError}>
              <Icon name="alert" size={28} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{model.labels.networkError}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={model.labels.retry}
                onPress={model.onRetry}
                style={({ pressed }) => [styles.retryButton, { backgroundColor: colors.backgroundElement }, pressed && styles.pressed]}>
                <Text style={[styles.resultTitle, { color: colors.text }]}>{model.labels.retry}</Text>
              </Pressable>
            </View>
          ) : model.resultRows.length === 0 && !model.loading ? (
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
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  content: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: 32, gap: 18 },
  flex: { flex: 1 },
  needsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  needsPillStack: { maxWidth: '100%' },
  needsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    maxWidth: 220,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
  },
  needsText: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  addShortcutButton: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  shortcutsRow: { flexDirection: 'row', gap: SPACE.lg, paddingHorizontal: 4 },
  shortcut: { width: 76, alignItems: 'center', gap: 4 },
  shortcutIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  shortcutTitle: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  shortcutMeta: { fontSize: 12, textAlign: 'center' },
  quickGrid: { flexDirection: 'row', gap: SPACE.sm },
  quickTile: {
    flex: 1,
    minHeight: 76,
    borderRadius: RADIUS.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACE.sm,
    paddingHorizontal: 4,
  },
  quickTileText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: RADIUS.card, padding: 14, minHeight: 58 },
  summaryDots: { flexDirection: 'row' },
  summaryDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryDotOverlap: { marginLeft: -10 },
  summaryText: { flex: 1, fontSize: 15, lineHeight: 21 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    borderRadius: RADIUS.pill,
    paddingLeft: 14,
    paddingRight: 4,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  section: { gap: 8 },
  sectionTitle: { fontSize: TYPE.body, fontWeight: '700' },
  pressed: { opacity: 0.6 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyRowPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  historyDelete: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
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
  retryButton: { minHeight: 44, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
