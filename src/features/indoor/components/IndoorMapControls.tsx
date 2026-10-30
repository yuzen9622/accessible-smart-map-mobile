import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useFontScale } from '@/shared/preferences/useFontScale';
import { ICON_SIZE, MAX_FONT_SCALE, SHAPE, SPACE, TYPE, useSemanticColors, useThemeColors } from '@/shared/theme';
import GlassCard from '@/shared/ui/GlassCard';
import Icon from '@/shared/ui/Icon';
import PressableScale from '@/shared/ui/PressableScale';
import { Text } from '@/shared/ui/typography/Text';

import { useIndoorStore } from '../store/indoorStore';

function floorLabel(ref: string | null): string {
  if (ref === null) return '戶外';
  return /^\d+$/.test(ref) ? `${ref}F` : /^-\d+$/.test(ref) ? `B${Math.abs(Number(ref))}` : ref;
}

export default function IndoorMapControls() {
  const active = useIndoorStore((s) => s.active);
  const venue = useIndoorStore((s) => s.venue);
  const floor = useIndoorStore((s) => s.floor);
  const [picker, setPicker] = useState<'building' | 'floor' | null>(null);
  const colors = useThemeColors();
  const tones = useSemanticColors();
  const { width, fontScale } = useWindowDimensions();
  const appFontScale = useFontScale();
  if (!active || venue.status !== 'ready') return null;
  const building = venue.data.buildings.find((b) => b.id === floor.buildingId);
  const levels = [...(building?.levels ?? [])].sort((a, b) => a.ordinal - b.ordinal);
  const levelIndex = levels.findIndex((level) => level.ref === floor.levelRef);
  const buildingName = building?.name ?? venue.data.name;
  const buildingWidth = Math.min(width - 96, 88 + buildingName.length * TYPE.callout * appFontScale * Math.min(fontScale, MAX_FONT_SCALE.label));

  return <View style={styles.column}>
    <GlassCard interactive style={[styles.building, { width: buildingWidth }]}>
      <PressableScale accessibilityRole="button" accessibilityLabel={`切換建築，目前為${buildingName}`} accessibilityState={{ expanded: picker === 'building' }}
        onPress={() => setPicker(picker === 'building' ? null : 'building')} style={styles.buildingButton}>
        <Icon name="cuboid" size={ICON_SIZE.control} color={tones.accent} />
        <Text numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.buildingName, { color: colors.text }]}>{buildingName}</Text>
        <Icon name={picker === 'building' ? 'chevronUp' : 'chevronDown'} size={ICON_SIZE.caption} color={colors.textSecondary} />
      </PressableScale>
    </GlassCard>
    {picker === 'building' ? <GlassCard interactive style={styles.menu}>
      {venue.data.buildings.map((item) => <PressableScale key={item.id} accessibilityRole="button" accessibilityLabel={item.name} accessibilityState={{ selected: item.id === building?.id }}
        onPress={() => {
          const level = item.levels.find((entry) => entry.ref === floor.levelRef) ?? item.levels.find((entry) => entry.ref === '1F') ?? item.levels[0];
          if (level) useIndoorStore.getState().selectFloor({ buildingId: item.id, levelRef: level.ref });
          setPicker(null);
        }} style={styles.menuButton}>
        <Text style={[styles.buildingName, { color: item.id === building?.id ? tones.accent : colors.text }]}>{item.name}</Text>
      </PressableScale>)}
      <PressableScale accessibilityRole="button" accessibilityLabel="顯示周邊地圖" onPress={() => { useIndoorStore.getState().suspend(); setPicker(null); }} style={styles.menuButton}>
        <Text style={[styles.buildingName, { color: tones.accent }]}>周邊地圖</Text>
      </PressableScale>
    </GlassCard> : null}
    {building ? <GlassCard interactive style={styles.floorControl}>
      {[-1, 0, 1].map((offset) => {
        const level = levels[levelIndex + offset];
        const current = offset === 0;
        return <PressableScale key={offset} accessibilityRole="button"
          accessibilityLabel={current ? `選擇樓層，目前為${floorLabel(floor.levelRef)}` : level ? `瀏覽 ${level.ref} 樓層` : '沒有其他樓層'}
          accessibilityState={{ disabled: !current && !level }} disabled={!current && !level}
          onPress={() => { if (current) setPicker(picker === 'floor' ? null : 'floor'); else if (level) useIndoorStore.getState().selectFloor({ buildingId: building.id, levelRef: level.ref }); }}
          style={[styles.floorButton, { opacity: current || level ? 1 : 0.35 }]}>
          {current ? <Text style={[styles.floorLabel, { color: tones.accent }]}>{floorLabel(floor.levelRef)}</Text>
            : <Icon name={offset < 0 ? 'chevronDown' : 'chevronUp'} size={ICON_SIZE.control} color={colors.text} />}
        </PressableScale>;
      })}
    </GlassCard> : null}
    {picker === 'floor' && building ? <GlassCard interactive style={styles.menu}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {levels.map((level) => <PressableScale key={level.ref} accessibilityRole="button" accessibilityLabel={`瀏覽 ${floorLabel(level.ref)}`} accessibilityState={{ selected: level.ref === floor.levelRef }}
          onPress={() => { useIndoorStore.getState().selectFloor({ buildingId: building.id, levelRef: level.ref }); setPicker(null); }} style={styles.floorButton}>
          <Text style={[styles.floorLabel, { color: level.ref === floor.levelRef ? tones.accent : colors.text }]}>{floorLabel(level.ref)}</Text>
        </PressableScale>)}
      </ScrollView>
    </GlassCard> : null}
  </View>;
}

const styles = StyleSheet.create({
  column: { alignItems: 'flex-start', gap: SPACE.sm, maxWidth: '100%' },
  building: { borderRadius: SHAPE.pill, maxWidth: '100%' },
  buildingButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm },
  buildingName: { flexShrink: 1, fontSize: TYPE.callout, fontWeight: '600' },
  floorControl: { flexDirection: 'row', borderRadius: SHAPE.pill },
  floorButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.sm },
  floorLabel: { fontSize: TYPE.headline, fontWeight: '700', fontVariant: ['tabular-nums'] },
  menu: { maxWidth: '100%', borderRadius: SHAPE.card },
  menuButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm },
});
