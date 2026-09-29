import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';
import { Icon, type IconName } from '@/shared/ui';

import type { PlaceDetailBadge, PlaceDetailViewProps } from './PlaceDetailView.types';
import {
  PLACE_ACCENT_COLOR,
  PLACE_ACCENT_COLOR_DARK,
  PLACE_BORDER_COLOR,
  PLACE_NO_COLOR,
  PLACE_NO_COLOR_DARK,
  PLACE_NO_SURFACE,
  PLACE_OK_COLOR,
  PLACE_OK_COLOR_DARK,
  PLACE_OK_SURFACE,
  PLACE_ON_ACCENT_COLOR,
  PLACE_SURFACE_COLOR,
  PLACE_WARN_COLOR,
  PLACE_WARN_COLOR_DARK,
  PLACE_WARN_SURFACE,
} from './palette';
import ShareButton from './ShareButton';

interface ToneColors {
  ok: string;
  warn: string;
  no: string;
}

const TONE_COLORS: Record<'light' | 'dark', ToneColors> = {
  light: { ok: PLACE_OK_COLOR, warn: PLACE_WARN_COLOR, no: PLACE_NO_COLOR },
  dark: { ok: PLACE_OK_COLOR_DARK, warn: PLACE_WARN_COLOR_DARK, no: PLACE_NO_COLOR_DARK },
};

function checklistTone(tone: 'yes' | 'no' | 'unknown', colors: ToneColors): { color: string; surface: string; icon: IconName } {
  if (tone === 'yes') return { color: colors.ok, surface: PLACE_OK_SURFACE, icon: 'check' };
  if (tone === 'no') return { color: colors.no, surface: PLACE_NO_SURFACE, icon: 'close' };
  return { color: colors.warn, surface: PLACE_WARN_SURFACE, icon: 'help' };
}

function badgeTone(tone: Exclude<PlaceDetailBadge['tone'], 'neutral'>, colors: ToneColors): { color: string; surface: string } {
  return tone === 'ok' ? { color: colors.ok, surface: PLACE_OK_SURFACE } : { color: colors.warn, surface: PLACE_WARN_SURFACE };
}

/** 外部連結 chip 視覺高度 32，hitSlop 補到 44pt 觸控目標 */
const LINK_HIT_SLOP = { top: 6, bottom: 6, left: 0, right: 0 };

/**
 * 地點詳情面板（`(sheet)/place/[id]`、`(sheet)/loc/[coords]`），iOS／Android 共用。
 *
 * - 為什麼不用 SwiftUI `Form`：SDD ADR-16 規定 UI 圖示一律 Lucide，而 `@expo/ui`
 *   `Host` 內的 SwiftUI 內容不能承載 RN 子元件；依 ADR-15 改為 RN 版型。iOS 分享
 *   仍是原生 `ShareLink`（見 `ShareButton.ios.tsx`）。
 * - 根節點必須是單一 `ScrollView`（iOS formSheet 對多個 sibling 會警告
 *   「expects at most 2 subviews」並造成版面重疊）。
 * - 主要按鈕是「規劃路線」（Phase 2 路線 feature 落地後啟用，開 `/plan` 並帶入目的地）；
 *   「回到此地點」改為次要圓形按鈕。
 * - Web 有但本 App 無對應功能的元素（清單「我知道 → 回報」、評價登入卡、附近設施
 *   可點）刻意不畫，見 `docs/port-ledger.md`。
 */
