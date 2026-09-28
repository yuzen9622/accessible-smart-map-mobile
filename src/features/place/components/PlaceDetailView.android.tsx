import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';
import { EmptyState } from '@/shared/ui';

import { PLACE_ACCENT_COLOR, PLACE_BORDER_COLOR } from './palette';
import type { PlaceDetailViewProps } from './PlaceDetailView.types';

export default function PlaceDetailView({ model, loading }: PlaceDetailViewProps) {
  const colors = useThemeColors();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.textSecondary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>{model.title}</Text>
      {model.subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{model.subtitle}</Text> : null}

      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          onPress={model.onPlanRoute}
          style={[styles.actionButton, { backgroundColor: PLACE_ACCENT_COLOR }]}>
          <Text style={styles.actionButtonPrimaryText}>{model.planRouteLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.saveLabel}
          accessibilityState={{ selected: model.saved }}
          onPress={model.onToggleSave}
          style={[styles.iconButton, { borderColor: PLACE_BORDER_COLOR }]}>
          <Text style={{ color: colors.text }}>{model.saved ? '★' : '☆'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.shareLabel}
          onPress={model.onShare}
          style={[styles.iconButton, { borderColor: PLACE_BORDER_COLOR }]}>
          <Text style={{ color: colors.text }}>{'↗'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.copyLabel}
          onPress={model.onCopy}
          style={[styles.iconButton, { borderColor: PLACE_BORDER_COLOR }]}>
          <Text style={{ color: colors.text }}>{model.copied ? '✓' : '⌧'}</Text>
        </Pressable>
      </View>

      {model.categories ? (
        <View style={styles.categoryRow}>
          {model.categories.map((cat) => (
            <Pressable
              key={cat.value}
              accessibilityRole="button"
              accessibilityState={{ selected: cat.isSelected }}
              onPress={cat.onSelect}
              style={[
                styles.categoryChip,
                { borderColor: PLACE_BORDER_COLOR },
                cat.isSelected && { backgroundColor: PLACE_ACCENT_COLOR, borderColor: PLACE_ACCENT_COLOR },
              ]}>
              <Text style={[styles.categoryChipText, { color: cat.isSelected ? '#FFFFFF' : colors.text }]}>{cat.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {model.addressRows.length > 0 ? (
        <View style={[styles.section, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{model.addressTitle}</Text>
          {model.addressRows.map((row) => (
            <Text key={row.label} style={{ color: colors.textSecondary }}>
              {row.label}: {row.value}
            </Text>
          ))}
        </View>
      ) : null}

      {model.checklist.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{model.checklistTitle}</Text>
          <View style={styles.checklistGrid}>
            {model.checklist.map((item) => {
              const tone = item.tone === 'yes' ? '#2E7D32' : item.tone === 'no' ? '#C62828' : '#B26A00';
              return (
                <View key={item.key} style={[styles.checklistItem, { borderColor: tone }]}>
                  <Text style={{ color: tone, fontWeight: '600' }}>{item.label}</Text>
                  <Text style={{ color: tone }}>{item.statusLabel}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {model.links.length > 0 ? (
        <View style={styles.linkRow}>
          {model.links.map((link) => (
            <Text
              key={link.label}
              style={[styles.link, { color: PLACE_ACCENT_COLOR }]}
              onPress={link.onPress}
              accessibilityRole="link">
              {link.label}
            </Text>
          ))}
        </View>
      ) : null}

      {model.reviews ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{model.reviews.titleLabel}</Text>
          {model.reviews.aiSummary ? (
            <View style={[styles.aiSummary, { backgroundColor: colors.backgroundElement }]}>
              <Text style={[styles.sectionTitle, { color: PLACE_ACCENT_COLOR }]}>{model.reviews.aiSummaryLabel}</Text>
              <Text style={{ color: colors.text }}>{model.reviews.aiSummary}</Text>
            </View>
          ) : null}
          {model.reviews.loading ? (
            <ActivityIndicator color={colors.textSecondary} />
          ) : model.reviews.items.length > 0 ? (
            <>
              {model.reviews.items.map((review) => (
                <View key={review.key} style={[styles.reviewRow, { borderColor: PLACE_BORDER_COLOR }]}>
                  <Text style={{ color: colors.text }}>{review.starsLabel}</Text>
                  {review.comment ? <Text style={{ color: colors.text }}>{review.comment}</Text> : null}
                </View>
              ))}
              {model.reviews.hasMore ? (
                <Pressable accessibilityRole="button" onPress={model.reviews.onLoadMore} style={styles.loadMoreButton}>
                  <Text style={{ color: PLACE_ACCENT_COLOR, textAlign: 'center' }}>{model.reviews.loadMoreLabel}</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <EmptyState title={model.reviews.emptyLabel} />
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 14 },
  actionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionButton: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionButtonPrimaryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { minHeight: 48, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 12 },
  categoryChipText: { fontSize: 12, fontWeight: '500' },
  section: { gap: 6, borderRadius: 12, padding: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600' },
  checklistGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checklistItem: { borderWidth: 1, borderRadius: 12, padding: 10, minWidth: '45%', gap: 2 },
  linkRow: { flexDirection: 'row', gap: 12 },
  link: { fontSize: 14, fontWeight: '500', minHeight: 48, textAlignVertical: 'center' },
  aiSummary: { borderRadius: 12, padding: 10, gap: 4, marginBottom: 8 },
  reviewRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8, gap: 4 },
  loadMoreButton: { minHeight: 48, justifyContent: 'center' },
});
