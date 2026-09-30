import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from 'react-native';

import { FACILITY_COLORS } from '@/features/map';
import { RADIUS, semanticColors, useThemeColors } from '@/shared/theme';
import { Icon, type IconName } from '@/shared/ui';

import MoreActionsButton from './MoreActionsButton';
import type { PlaceDetailBadge, PlaceDetailNearbyRow, PlaceDetailViewProps } from './PlaceDetailView.types';
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
  neutral: string;
  neutralSurface: string;
}

const TONE_COLORS: Record<'light' | 'dark', ToneColors> = {
  light: {
    ok: PLACE_OK_COLOR,
    warn: PLACE_WARN_COLOR,
    no: PLACE_NO_COLOR,
    neutral: semanticColors(false).neutral.fg,
    neutralSurface: semanticColors(false).neutral.bg,
  },
  dark: {
    ok: PLACE_OK_COLOR_DARK,
    warn: PLACE_WARN_COLOR_DARK,
    no: PLACE_NO_COLOR_DARK,
    neutral: semanticColors(true).neutral.fg,
    neutralSurface: semanticColors(true).neutral.bg,
  },
};

function checklistTone(tone: 'yes' | 'no' | 'unknown', colors: ToneColors): { color: string; surface: string; icon: IconName } {
  if (tone === 'yes') return { color: colors.ok, surface: PLACE_OK_SURFACE, icon: 'check' };
  if (tone === 'no') return { color: colors.no, surface: PLACE_NO_SURFACE, icon: 'close' };
  // 「未確認」是資料缺口，不是警告：用中性灰，不要整片橘色搶過真正的「有／沒有」。
  return { color: colors.neutral, surface: colors.neutralSurface, icon: 'help' };
}

function badgeTone(tone: Exclude<PlaceDetailBadge['tone'], 'neutral'>, colors: ToneColors): { color: string; surface: string } {
  return tone === 'ok' ? { color: colors.ok, surface: PLACE_OK_SURFACE } : { color: colors.warn, surface: PLACE_WARN_SURFACE };
}

const CHECKLIST_ICON: Partial<Record<string, IconName>> = {
  wheelchair: 'accessibility',
  elevator: 'elevator',
  ramp: 'ramp',
  toilet: 'toilet',
};

// render 時才讀 `FACILITY_COLORS`：map ↔ place 之間有 require cycle，模組頂層讀取時 map 可能尚未初始化
function nearbyKindStyle(kind: PlaceDetailNearbyRow['kind']): { color: string; icon: IconName } {
  return kind === 'toilet'
    ? { color: FACILITY_COLORS.toilet, icon: 'toilet' }
    : { color: FACILITY_COLORS.elevator, icon: 'elevator' };
}

/** 「我知道 ›」文字只有 16pt 高，hitSlop 補到 44pt 觸控目標 */
const REPORT_HIT_SLOP = { top: 14, bottom: 14, left: 8, right: 8 };

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
 * - 版型依設計 1a「原生精修」（2026-09-30）：標題＋「類別 · 距離 · 地址」→ 主按鈕「規劃路線」與
 *   同高 50pt 圓鈕（收藏、分享、「⋯」收納回到此地點／複製連結）→ 無障礙資訊卡（四項一列、
 *   「n / 4 已確認」，未確認給「我知道 ›」開撰寫評價）→ badges → 附近無障礙設施 → 地址 → 評價。
 */
