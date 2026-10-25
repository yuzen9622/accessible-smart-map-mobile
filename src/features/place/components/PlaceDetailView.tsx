import { ContentActions } from '@/features/content-safety';
import { Text } from '@/shared/ui/typography/Text';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';

import { FACILITY_COLORS } from '@/features/map';
import { MAX_FONT_SCALE, MIN_TOUCH, TYPE, semanticColors, useSemanticColors, useThemeColors, WHITE, SHAPE, ICON_SIZE } from '@/shared/theme';
import { Icon, type IconName } from '@/shared/ui';

import CategoryNameModal from './CategoryNameModal';
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
import PressableScale from '@/shared/ui/PressableScale';

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

/** 大字級門檻：超過時動作列與區塊標題改為上下排，避免標題被右側配件擠成一字一行。 */
const LARGE_FONT_SCALE = 1.3;

/** 區塊標題：每一區同一種字級與留白，右側可放計數或動作；大字級時配件換到標題下方。 */
function SectionHeader({ title, color, accessory, stacked }: { title: string; color: string; accessory?: ReactNode; stacked: boolean }) {
  return (
    <View style={[styles.sectionHeaderRow, stacked && styles.sectionHeaderStacked]}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.heading} accessibilityRole="header" style={[styles.sectionHeading, !stacked && styles.flex, { color }]}>
        {title}
      </Text>
      {accessory}
    </View>
  );
}

/**
 * 地點詳情面板（`(sheet)/place/[id]`、`(sheet)/loc/[coords]`），iOS／Android 共用。
 *
 * - 為什麼不用 SwiftUI `Form`：SDD ADR-16 規定 UI 圖示一律 Lucide，而 `@expo/ui`
 *   `Host` 內的 SwiftUI 內容不能承載 RN 子元件；依 ADR-15 改為 RN 版型。iOS 分享
 *   仍是原生 `ShareLink`（見 `ShareButton.ios.tsx`）。
 * - 根節點必須是單一 `ScrollView`（iOS formSheet 對多個 sibling 會警告
 *   「expects at most 2 subviews」並造成版面重疊）。
 * - 版型（2026-10-03 精簡）：標題＋「類別 · 距離 · 地址」＋ badges → 主按鈕「規劃路線」與
 *   同高 50pt 圓鈕（收藏、分享、「⋯」收納回到此地點／複製連結／外部地圖）→ 無障礙資訊卡 →
 *   附近無障礙設施（分組卡片）→ 評價（分組卡片）。地址已在副標題，不再另開地址卡。
 */
