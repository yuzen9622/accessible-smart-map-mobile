import { Text, TextInput } from '@/shared/ui/typography/Text';
import { ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useFontScale } from '@/shared/preferences';
import { ACCENT_FILL, SPACE, TYPE, useSemanticColors, useThemeColors, WHITE, SHAPE, ELEVATION, ICON_SIZE } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import type { ExplorePanelProps, ExploreRow } from './ExplorePanel.types';
import { PLACE_BORDER_COLOR } from './palette';
import PressableScale from '@/shared/ui/PressableScale';

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
 *   地圖圖層篩選（電梯／坡道／廁所／停車場）拿掉首頁浮動按鈕，只留在搜尋/附近清單流程與
 *   設定頁「地圖預設顯示」（測試人員回饋：篩選入口重複；2026-10-11）。
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
      <PressableScale feedback="highlight" accessibilityRole="button" accessibilityLabel={row.title} onPress={row.onPress} style={styles.historyRowPress}>
        <Icon name="clock" size={ICON_SIZE.body} color={colors.textSecondary} />
        <Text style={[styles.listRowText, { color: colors.text }]} numberOfLines={1}>
          {row.title}
        </Text>
      </PressableScale>
      {row.onDelete ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={row.deleteA11yLabel ?? row.title}
          onPress={row.onDelete}
          hitSlop={8}
          style={styles.historyDelete}>
          <Icon name="close" size={ICON_SIZE.body} color={colors.textSecondary} />
        </PressableScale>
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
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={model.header.needs.accessibilityLabel}
            onPress={model.header.needs.onPress}
            hitSlop={4}
            style={[styles.needsPill, largeText && styles.needsPillStack, { backgroundColor: tones.accentSoft }]}>
            <Icon name="accessibility" size={ICON_SIZE.body} color={accentText} />
            <Text style={[styles.needsText, { color: accentText }]} numberOfLines={largeText ? undefined : 1}>
              {model.header.needs.label}
            </Text>
            <Icon name="chevronDown" size={ICON_SIZE.caption} color={accentText} />
          </PressableScale>
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
        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ selected: model.voiceInput.status === 'listening' }}
          accessibilityLabel={model.voiceInput.accessibilityLabel}
          onPress={model.voiceInput.onToggle}
          hitSlop={6}
          style={styles.voiceButton}>
          <Icon
            name="audioLines"
            size={ICON_SIZE.body}
            color={model.voiceInput.status === 'listening' ? tones.accent : colors.textSecondary}
          />
        </PressableScale>
        {model.mode !== 'idle' ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={model.labels.cancelSearch}
            onPress={model.onCancelSearch}
            hitSlop={6}
            style={styles.cancelButton}>
            <Text style={[styles.cancelButtonText, { color: accentText }]}>{model.labels.cancelSearch}</Text>
          </PressableScale>
        ) : (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={model.account.label}
            onPress={model.account.onPress}
            hitSlop={6}
            style={[styles.avatar, { backgroundColor: model.account.initial ? ACCENT_FILL : colors.background }]}>
            {model.account.initial ? (
              <Text style={styles.avatarText}>{model.account.initial}</Text>
            ) : (
              <Icon name="user" size={ICON_SIZE.control} color={colors.textSecondary} />
            )}
          </PressableScale>
        )}
      </View>

      {model.mode === 'history' ? (
        // 搜尋框取得焦點、還沒打字：最近搜尋 + 分類捷徑（像 Google 地圖的「在附近找」／「更多搜尋類別」）
        <>
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
                <Icon name="clock" size={ICON_SIZE.tile} color={colors.textSecondary} />
                <Text accessibilityRole="text" style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {model.labels.recentSearches}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
              {model.categoryShortcuts.sectionTitle}
            </Text>
            <View style={styles.facilityGrid}>
              {model.categoryShortcuts.nearbyFacilities.map((item) => (
                <PressableScale
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={item.onPress}
                  style={[styles.facilityTile, { backgroundColor: colors.backgroundElement }]}>
                  <Icon name={item.iconName} size={ICON_SIZE.control} color={accentText} />
                  <Text style={[styles.facilityTileText, { color: colors.text }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
              {model.categoryShortcuts.moreTitle}
            </Text>
            {model.categoryShortcuts.moreCategories.map((item) => (
              <PressableScale feedback="highlight"
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={item.onPress}
                style={[styles.categoryRow, { borderColor: PLACE_BORDER_COLOR }]}>
                <Icon name={item.iconName} size={ICON_SIZE.control} color={colors.textSecondary} />
                <Text style={[styles.categoryRowText, { color: colors.text }]}>{item.label}</Text>
                <Icon name="chevronRight" size={ICON_SIZE.body} color={colors.textSecondary} />
              </PressableScale>
            ))}
          </View>
        </>
      ) : model.mode === 'idle' ? (
        <>
          <View style={styles.section}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
              {model.labels.quickServices}
            </Text>
            <View style={styles.quickGrid}>
              {model.quickActions.map((action) => (
                <PressableScale
                  key={action.key}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={action.onPress}
                  style={[styles.quickTile, { backgroundColor: colors.backgroundElement }]}>
                  <View style={[styles.quickTileIcon, { backgroundColor: action.color }]}>
                    <Icon name={action.iconName} size={ICON_SIZE.control} color={WHITE} />
                  </View>
                  <Text style={[styles.quickTileText, { color: colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
                    {action.label}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </View>

          {model.nearbySummary ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={model.nearbySummary.text}
              onPress={model.nearbySummary.onPress}
              style={[styles.summaryCard, { backgroundColor: colors.backgroundElement }]}>
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
                      <Icon name={dot.iconName} size={ICON_SIZE.caption} color={WHITE} />
                    </View>
                  ))}
                </View>
              ) : (
                <Icon name="accessibility" size={ICON_SIZE.control} color={colors.textSecondary} />
              )}
              <Text style={[styles.summaryText, { color: colors.text }]}>{model.nearbySummary.text}</Text>
              <Icon name="chevronRight" size={ICON_SIZE.body} color={colors.textSecondary} />
            </PressableScale>
          ) : null}

          {/* 常去地點：標題旁一顆小「新增」開收藏清單；不再是圓鈕那排裡的第 4 顆（設計調整 2026-10-11） */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text accessibilityRole="header" style={[styles.sectionTitle, styles.flex, { color: colors.text }]}>
                {model.labels.savedPlaces}
              </Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={model.addShortcut.accessibilityLabel}
                onPress={model.addShortcut.onPress}
                hitSlop={8}
                style={styles.addShortcutButton}>
                <Icon name="plus" size={ICON_SIZE.body} color={accentText} />
              </PressableScale>
            </View>
            {model.shortcutFilters.length > 1 ? (
              <View style={styles.shortcutFilterRow}>
                {model.shortcutFilters.map((filter) => (
                  <PressableScale
                    key={filter.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filter.selected }}
                    accessibilityLabel={filter.label}
                    onPress={filter.onToggle}
                    style={[
                      styles.shortcutFilterChip,
                      { borderColor: PLACE_BORDER_COLOR },
                      filter.selected && { backgroundColor: tones.accentSoft, borderColor: tones.accent },
                    ]}>
                    <Text style={[styles.shortcutFilterText, { color: filter.selected ? accentText : colors.textSecondary }]}>
                      {filter.label}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            ) : null}
            {model.shortcuts.length > 0 ? (
              <View style={styles.shortcutsGrid}>
                {model.shortcuts.map((shortcut) => (
                  <PressableScale
                    key={shortcut.key}
                    accessibilityRole="button"
                    accessibilityLabel={shortcut.meta ? `${shortcut.title}，${shortcut.meta}` : shortcut.title}
                    onPress={shortcut.onPress}
                    style={styles.shortcut}>
                    <View style={[styles.shortcutIcon, { backgroundColor: shortcut.color }]}>
                      <Icon name={shortcut.iconName} size={ICON_SIZE.map} color={WHITE} />
                    </View>
                    <Text style={[styles.shortcutTitle, { color: colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
                      {shortcut.title}
                    </Text>
                    {shortcut.meta ? (
                      <Text style={[styles.shortcutMeta, { color: colors.textSecondary }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
                        {shortcut.meta}
                      </Text>
                    ) : null}
                  </PressableScale>
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
            <PressableScale feedback="highlight"
              key={row.key}
              accessibilityRole="button"
              accessibilityLabel={row.subtitle ? `${row.title}，${row.subtitle}` : row.title}
              accessibilityState={{ disabled: row.disabled }}
              disabled={row.disabled}
              onPress={row.onPress}
              style={[styles.resultRow, { borderColor: PLACE_BORDER_COLOR }, row.disabled && !row.resolving && styles.disabled]}>
              <Icon name="mapPin" size={ICON_SIZE.body} color={colors.textSecondary} />
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
            </PressableScale>
          ))}
          {model.error ? (
            <View style={styles.empty} accessibilityRole="alert" accessible accessibilityLabel={model.labels.networkError}>
              <Icon name="alert" size={ICON_SIZE.tile} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{model.labels.networkError}</Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={model.labels.retry}
                onPress={model.onRetry}
                style={[styles.retryButton, { backgroundColor: colors.backgroundElement }]}>
                <Text style={[styles.resultTitle, { color: colors.text }]}>{model.labels.retry}</Text>
              </PressableScale>
            </View>
          ) : model.resultRows.length === 0 && model.loading ? (
            // 剛打完字、結果還沒回來：不擋著不顯示任何東西，不然使用者會以為整個畫面卡住
            // （使用者回饋 2026-10-15：搜尋「餐廳」時空白超過 2 秒，以為沒反應、不知道怎麼辦）。
            <View style={styles.empty} accessible accessibilityLabel={model.labels.searching}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text accessibilityRole="text" style={[styles.emptyText, { color: colors.textSecondary }]}>
                {model.labels.searching}
              </Text>
            </View>
          ) : model.resultRows.length === 0 && !model.loading ? (
            <View style={styles.empty}>
              <Icon name="search" size={ICON_SIZE.tile} color={colors.textSecondary} />
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
  avatar: { width: 36, height: 36, borderRadius: SHAPE.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: WHITE, fontSize: TYPE.callout, fontWeight: '700' },
  cancelButton: { minHeight: 36, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { fontSize: TYPE.subhead, fontWeight: '600' },
  voiceButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
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
    borderRadius: SHAPE.pill, borderCurve: 'continuous',
  },
  needsText: { fontSize: TYPE.subhead, fontWeight: '600', flexShrink: 1 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  addShortcutButton: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  shortcutFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginBottom: SPACE.sm },
  shortcutFilterChip: {
    paddingHorizontal: SPACE.md,
    paddingVertical: 6,
    borderRadius: SHAPE.pill, borderCurve: 'continuous',
    borderWidth: 1,
  },
  shortcutFilterText: { fontSize: TYPE.footnote, fontWeight: '600' },
  shortcutsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  shortcut: { width: '25%', alignItems: 'center', gap: 4, paddingVertical: SPACE.sm },
  shortcutIcon: {
    width: 56,
    height: 56,
    borderRadius: SHAPE.pill, borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: ELEVATION.floating,
  },
  shortcutTitle: { fontSize: TYPE.footnote, fontWeight: '600', textAlign: 'center' },
  shortcutMeta: { fontSize: TYPE.caption, textAlign: 'center' },
  quickGrid: { flexDirection: 'row', gap: SPACE.sm },
  quickTile: {
    flex: 1,
    minHeight: 84,
    borderRadius: SHAPE.card, borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: SPACE.sm,
    paddingHorizontal: 4,
    boxShadow: ELEVATION.raised,
  },
  quickTileIcon: { width: 40, height: 40, borderRadius: SHAPE.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  quickTileText: { fontSize: TYPE.footnote, fontWeight: '700', textAlign: 'center' },
  facilityGrid: { flexDirection: 'row', gap: SPACE.sm },
  facilityTile: {
    flex: 1,
    minHeight: 72,
    borderRadius: SHAPE.card, borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACE.sm,
    paddingHorizontal: 4,
  },
  facilityTileText: { fontSize: TYPE.caption, fontWeight: '600', textAlign: 'center' },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: 48,
    paddingVertical: SPACE.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  categoryRowText: { flex: 1, fontSize: TYPE.subhead },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: SHAPE.card, borderCurve: 'continuous', padding: 14, minHeight: 58 },
  summaryDots: { flexDirection: 'row' },
  summaryDot: {
    width: 30,
    height: 30,
    borderRadius: SHAPE.pill, borderCurve: 'continuous',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryDotOverlap: { marginLeft: -10 },
  summaryText: { flex: 1, fontSize: TYPE.subhead, lineHeight: 21 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    borderRadius: SHAPE.pill, borderCurve: 'continuous',
    paddingLeft: 14,
    paddingRight: 4,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontSize: TYPE.callout, paddingVertical: 10 },
  section: { gap: 8 },
  sectionTitle: { fontSize: TYPE.body, fontWeight: '700' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyRowPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  historyDelete: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  listRowText: { flex: 1, fontSize: TYPE.subhead },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  disabled: { opacity: 0.4 },
  resultTitle: { fontSize: TYPE.subhead, fontWeight: '600' },
  resultSubtitle: { fontSize: TYPE.caption },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptyText: { fontSize: TYPE.subhead, textAlign: 'center' },
  retryButton: { minHeight: 44, paddingHorizontal: 20, borderRadius: SHAPE.control, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
});
