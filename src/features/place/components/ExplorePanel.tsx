import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';
import { EmptyState } from '@/shared/ui';

import type { ExplorePanelProps, ExploreRow } from './ExplorePanel.types';
import { PLACE_BORDER_COLOR } from './palette';

/**
 * RN fallback（Android 亦用此檔）。根節點只能有單一捲動容器——原本的
 * `View`（搜尋框）+ `FlatList`（結果）兩個 sibling 在 iOS 原生 formSheet 的
 * `ScrollView` 內會被警告「expects at most 2 subviews」並導致版面重疊
 * （`RNScreens` FormSheet 對子節點數量敏感）。改成搜尋框當
 * `ListHeaderComponent`，讓 `FlatList` 本身是唯一根節點。
 */
export default function ExplorePanel({ model }: ExplorePanelProps) {
  const colors = useThemeColors();
  const rows = model.mode === 'history' ? model.historyRows : model.resultRows;

  const header = (
    <View style={styles.header}>
      <View style={[styles.searchBar, { backgroundColor: colors.backgroundElement, borderColor: PLACE_BORDER_COLOR }]}>
        <TextInput
          value={model.query}
          onChangeText={model.onQueryChange}
          placeholder={model.labels.searchPlaceholder}
          placeholderTextColor={colors.textSecondary}
          style={[styles.searchInput, { color: colors.text }]}
          accessibilityLabel={model.labels.searchPlaceholder}
          autoCorrect={false}
        />
        {model.loading ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
      </View>

      {model.mode === 'history' ? (
        <View style={styles.shortcuts}>
          <Pressable
            accessibilityRole="button"
            onPress={model.onOpenNearby}
            style={[styles.shortcutRow, { borderColor: PLACE_BORDER_COLOR }]}>
            <Text style={[styles.shortcutText, { color: colors.text }]}>{model.labels.nearbyA11y}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={model.onOpenSaved}
            style={[styles.shortcutRow, { borderColor: PLACE_BORDER_COLOR }]}>
            <Text style={[styles.shortcutText, { color: colors.text }]}>{model.labels.savedPlaces}</Text>
          </Pressable>
        </View>
      ) : null}

      {rows.length > 0 ? (
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          {model.mode === 'history' ? model.labels.searchHistory : model.labels.searchResults}
        </Text>
      ) : null}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(item: ExploreRow) => item.key}
      ListHeaderComponent={header}
      ListEmptyComponent={
        model.mode === 'results' && !model.loading ? (
          <EmptyState title={model.labels.noResults} systemImage="magnifyingglass" />
        ) : null
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.subtitle ? `${item.title}，${item.subtitle}` : item.title}
          disabled={item.disabled}
          onPress={item.onPress}
          style={[styles.resultRow, { borderColor: PLACE_BORDER_COLOR }]}>
          <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          {item.subtitle ? (
            <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.subtitle}
            </Text>
          ) : null}
          {item.resolving ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  header: { gap: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontSize: 16 },
  shortcuts: { gap: 8, marginBottom: 4 },
  shortcutRow: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  shortcutText: { fontSize: 15, fontWeight: '500' },
  sectionLabel: { fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  resultRow: { minHeight: 48, justifyContent: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  resultTitle: { fontSize: 15, fontWeight: '500' },
  resultSubtitle: { fontSize: 12 },
});
