import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { ICON_SIZE, SHAPE, SPACE, TYPE, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';
import PressableScale from '@/shared/ui/PressableScale';
import { Text, TextInput } from '@/shared/ui/typography/Text';

import type { RouteLocationSearchPanelProps } from './RouteLocationSearchPanel.types';

export default function RouteLocationSearchPanel({ model }: RouteLocationSearchPanelProps) {
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{model.labels.title}</Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={model.labels.close}
          onPress={model.onClose}
          style={[styles.close, { backgroundColor: semantic.surface }]}>
          <Icon name="close" size={ICON_SIZE.control} color={colors.textSecondary} />
        </PressableScale>
      </View>
      <View style={[styles.search, { backgroundColor: semantic.surface }]}>
        <Icon name="search" size={ICON_SIZE.body} color={colors.textSecondary} />
        <TextInput
          autoFocus
          value={model.query}
          onChangeText={model.onQueryChange}
          editable={!model.resolving}
          accessibilityLabel={model.labels.placeholder}
          placeholder={model.labels.placeholder}
          placeholderTextColor={colors.textSecondary}
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.input, { color: colors.text }]}
        />
        {model.query && !model.resolving ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={model.labels.clear}
            onPress={() => model.onQueryChange('')}
            style={styles.clear}>
            <Icon name="close" size={ICON_SIZE.body} color={colors.textSecondary} />
          </PressableScale>
        ) : null}
      </View>

      {model.onUseMyLocation ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ disabled: model.resolving }}
          disabled={model.resolving}
          onPress={model.onUseMyLocation}
          style={[styles.row, { backgroundColor: semantic.surface }]}>
          <Icon name="navigation" size={ICON_SIZE.body} color={semantic.accent} />
          <Text style={[styles.body, { color: semantic.accent }]}>{model.labels.useMyLocation}</Text>
        </PressableScale>
      ) : null}

      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {model.hasQuery ? model.labels.suggestions : model.labels.history}
      </Text>

      {model.loading || model.resolving ? (
        <View accessibilityLiveRegion="polite" style={styles.status}>
          <ActivityIndicator
            color={semantic.accent}
            accessibilityLabel={model.resolving ? model.labels.resolving : model.labels.searching}
          />
        </View>
      ) : null}

      {model.error ? (
        <View accessibilityLiveRegion="polite" style={styles.status}>
          <Text style={[styles.body, { color: colors.text }]}>{model.error}</Text>
          <PressableScale accessibilityRole="button" onPress={model.onRetry} style={styles.clear}>
            <Text style={[styles.body, { color: semantic.accent }]}>{model.labels.retry}</Text>
          </PressableScale>
        </View>
      ) : !model.loading ? (
        model.rows.length ? (
          <View style={[styles.rows, { backgroundColor: semantic.surface }]}>
            {model.rows.map((row, index) => (
              <PressableScale
                key={row.key}
                accessibilityRole="button"
                accessibilityLabel={row.subtitle ? `${row.title}，${row.subtitle}` : row.title}
                accessibilityState={{ disabled: model.resolving }}
                disabled={model.resolving}
                onPress={row.onPress}
                style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: semantic.separator }]}>
                <Icon name={model.hasQuery ? 'mapPin' : 'clock'} size={ICON_SIZE.body} color={colors.textSecondary} />
                <View style={styles.rowText}>
                  <Text style={[styles.body, { color: colors.text }]} numberOfLines={2}>{row.title}</Text>
                  {row.subtitle ? <Text style={{ color: colors.textSecondary }} numberOfLines={2}>{row.subtitle}</Text> : null}
                </View>
                <Icon name="arrowUpRight" size={ICON_SIZE.body} color={colors.textSecondary} />
              </PressableScale>
            ))}
          </View>
        ) : !model.resolving ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>{model.labels.empty}</Text>
        ) : null
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  title: { flex: 1, fontSize: TYPE.title1, fontWeight: '700' },
  close: { width: 44, height: 44, borderRadius: SHAPE.pill, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACE.lg, gap: SPACE.md, paddingBottom: SPACE.xl },
  search: { flexDirection: 'row', alignItems: 'center', paddingLeft: SPACE.md, borderRadius: SHAPE.control, borderCurve: 'continuous' },
  input: { flex: 1, minHeight: 48, fontSize: TYPE.body, padding: SPACE.sm },
  clear: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: TYPE.footnote, fontWeight: '600', marginTop: SPACE.sm },
  rows: { borderRadius: SHAPE.card, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.md, minHeight: 64, borderRadius: SHAPE.control, borderCurve: 'continuous' },
  rowText: { flex: 1, gap: SPACE.xs },
  body: { fontSize: TYPE.body, flexShrink: 1 },
  status: { gap: SPACE.sm, padding: SPACE.md },
  empty: { fontSize: TYPE.callout, paddingVertical: SPACE.lg },
});
