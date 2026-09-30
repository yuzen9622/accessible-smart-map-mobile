import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { useFontScale } from '@/shared/preferences';
import { RADIUS, TYPE, scaledSize, semanticColors, useThemeColors } from '@/shared/theme';
import { Icon, type IconName } from '@/shared/ui';

import type { ToolCardIcon, ToolResultGroup, ToolResultItem } from '../domain/toolResultCards';

export interface ToolResultsBoxProps {
  groups: ToolResultGroup[];
  isDark: boolean;
  onOpenItem: (item: ToolResultItem) => void;
}

const ICON: Record<ToolCardIcon, IconName> = {
  search: 'search',
  a11y: 'accessibility',
  parking: 'squareParking',
  bus: 'bus',
  air: 'wind',
  env: 'trees',
  hazard: 'alert',
  nav: 'navigation',
};

/** 對齊 Web `MAX_DISPLAY_ITEMS_PER_GROUP`。 */
const MAX_DISPLAY = 12;
const CARD_WIDTH = 220;

/**
 * 工具結果卡（對齊 Web `AIChatBot.tsx` `ToolResultsBox`）：標題列（圖示、標題、筆數、展開／收起）、
 * 多組時的分頁 chips、摘要，下方橫向捲動的結果卡。點卡片飛到該處或開啟詳情（由呼叫端決定）。
 */
export default function ToolResultsBox({ groups, isDark, onOpenItem }: ToolResultsBoxProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const tones = semanticColors(isDark);
  const fontScale = useFontScale();
  const [expanded, setExpanded] = useState(true);
  const [tab, setTab] = useState(0);
  if (groups.length === 0) return null;

  const active = groups[Math.min(tab, groups.length - 1)];
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const heading = groups.length > 1 ? t('nativeAiCardRelated') : active.heading;
  const items = active.items.slice(0, MAX_DISPLAY);

  return (
    <View style={[styles.box, { backgroundColor: tones.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${heading}，${t('nativeAiCardCount', { count: total })}`}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        <View style={[styles.headerIcon, { backgroundColor: tones.accentSoft }]}>
          <Icon name={ICON[groups.length > 1 ? 'search' : active.icon]} size={16} color={tones.accent} />
        </View>
        <Text numberOfLines={1} style={[styles.heading, { color: colors.text, fontSize: scaledSize(TYPE.callout, fontScale) }]}>
          {heading}
        </Text>
        <Text style={[styles.count, { color: colors.textSecondary, fontSize: scaledSize(TYPE.caption, fontScale) }]}>
          {t('nativeAiCardCount', { count: total })}
        </Text>
        <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={16} color={colors.textSecondary} />
      </Pressable>

      {expanded ? (
        <>
          {groups.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
              {groups.map((group, index) => {
                const selected = group === active;
                return (
                  <Pressable
                    key={`${group.icon}-${group.heading}`}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    onPress={() => setTab(index)}
                    style={[styles.tab, { backgroundColor: selected ? tones.accentSoft : 'transparent', borderColor: tones.separator }]}>
                    <Icon name={ICON[group.icon]} size={14} color={selected ? tones.accent : colors.textSecondary} />
                    <Text
                      numberOfLines={1}
                      style={[styles.tabText, { color: selected ? tones.accent : colors.textSecondary, fontSize: scaledSize(TYPE.caption, fontScale) }]}>
                      {group.heading}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {active.note ? (
            <Text style={[styles.note, { color: colors.textSecondary, fontSize: scaledSize(TYPE.subhead, fontScale) }]}>{active.note}</Text>
          ) : null}

          {items.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + 8}
              decelerationRate="fast"
              contentContainerStyle={styles.cards}>
              {items.map((item) => {
                const openable = Boolean(item.marker ?? item.position);
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole={openable ? 'button' : 'text'}
                    accessibilityLabel={[item.title, item.subtitle, item.badge].filter(Boolean).join('，')}
                    accessibilityHint={openable ? t('nativeAiCardOpenHint') : undefined}
                    disabled={!openable}
                    onPress={() => onOpenItem(item)}
                    style={({ pressed }) => [
                      styles.card,
                      { backgroundColor: colors.background, borderColor: tones.separator },
                      pressed && styles.pressed,
                    ]}>
                    <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.text, fontSize: scaledSize(TYPE.callout, fontScale) }]}>
                      {item.title}
                    </Text>
                    {item.subtitle ? (
                      <Text numberOfLines={2} style={{ color: colors.textSecondary, fontSize: scaledSize(TYPE.subhead, fontScale) }}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                    {item.badge ? (
                      <View style={[styles.badge, { backgroundColor: tones.accentSoft }]}>
                        <Text numberOfLines={1} style={[styles.badgeText, { color: tones.accent, fontSize: scaledSize(TYPE.caption, fontScale) }]}>
                          {item.badge}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: RADIUS.card, paddingVertical: 10, gap: 8, marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, minHeight: 36 },
  headerIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, fontWeight: '700' },
  count: { fontWeight: '600' },
  tabs: { gap: 6, paddingHorizontal: 12 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    minHeight: 30,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabText: { fontWeight: '600', maxWidth: 160 },
  note: { paddingHorizontal: 12 },
  cards: { gap: 8, paddingHorizontal: 12 },
  card: {
    width: CARD_WIDTH,
    borderRadius: RADIUS.small + 2,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 4,
  },
  cardTitle: { fontWeight: '600' },
  badge: { alignSelf: 'flex-start', borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  badgeText: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