export default function PlaceDetailView({ model }: PlaceDetailViewProps) {
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const { fontScale } = useWindowDimensions();
  const semantic = useSemanticColors();
  // 四顆圓鈕（回到此地點、收藏、分享、複製）同一種底色；分享鈕在 ShareButton 內用同一個 token
  const circleSurface = semantic.accentSoft;
  const toneColors = TONE_COLORS[isDark ? 'dark' : 'light'];
  const reviewEditLabel = model.reviews?.editLabel ?? '';
  const reviewDeleteLabel = model.reviews?.deleteLabel ?? '';
  const accentText = isDark ? PLACE_ACCENT_COLOR_DARK : PLACE_ACCENT_COLOR;
  const groupStyle = [styles.group, { backgroundColor: colors.backgroundElement }];
  const rowDivider = { borderTopWidth: StyleSheet.hairlineWidth, borderColor: semantic.separator };
  const largeText = fontScale >= LARGE_FONT_SCALE;
  // 圖示跟著字級縮放，不然大字級時圖示小得像標點；上限 1.6 倍，避免圖示圈把四格網格撐爆
  const iconScale = Math.min(Math.max(fontScale, 1), 1.6);
  const scaled = (size: number) => Math.round(size * iconScale);
  const [addingCategory, setAddingCategory] = useState(false);

  return (
    // sheet 內 Stack 導覽列為 `headerTransparent`：靠 automatic content inset 讓標頭不被導覽列蓋住
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.heading} accessibilityRole="header" style={[styles.title, { color: colors.text }]} numberOfLines={largeText ? 3 : 2}>
          {model.title}
        </Text>
        {model.subtitle ? (
          // 完整地址只在這一行，不截斷（地址卡已移除）
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.subtitle, { color: colors.textSecondary }]}>
            {model.subtitle}
          </Text>
        ) : null}
        {/* 類別（「公車站」）已經在上面的 subtitle 裡，這裡只留狀態類徽章（例：無障礙資訊未確認），
            不重複印一次類別（使用者回饋 2026-10-23，參考設計圖二）。 */}
        {model.badges.some((badge) => badge.key !== 'type') ? (
          <View style={[styles.chipsRow, styles.headerBadges]}>
            {model.badges.filter((badge) => badge.key !== 'type').map((badge) => {
              const tone = badge.tone === 'neutral' ? null : badgeTone(badge.tone, toneColors);
              const color = tone ? tone.color : colors.textSecondary;
              return (
                <View
                  key={badge.key}
                  accessible
                  accessibilityLabel={badge.label}
                  style={[styles.badge, { backgroundColor: tone ? tone.surface : PLACE_SURFACE_COLOR }]}>
                  {badge.iconName ? <Icon name={badge.iconName} size={scaled(ICON_SIZE.caption)} color={color} /> : null}
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.badgeText, { color }]}>{badge.label}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* 主按鈕是「路線」，次要動作收成同高 50pt 的圓鈕；回到此地點／複製連結／外部地圖收進「⋯」 */}
      <View style={[styles.actionsRow, largeText && styles.actionsRowLarge]}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={model.planRouteLabel}
          onPress={model.onPlanRoute}
          style={[styles.primaryButton, largeText && styles.primaryButtonLarge]}>
          <Icon name="navigation" color={PLACE_ON_ACCENT_COLOR} />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={styles.primaryButtonText}>
            {model.planRouteLabel}
          </Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={model.saveLabel}
          accessibilityState={{ selected: model.saved }}
          onPress={model.onToggleSave}
          style={[styles.circleButton, { backgroundColor: circleSurface }]}>
          <Icon name={model.saved ? 'bookmarkFilled' : 'bookmark'} size={ICON_SIZE.control} color={accentText} />
        </PressableScale>
        <ShareButton url={model.shareUrl} title={model.title} label={model.shareLabel} onShare={model.onShare} />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={model.cctvLabel}
          onPress={model.onOpenCctv}
          style={[styles.circleButton, { backgroundColor: circleSurface }]}>
          <Icon name="camera" size={ICON_SIZE.control} color={accentText} />
        </PressableScale>
      </View>

      {model.categories ? (
        <View style={styles.chipsRow}>
          {model.categories.map((cat) => (
            <PressableScale
              key={cat.value}
              accessibilityRole="button"
              accessibilityState={{ selected: cat.isSelected }}
              onPress={cat.onSelect}
              style={[
                styles.categoryChip,
                { backgroundColor: colors.backgroundElement },
                cat.isSelected && { backgroundColor: PLACE_ACCENT_COLOR },
              ]}>
              {cat.isSelected ? <Icon name="check" size={scaled(ICON_SIZE.caption)} color={PLACE_ON_ACCENT_COLOR} /> : null}
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.categoryChipText, { color: cat.isSelected ? PLACE_ON_ACCENT_COLOR : colors.text }]}>
                {cat.label}
              </Text>
            </PressableScale>
          ))}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={model.addCategoryLabel}
            onPress={() => setAddingCategory(true)}
            style={[styles.categoryChip, { backgroundColor: colors.backgroundElement }]}>
            <Icon name="plus" size={scaled(ICON_SIZE.caption)} color={colors.textSecondary} />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.categoryChipText, { color: colors.textSecondary }]}>
              {model.addCategoryLabel}
            </Text>
          </PressableScale>
        </View>
      ) : null}
      {model.categories ? (
        <CategoryNameModal
          visible={addingCategory}
          title={model.newCategoryTitle}
          onCancel={() => setAddingCategory(false)}
          onSubmit={(name) => {
            model.onCreateCategory(name);
            setAddingCategory(false);
          }}
        />
      ) : null}

      {model.checklist.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title={model.checklistTitle}
            color={colors.text}
            stacked={largeText}
            accessory={
              model.checklistConfirmedLabel ? (
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label}
                  style={[
                    styles.sectionMeta,
                    { color: model.checklist.some((item) => item.tone !== 'unknown') ? toneColors.ok : colors.textSecondary },
                  ]}>
                  {model.checklistConfirmedLabel}
                </Text>
              ) : null
            }
          />
          {/* 固定 2×2 卡片、一律用該項目對應的具體圖示（輪椅／電梯／坡道／廁所），不是未確認就整個換成
              「?」——圖示本身告訴你在問哪一項，確不確認改由底色與下面的狀態文字傳達（使用者回饋
              2026-10-23，參考設計圖二）。每一項的「我知道」以前各自一個連結，但其實都指去同一個寫
              評論入口（見 `usePlaceDetailViewModel` 的 `onReport`），改收成卡片下方單一按鈕，狀態文字
              純顯示用，不用再逐項點。 */}
          <View style={[groupStyle, styles.checklistRow, styles.checklistGrid]}>
            {model.checklist.map((item) => {
              const tone = checklistTone(item.tone, toneColors);
              return (
                <View key={item.key} style={[styles.checklistItem, styles.checklistItemGrid]}>
                  <View
                    accessible
                    accessibilityLabel={`${item.label}：${item.statusLabel}`}
                    style={styles.checklistBody}>
                    <View style={[styles.checklistIcon, { width: scaled(44), height: scaled(44), backgroundColor: tone.surface }]}>
                      <Icon name={CHECKLIST_ICON[item.key] ?? tone.icon} size={scaled(ICON_SIZE.control)} color={tone.color} />
                    </View>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.checklistLabel, { color: colors.text }]} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </View>
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.checklistStatus, { color: tone.color }]} importantForAccessibility="no">
                    {item.statusLabel}
                  </Text>
                </View>
              );
            })}
          </View>
          {model.checklist.some((item) => item.onReport) ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={model.checklistSupplementLabel}
              onPress={model.checklist.find((item) => item.onReport)?.onReport}
              hitSlop={REPORT_HIT_SLOP}
              style={[styles.supplementButton, { borderColor: PLACE_BORDER_COLOR }]}>
              <Icon name="plus" size={scaled(ICON_SIZE.body)} color={accentText} />
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.supplementButtonText, { color: accentText }]}>
                {model.checklistSupplementLabel}
              </Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}

      {/* 每個地點都能回報現場狀況（障礙物、施工、資料錯誤）；放在無障礙資訊之後，看完現況再決定要不要回報 */}
      <PressableScale feedback="highlight"
        accessibilityRole="button"
        accessibilityLabel={model.placeReport.accessibilityLabel}
        accessibilityHint={model.placeReport.subtitle}
        onPress={model.placeReport.onPress}
        style={[groupStyle, styles.reportRow]}>
        <View style={[styles.reportIcon, { width: scaled(36), height: scaled(36), backgroundColor: PLACE_WARN_SURFACE }]}>
          <Icon name="alert" size={scaled(ICON_SIZE.body)} color={toneColors.warn} />
        </View>
        <View style={styles.flex}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.reportTitle, { color: colors.text }]}>
            {model.placeReport.title}
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.nearbyMeta, { color: colors.textSecondary }]}>
            {model.placeReport.subtitle}
          </Text>
        </View>
        <Icon name="chevronRight" size={scaled(ICON_SIZE.body)} color={colors.textSecondary} />
      </PressableScale>

      <View style={styles.section}>
        <SectionHeader title={model.nearbyTitle} color={colors.text} stacked={largeText} />
        {model.nearbyRows.length > 0 ? (
          <View style={groupStyle}>
            {model.nearbyRows.map((row, index) => (
              <View
                key={row.key}
                accessible
                accessibilityLabel={[row.name, row.typeLabel, row.address, row.distanceText].filter(Boolean).join('，')}
                style={styles.nearbyRow}>
                <View style={[styles.nearbyIcon, { width: scaled(30), height: scaled(30), backgroundColor: nearbyKindStyle(row.kind).color }]}>
                  <Icon name={nearbyKindStyle(row.kind).icon} size={scaled(ICON_SIZE.body)} color={WHITE} />
                </View>
                {/* 分隔線從文字起點開始（iOS inset grouped 列表的慣例），不切過圖示 */}
                <View style={[styles.nearbyText, index > 0 && rowDivider]}>
                  <View style={styles.flex}>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.nearbyName, { color: colors.text }]} numberOfLines={largeText ? 3 : 1}>
                      {row.name}
                    </Text>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.nearbyMeta, { color: colors.textSecondary }]} numberOfLines={largeText ? 2 : 1}>
                      {row.address ? `${row.typeLabel} · ${row.address}` : row.typeLabel}
                    </Text>
                    {/* 大字級時距離移到名稱下方，不跟名稱搶寬度（否則名稱被截成「台北1…」） */}
                    {largeText ? (
                      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.nearbyDistance, { color: colors.textSecondary }]}>{row.distanceText}</Text>
                    ) : null}
                  </View>
                  {largeText ? null : (
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.nearbyDistance, { color: colors.textSecondary }]}>{row.distanceText}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={[groupStyle, styles.emptyCard]}>
            <Icon name="accessibility" size={scaled(ICON_SIZE.control)} color={colors.textSecondary} />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.bodyText, styles.emptyText, { color: colors.textSecondary }]}>{model.nearbyEmptyLabel}</Text>
          </View>
        )}
      </View>

      {model.reviews ? (
        <View style={styles.section}>
          <SectionHeader
            title={model.reviews.titleLabel}
            color={colors.text}
            stacked={largeText}
            accessory={
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={model.reviews.write.label}
                onPress={model.reviews.write.onPress}
                style={[styles.headerAction, !largeText && styles.headerActionInline]}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.sectionAction, { color: accentText }]}>{model.reviews.write.label}</Text>
              </PressableScale>
            }
          />
          {model.reviews.write.hint ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.bodyText, { color: colors.textSecondary }]}>{model.reviews.write.hint}</Text>
          ) : null}
          {model.reviews.aiSummary ? (
            <View style={[styles.group, styles.summaryCard, { backgroundColor: semantic.accentSoft }]}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.summaryLabel, { color: accentText }]}>{model.reviews.aiSummaryLabel}</Text>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.bodyText, { color: colors.text }]}>{model.reviews.aiSummary}</Text>
            </View>
          ) : null}
          {model.reviews.errorLabel ? (
            <View style={groupStyle}>
              <Text accessibilityLiveRegion="polite" style={[styles.bodyText, { color: colors.textSecondary }]}>{model.reviews.errorLabel}</Text>
              <PressableScale accessibilityRole="button" onPress={model.reviews.onRetry} style={styles.loadMoreButton}>
                <Text style={[styles.loadMoreText, { color: accentText }]}>{model.reviews.retryLabel}</Text>
              </PressableScale>
            </View>
          ) : null}
          {model.reviews.loading ? (
            <ActivityIndicator accessibilityLabel={model.reviews.loadingLabel} color={colors.textSecondary} />
          ) : model.reviews.items.length > 0 ? (
            <View style={groupStyle}>
              {model.reviews.items.map((review, index) => (
                <View key={review.key} style={[styles.reviewRow, index > 0 && rowDivider]}>
                  <View style={styles.reviewHead}>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} accessibilityLabel={review.starsA11yLabel} style={[styles.reviewStars, { color: toneColors.warn }]}>{review.starsLabel}</Text>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.reviewMeta, styles.flex, { color: colors.textSecondary }]} numberOfLines={1}>
                      {review.metaLabel}
                    </Text>
                    {review.canReport ? <ContentActions targetType="review" targetId={review.key} canBlock={review.canBlock} /> : null}
                  </View>
                  {review.comment ? <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.reviewComment, { color: colors.text }]}>{review.comment}</Text> : null}
                  {review.evidence.map((line) => (
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} key={line} style={[styles.reviewEvidence, { color: colors.textSecondary }]}>
                      {line}
                    </Text>
                  ))}
                  {review.onEdit || review.onDelete ? (
                    <View style={styles.reviewActions}>
                      {review.onEdit ? (
                        <PressableScale
                          accessibilityRole="button"
                          accessibilityLabel={reviewEditLabel}
                          onPress={review.onEdit}
                          style={styles.reviewActionButton}>
                          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.sectionAction, { color: accentText }]}>{reviewEditLabel}</Text>
                        </PressableScale>
                      ) : null}
                      {review.onDelete ? (
                        <PressableScale
                          accessibilityRole="button"
                          accessibilityLabel={reviewDeleteLabel}
                          onPress={review.onDelete}
                          style={styles.reviewActionButton}>
                          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.sectionAction, { color: toneColors.no }]}>{reviewDeleteLabel}</Text>
                        </PressableScale>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ))}
              {model.reviews.hasMore ? (
                <PressableScale
                  accessibilityRole="button"
                  onPress={model.reviews.onLoadMore}
                  style={[styles.loadMoreButton, rowDivider]}>
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.loadMoreText, { color: accentText }]}>{model.reviews.loadMoreLabel}</Text>
                </PressableScale>
              ) : null}
            </View>
          ) : model.reviews.errorLabel ? null : (
            <View style={[groupStyle, styles.emptyCard]}>
              <Icon name="messageSquare" size={scaled(ICON_SIZE.control)} color={colors.textSecondary} />
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.bodyText, styles.emptyText, { color: colors.textSecondary }]}>{model.reviews.emptyLabel}</Text>
            </View>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // paddingTop 多留一點：透明導覽列底緣的 scroll-edge 效果會蓋到第一行小標
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40, gap: 24 },
  flex: { flex: 1 },
  header: { gap: 4 },
  headerBadges: { marginTop: 8 },
  title: { fontSize: TYPE.title1, fontWeight: '700', letterSpacing: 0.2 },
  subtitle: { fontSize: TYPE.subhead, lineHeight: 21 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 26,
    borderRadius: SHAPE.pill, borderCurve: 'continuous',
    paddingHorizontal: 10,
  },
  badgeText: { fontSize: TYPE.caption, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: -8 },
  actionsRowLarge: { flexWrap: 'wrap' },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    borderRadius: SHAPE.pill, borderCurve: 'continuous',
    paddingHorizontal: 12,
    backgroundColor: PLACE_ACCENT_COLOR,
  },
  primaryButtonLarge: { flexGrow: 0, flexBasis: '100%', paddingVertical: 10 },
  primaryButtonText: { color: PLACE_ON_ACCENT_COLOR, fontSize: TYPE.body, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  circleButton: {
    width: 50,
    height: 50,
    borderRadius: SHAPE.pill, borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    borderRadius: SHAPE.pill, borderCurve: 'continuous',
    paddingHorizontal: 14,
  },
  categoryChipText: { fontSize: TYPE.footnote, fontWeight: '600' },
  section: { gap: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeaderStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 0 },
  // 實體 44pt：Android 的 hitSlop 超出父層範圍就點不到，不能只靠 hitSlop
  headerAction: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  headerActionInline: { paddingLeft: 8 },
  sectionHeading: { fontSize: TYPE.title3, fontWeight: '700' },
  sectionMeta: { fontSize: TYPE.footnote, fontWeight: '600' },
  sectionAction: { fontSize: TYPE.subhead, fontWeight: '600' },
  group: { borderRadius: SHAPE.card, borderCurve: 'continuous', overflow: 'hidden' },
  bodyText: { fontSize: TYPE.subhead, lineHeight: 20 },
  nearbyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14 },
  nearbyText: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10, paddingRight: 14 },
  nearbyName: { fontSize: TYPE.body, fontWeight: '600' },
  nearbyMeta: { fontSize: TYPE.footnote, marginTop: 2 },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: MIN_TOUCH },
  reportIcon: { borderRadius: SHAPE.control, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  reportTitle: { fontSize: TYPE.body, fontWeight: '600' },
  nearbyDistance: { fontSize: TYPE.footnote, fontVariant: ['tabular-nums'] },
  nearbyIcon: { width: 30, height: 30, borderRadius: SHAPE.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  checklistRow: { flexDirection: 'row', gap: 4, paddingVertical: 16, paddingHorizontal: 8 },
  checklistItem: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  // 固定 2×2（原本只有大字級才換成 2×2，四欄擠在一起字級一大就被截斷；改成預設就 2×2，卡片夠寬
  // 放得下圖示＋兩行標籤＋狀態文字，參考設計圖二）。
  checklistGrid: { flexWrap: 'wrap', columnGap: 0, rowGap: 20 },
  checklistItemGrid: { flex: 0, flexBasis: '50%', paddingHorizontal: 4 },
  supplementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: MIN_TOUCH,
    borderRadius: SHAPE.pill, borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  supplementButtonText: { fontSize: TYPE.callout, fontWeight: '600' },
  checklistBody: { alignItems: 'center', gap: 6 },
  checklistIcon: { width: 44, height: 44, borderRadius: SHAPE.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  checklistLabel: { fontSize: TYPE.footnote, textAlign: 'center' },
  checklistStatus: { fontSize: TYPE.caption, fontWeight: '700', textAlign: 'center' },
  summaryCard: { padding: 14, gap: 6 },
  summaryLabel: { fontSize: TYPE.footnote, fontWeight: '700' },
  reviewRow: { paddingVertical: 12, paddingHorizontal: 14, gap: 4 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewStars: { fontSize: TYPE.footnote, fontWeight: '700', fontVariant: ['tabular-nums'] },
  reviewMeta: { fontSize: TYPE.caption },
  reviewComment: { fontSize: TYPE.subhead, lineHeight: 21 },
  reviewEvidence: { fontSize: TYPE.footnote },
  reviewActions: { flexDirection: 'row', gap: 12, marginLeft: -4 },
  reviewActionButton: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  loadMoreButton: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  loadMoreText: { textAlign: 'center', fontSize: TYPE.subhead, fontWeight: '600' },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 14 },
  emptyText: { flex: 1 },
});
