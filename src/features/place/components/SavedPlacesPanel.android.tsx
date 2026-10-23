import { Text } from '@/shared/ui/typography/Text';
import { FlatList, StyleSheet, View } from 'react-native';

import { useThemeColors, WHITE, DANGER_FILL, TYPE, SHAPE } from '@/shared/theme';
import { EmptyState } from '@/shared/ui';

import type { SavedPlaceRow, SavedPlacesPanelProps } from './SavedPlacesPanel.types';
import { PLACE_ACCENT_COLOR, PLACE_BORDER_COLOR } from './palette';
import PressableScale from '@/shared/ui/PressableScale';

/**
 * RN fallback（Android 亦用此檔）。根節點只能有單一捲動容器，所以計數／
 * 分類篩選列都當 `FlatList` 的 `ListHeaderComponent`，不是跟它平行的
 * sibling（理由同 `ExplorePanel.tsx`）。
 */
export default function SavedPlacesPanel({ model }: SavedPlacesPanelProps) {
  const colors = useThemeColors();

  if (model.status === 'empty') {
    return <EmptyState title={model.emptyTitle} description={model.emptyDescription} systemImage="bookmark" />;
  }

  const header = (
    <View style={styles.header}>
      <Text style={[styles.count, { color: colors.textSecondary }]}>{model.countLabel}</Text>
      {model.filters.length > 0 ? (
        <View style={styles.filterRow}>
          {model.filters.map((filter) => (
            <PressableScale
              key={filter.value}
              accessibilityRole="button"
              accessibilityState={{ selected: filter.isSelected }}
              onPress={filter.onSelect}
              style={[
                styles.filterChip,
                { borderColor: PLACE_BORDER_COLOR },
                filter.isSelected && { backgroundColor: PLACE_ACCENT_COLOR, borderColor: PLACE_ACCENT_COLOR },
              ]}>
              <Text style={{ color: filter.isSelected ? WHITE : colors.text, fontSize: TYPE.caption, fontWeight: '600' }}>
                {filter.label}
              </Text>
            </PressableScale>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      data={model.rows}
      keyExtractor={(item: SavedPlaceRow) => item.key}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <View style={[styles.row, { borderColor: PLACE_BORDER_COLOR }]}>
          <PressableScale feedback="highlight"
            accessibilityRole="button"
            accessibilityLabel={item.categoryLabel ? `${item.title}，${item.categoryLabel}` : item.title}
            onPress={item.onPress}
            style={styles.rowMain}>
            <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            {item.categoryLabel ? <Text style={{ color: colors.textSecondary, fontSize: TYPE.caption }}>{item.categoryLabel}</Text> : null}
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={item.removeAccessibilityLabel}
            onPress={item.onRemove}
            style={styles.removeButton}>
            <Text style={{ color: DANGER_FILL }}>{model.unsaveLabel}</Text>
          </PressableScale>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  count: { fontSize: TYPE.caption },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: SHAPE.pill, borderCurve: 'continuous',
    paddingHorizontal: 12,
  },
  list: { gap: 8, paddingBottom: 24 },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  rowMain: { flex: 1, gap: 2, minHeight: 48, justifyContent: 'center' },
  rowTitle: { fontSize: TYPE.subhead, fontWeight: '600' },
  removeButton: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