export default function PlaceDetailView({ model, loading }: PlaceDetailViewProps) {
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const { fontScale } = useWindowDimensions();
  const toneColors = TONE_COLORS[isDark ? 'dark' : 'light'];
  const reviewEditLabel = model.reviews?.editLabel ?? '';
  const reviewDeleteLabel = model.reviews?.deleteLabel ?? '';
  const accentText = isDark ? PLACE_ACCENT_COLOR_DARK : PLACE_ACCENT_COLOR;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.textSecondary} />
      </View>
    );
  }

  return (
    // sheet 內 Stack 導覽列為 `headerTransparent`：靠 automatic content inset 讓標頭不被導覽列蓋住
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <View style={styles.eyebrow}>
          <Icon name="mapPin" size={14} color={accentText} />
          <Text style={[styles.eyebrowText, { color: accentText }]}>{model.infoLabel}</Text>
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {model.title}
        </Text>
        {model.subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {model.subtitle}
          </Text>
        ) : null}
      </View>

      {model.badges.length > 0 || model.links.length > 0 ? (
        <View style={styles.chipsRow}>
          {model.badges.map((badge) => {
            const tone = badge.tone === 'neutral' ? null : badgeTone(badge.tone, toneColors);
            const color = tone ? tone.color : colors.text;
            return (
              <View
                key={badge.key}
                accessible
                accessibilityLabel={badge.label}
                style={[styles.badge, { backgroundColor: tone ? tone.surface : PLACE_SURFACE_COLOR }]}>
                {badge.iconName ? <Icon name={badge.iconName} size={14} color={color} /> : null}
                <Text style={[styles.badgeText, { color }]}>{badge.label}</Text>
              </View>
            );
          })}
          {model.links.map((link) => (
            <Pressable
              key={link.label}
              accessibilityRole="link"
              accessibilityLabel={link.label}
              onPress={link.onPress}
              hitSlop={LINK_HIT_SLOP}
              style={[styles.badge, styles.linkChip, { borderColor: PLACE_BORDER_COLOR }]}>
              <Icon name="externalLink" size={14} color={colors.text} />
              <Text style={[styles.badgeText, { color: colors.text }]}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={[styles.actionsRow, fontScale >= 1.3 && styles.actionsRowLarge]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.planRouteLabel}
          onPress={model.onPlanRoute}
          style={[styles.primaryButton, fontScale >= 1.3 && styles.primaryButtonLarge]}>
          <Icon name="route" color={PLACE_ON_ACCENT_COLOR} />
          <Text style={styles.primaryButtonText}>
            {model.planRouteLabel}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.recenterLabel}
          onPress={model.onRecenter}
          style={[styles.circleButton, { borderColor: PLACE_BORDER_COLOR }]}>
          <Icon name="crosshair" color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.saveLabel}
          accessibilityState={{ selected: model.saved }}
          onPress={model.onToggleSave}
          style={[styles.circleButton, { borderColor: PLACE_BORDER_COLOR }]}>
          <Icon name={model.saved ? 'bookmarkFilled' : 'bookmark'} color={model.saved ? accentText : colors.text} />
        </Pressable>
        <ShareButton url={model.shareUrl} title={model.title} label={model.shareLabel} onShare={model.onShare} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.copyLabel}
          onPress={model.onCopy}
          style={[styles.circleButton, { borderColor: PLACE_BORDER_COLOR }]}>
          <Icon name={model.copied ? 'check' : 'copy'} color={model.copied ? toneColors.ok : colors.text} />
        </Pressable>
      </View>

      {model.categories ? (
        <View style={styles.chipsRow}>
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
              {cat.isSelected ? <Icon name="check" size={14} color={PLACE_ON_ACCENT_COLOR} /> : null}
              <Text style={[styles.categoryChipText, { color: cat.isSelected ? PLACE_ON_ACCENT_COLOR : colors.text }]}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {model.addressRows.length > 0 ? (
        <View style={[styles.card, { backgroundColor: PLACE_SURFACE_COLOR }]}>
          <View style={styles.sectionHeader}>
            <Icon name="mapPin" size={16} color={colors.text} />
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
              {model.addressTitle}
            </Text>
          </View>
          <View style={styles.addressGrid}>
            {model.addressRows.map((row) => (
              <View key={row.label} style={styles.addressCell}>
                <Text style={[styles.addressText, { color: colors.textSecondary }]}>
                  {row.label}: <Text style={{ color: colors.text }}>{row.value}</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="accessibility" size={16} color={colors.text} />
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
            {model.nearbyTitle}
          </Text>
        </View>
        {model.nearbyRows.length > 0 ? (
          model.nearbyRows.map((row) => (
            <View key={row.key} style={[styles.nearbyRow, { borderColor: PLACE_BORDER_COLOR }]}>
              <View style={styles.flex}>
                <Text style={[styles.nearbyName, { color: colors.text }]} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={[styles.nearbyMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                  {row.address ? `${row.typeLabel} · ${row.address}` : row.typeLabel}
                </Text>
              </View>
              <Text style={[styles.nearbyMeta, { color: colors.textSecondary }]}>{row.distanceText}</Text>
            </View>
          ))
        ) : (
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{model.nearbyEmptyLabel}</Text>
        )}
      </View>

      {model.checklist.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="accessibility" size={16} color={colors.text} />
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
              {model.checklistTitle}
            </Text>
          </View>
          <View style={styles.checklistGrid}>
            {model.checklist.map((item) => {
              const tone = checklistTone(item.tone, toneColors);
              return (
                <View
                  key={item.key}
                  accessible
                  accessibilityLabel={`${item.label}：${item.statusLabel}`}
                  style={[styles.checklistItem, { backgroundColor: tone.surface }]}>
                  <View style={styles.checklistLabelRow}>
                    <Icon name={tone.icon} size={16} color={tone.color} />
                    <Text style={[styles.checklistLabel, { color: tone.color }]}>{item.label}</Text>
                  </View>
                  <Text style={[styles.checklistStatus, { color: tone.color }]}>{item.statusLabel}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {model.reviews ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="messageSquare" size={16} color={colors.text} />
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
              {model.reviews.titleLabel}
            </Text>
          </View>
          {model.reviews.aiSummary ? (
            <View style={[styles.card, { backgroundColor: PLACE_SURFACE_COLOR }]}>
              <Text style={[styles.sectionTitle, { color: accentText }]}>{model.reviews.aiSummaryLabel}</Text>
              <Text style={[styles.bodyText, { color: colors.text }]}>{model.reviews.aiSummary}</Text>
            </View>
          ) : null}
          {model.reviews.write.hint ? (
            <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{model.reviews.write.hint}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={model.reviews.write.label}
            onPress={model.reviews.write.onPress}
            style={styles.loadMoreButton}>
            <Text style={[styles.loadMoreText, { color: accentText }]}>{model.reviews.write.label}</Text>
          </Pressable>
          {model.reviews.loading ? (
            <ActivityIndicator color={colors.textSecondary} />
          ) : model.reviews.items.length > 0 ? (
            <>
              {model.reviews.items.map((review) => (
                <View key={review.key} style={[styles.reviewRow, { borderColor: PLACE_BORDER_COLOR }]}>
                  <View style={styles.sectionHeader}>
                    <Icon name="star" size={14} color={toneColors.warn} />
                    <Text style={{ color: colors.text }}>{review.starsLabel}</Text>
                  </View>
                  <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{review.metaLabel}</Text>
                  {review.comment ? <Text style={[styles.bodyText, { color: colors.text }]}>{review.comment}</Text> : null}
                  {review.onEdit || review.onDelete ? (
                    <View style={styles.sectionHeader}>
                      {review.onEdit ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={reviewEditLabel}
                          onPress={review.onEdit}
                          style={styles.loadMoreButton}>
                          <Text style={[styles.loadMoreText, { color: accentText }]}>{reviewEditLabel}</Text>
                        </Pressable>
                      ) : null}
                      {review.onDelete ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={reviewDeleteLabel}
                          onPress={review.onDelete}
                          style={styles.loadMoreButton}>
                          <Text style={[styles.loadMoreText, { color: toneColors.no }]}>{reviewDeleteLabel}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ))}
              {model.reviews.hasMore ? (
                <Pressable accessibilityRole="button" onPress={model.reviews.onLoadMore} style={styles.loadMoreButton}>
                  <Text style={[styles.loadMoreText, { color: accentText }]}>{model.reviews.loadMoreLabel}</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{model.reviews.emptyLabel}</Text>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // paddingTop 多留一點：透明導覽列底緣的 scroll-edge 效果會蓋到第一行小標
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  header: { gap: 4 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eyebrowText: { fontSize: 12, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 13 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
  },
  linkChip: { borderWidth: StyleSheet.hairlineWidth },
  badgeText: { fontSize: 13, fontWeight: '500' },
  actionsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  actionsRowLarge: { flexWrap: 'wrap' },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 12,
    backgroundColor: PLACE_ACCENT_COLOR,
  },
  primaryButtonLarge: { flexGrow: 0, flexBasis: '100%', paddingVertical: 10 },
  primaryButtonText: { color: PLACE_ON_ACCENT_COLOR, fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingHorizontal: 14,
  },
  categoryChipText: { fontSize: 13, fontWeight: '500' },
  card: { borderRadius: 14, padding: 12, gap: 8 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '600' },
  addressGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  addressCell: { width: '50%', paddingRight: 8 },
  addressText: { fontSize: 14 },
  bodyText: { fontSize: 14 },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nearbyName: { fontSize: 15, fontWeight: '500' },
  nearbyMeta: { fontSize: 12 },
  checklistGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  checklistItem: { width: '48%', borderRadius: 14, padding: 12, gap: 4 },
  checklistLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checklistLabel: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  checklistStatus: { fontSize: 13 },
  reviewRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8, gap: 4 },
  loadMoreButton: { minHeight: 44, justifyContent: 'center' },
  loadMoreText: { textAlign: 'center', fontSize: 15, fontWeight: '500' },
});