export default function PlaceDetailView({ model, loading }: PlaceDetailViewProps) {
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const { fontScale } = useWindowDimensions();
  // 四顆圓鈕（回到此地點、收藏、分享、複製）同一種底色；分享鈕在 ShareButton 內用同一個 token
  const circleSurface = semanticColors(isDark).accentSoft;
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
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {model.title}
        </Text>
        {model.subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {model.subtitle}
          </Text>
        ) : null}
      </View>

      {/* 設計 1a：主按鈕是「路線」，次要動作收成同高 50pt 的圓鈕；回到此地點／複製連結收進「⋯」 */}
      <View style={[styles.actionsRow, fontScale >= 1.3 && styles.actionsRowLarge]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.planRouteLabel}
          onPress={model.onPlanRoute}
          style={({ pressed }) => [styles.primaryButton, fontScale >= 1.3 && styles.primaryButtonLarge, pressed && styles.pressed]}>
          <Icon name="navigation" color={PLACE_ON_ACCENT_COLOR} />
          <Text style={styles.primaryButtonText}>
            {model.planRouteLabel}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.saveLabel}
          accessibilityState={{ selected: model.saved }}
          onPress={model.onToggleSave}
          style={({ pressed }) => [styles.circleButton, { backgroundColor: circleSurface }, pressed && styles.pressed]}>
          <Icon name={model.saved ? 'bookmarkFilled' : 'bookmark'} size={20} color={accentText} />
        </Pressable>
        <ShareButton url={model.shareUrl} title={model.title} label={model.shareLabel} onShare={model.onShare} />
        <MoreActionsButton
          label={model.moreLabel}
          cancelLabel={model.cancelLabel}
          backgroundColor={circleSurface}
          color={accentText}
          actions={[
            { label: model.recenterLabel, onPress: model.onRecenter },
            { label: model.copyLabel, onPress: model.onCopy },
          ]}
        />
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

      {model.checklist.length > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.cardHeader}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, styles.flex, { color: colors.text }]}>
              {model.checklistTitle}
            </Text>
            {model.checklistConfirmedLabel ? (
              <Text
                style={[
                  styles.confirmedText,
                  { color: model.checklist.some((item) => item.tone !== 'unknown') ? toneColors.ok : colors.textSecondary },
                ]}>
                {model.checklistConfirmedLabel}
              </Text>
            ) : null}
          </View>
          {/* 四項設施壓成一列圖示（設計 1a）；未確認直接給「我知道 ›」回報出口 */}
          <View style={styles.checklistRow}>
            {model.checklist.map((item) => {
              const tone = checklistTone(item.tone, toneColors);
              const report = item.onReport;
              return (
                <View key={item.key} style={styles.checklistItem}>
                  <View
                    accessible
                    accessibilityLabel={`${item.label}：${item.statusLabel}`}
                    style={styles.checklistBody}>
                    <View style={[styles.checklistIcon, { backgroundColor: tone.surface }]}>
                      <Icon
                        name={item.tone === 'unknown' ? 'help' : CHECKLIST_ICON[item.key] ?? tone.icon}
                        size={22}
                        color={tone.color}
                      />
                    </View>
                    <Text style={[styles.checklistLabel, { color: colors.text }]} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </View>
                  {report ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${item.label}，${model.reportLabel}`}
                      onPress={report}
                      hitSlop={REPORT_HIT_SLOP}>
                      <Text style={[styles.checklistStatus, { color: accentText }]}>{`${model.reportLabel} ›`}</Text>
                    </Pressable>
                  ) : (
                    <Text style={[styles.checklistStatus, { color: tone.color }]} importantForAccessibility="no">
                      {item.statusLabel}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

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

      <View>
        <Text accessibilityRole="header" style={[styles.largeTitle, { color: colors.text }]}>
          {model.nearbyTitle}
        </Text>
        {model.nearbyRows.length > 0 ? (
          model.nearbyRows.map((row, index) => (
            <View
              key={row.key}
              accessible
              accessibilityLabel={`${row.name}，${row.typeLabel}，${row.distanceText}`}
              style={[
                styles.nearbyRow,
                index < model.nearbyRows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: PLACE_BORDER_COLOR },
              ]}>
              <View style={[styles.nearbyIcon, { backgroundColor: nearbyKindStyle(row.kind).color }]}>
                <Icon name={nearbyKindStyle(row.kind).icon} size={18} color="#FFFFFF" />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.nearbyName, { color: colors.text }]} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={[styles.nearbyMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                  {row.address ? `${row.typeLabel} · ${row.address}` : row.typeLabel}
                </Text>
              </View>
              <Text style={[styles.nearbyDistance, { color: colors.textSecondary }]}>{row.distanceText}</Text>
            </View>
          ))
        ) : (
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{model.nearbyEmptyLabel}</Text>
        )}
      </View>

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
                  {review.evidence.map((line) => (
                    <Text key={line} style={[styles.bodyText, { color: colors.textSecondary }]}>
                      {line}
                    </Text>
                  ))}
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
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 15 },
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
  actionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionsRowLarge: { flexWrap: 'wrap' },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    backgroundColor: PLACE_ACCENT_COLOR,
  },
  primaryButtonLarge: { flexGrow: 0, flexBasis: '100%', paddingVertical: 10 },
  primaryButtonText: { color: PLACE_ON_ACCENT_COLOR, fontSize: 17, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  circleButton: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
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
  card: { borderRadius: RADIUS.card, paddingVertical: 14, paddingHorizontal: 12, gap: 8 },
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
    minHeight: 60,
    paddingVertical: 8,
  },
  nearbyName: { fontSize: 17 },
  nearbyMeta: { fontSize: 13 },
  nearbyDistance: { fontSize: 15 },
  nearbyIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  largeTitle: { fontSize: 20, fontWeight: '700', marginBottom: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 2 },
  confirmedText: { fontSize: 13, fontWeight: '600' },
  checklistRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  checklistItem: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  checklistBody: { alignItems: 'center', gap: 4 },
  checklistIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  checklistLabel: { fontSize: 13, textAlign: 'center' },
  checklistStatus: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  reviewRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8, gap: 4 },
  loadMoreButton: { minHeight: 44, justifyContent: 'center' },
  loadMoreText: { textAlign: 'center', fontSize: 15, fontWeight: '500' },
});
