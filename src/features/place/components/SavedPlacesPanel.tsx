import { useState } from 'react';
import { Text } from '@/shared/ui/typography/Text';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors, WHITE, DANGER_FILL } from '@/shared/theme';
import { EmptyState, Icon } from '@/shared/ui';

import CategoryNameModal from './CategoryNameModal';
import type { SavedPlaceRow, SavedPlacesPanelProps } from './SavedPlacesPanel.types';
import { PLACE_ACCENT_COLOR, PLACE_BORDER_COLOR } from './palette';

type ModalState = { mode: 'create' } | { mode: 'rename'; target: string } | null;

/**
 * RN fallback（Android 亦用此檔）。根節點只能有單一捲動容器，所以計數／
 * 分類篩選列都當 `FlatList` 的 `ListHeaderComponent`，不是跟它平行的
 * sibling（理由同 `ExplorePanel.tsx`）。
 */
export default function SavedPlacesPanel({ model }: SavedPlacesPanelProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const [modalState, setModalState] = useState<ModalState>(null);

  if (model.status === 'empty') {
    return <EmptyState title={model.emptyTitle} description={model.emptyDescription} systemImage="bookmark" />;
  }

  const { categoryManagement } = model;

  const handleLongPressFilter = (name: string) => {
    Alert.alert(name, undefined, [
      { text: categoryManagement.renameLabel, onPress: () => setModalState({ mode: 'rename', target: name }) },
      {
        text: categoryManagement.deleteLabel,
        style: 'destructive',
        onPress: () => {
          Alert.alert(categoryManagement.deleteLabel, t('nativeSavedCategoryDeleteConfirm', { name }), [
            { text: t('cancel'), style: 'cancel' },
            { text: categoryManagement.deleteLabel, style: 'destructive', onPress: () => categoryManagement.onDelete(name) },
          ]);
        },
      },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const header = (
    <View style={styles.header}>
      <Text style={[styles.count, { color: colors.textSecondary }]}>{model.countLabel}</Text>
      <View style={styles.filterRow}>
        {model.filters.map((filter) => (
          <Pressable
            key={filter.value}
            accessibilityRole="button"
            accessibilityState={{ selected: filter.isSelected }}
            onPress={filter.onSelect}
            onLongPress={filter.isCustom ? () => handleLongPressFilter(filter.value) : undefined}
            style={[
              styles.filterChip,
              { borderColor: PLACE_BORDER_COLOR },
              filter.isSelected && { backgroundColor: PLACE_ACCENT_COLOR, borderColor: PLACE_ACCENT_COLOR },
            ]}>
            <Text style={{ color: filter.isSelected ? WHITE : colors.text, fontSize: 12, fontWeight: '500' }}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={categoryManagement.addLabel}
          onPress={() => setModalState({ mode: 'create' })}
          style={[styles.filterChip, styles.addChip, { borderColor: PLACE_BORDER_COLOR }]}>
          <Icon name="plus" size={14} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '500' }}>{categoryManagement.addLabel}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <>
      <FlatList
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.list}
        data={model.rows}
        keyExtractor={(item: SavedPlaceRow) => item.key}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={[styles.row, { borderColor: PLACE_BORDER_COLOR }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.categoryLabel ? `${item.title}，${item.categoryLabel}` : item.title}
              onPress={item.onPress}
              style={styles.rowMain}>
              <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              {item.categoryLabel ? <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.categoryLabel}</Text> : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.removeAccessibilityLabel}
              onPress={item.onRemove}
              style={styles.removeButton}>
              <Text style={{ color: DANGER_FILL }}>{model.unsaveLabel}</Text>
            </Pressable>
          </View>
        )}
      />
      <CategoryNameModal
        visible={modalState !== null}
        title={modalState?.mode === 'rename' ? categoryManagement.renameCategoryTitle : categoryManagement.newCategoryTitle}
        initialValue={modalState?.mode === 'rename' ? modalState.target : undefined}
        onCancel={() => setModalState(null)}
        onSubmit={(name) => {
          if (modalState?.mode === 'rename') categoryManagement.onRename(modalState.target, name);
          else categoryManagement.onCreate(name);
          setModalState(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  count: { fontSize: 12 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
  rowTitle: { fontSize: 15, fontWeight: '500' },
  removeButton: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
