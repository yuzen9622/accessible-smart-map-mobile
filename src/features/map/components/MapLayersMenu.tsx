import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { useAppTranslation } from '@/shared/i18n';
import { RADIUS, SPACE, useSemanticColors, useThemeColors } from '@/shared/theme';
import { FormSwitch } from '@/shared/ui';

import type { MapLayersMenuProps } from './MapLayersMenu.types';

/**
 * 「圖層」鈕點開的選單（方案 A）：3D 建築視角切換 + 無障礙設施分類疊圖，取代原本常駐浮在地圖上的
 * 篩選 chips（測試人員回饋 2026-10-11：設施篩選入口重複；首頁預設顯示改到設定頁後，這裡只保留
 * 「這次要看什麼」的臨時疊圖）。卡片直接錨定在「圖層」按鈕下方，點卡片外任何地方關閉。
 */
export default function MapLayersMenu({ anchorTop, is3d, onToggle3d, facilityToggles, onClose }: MapLayersMenuProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  const reduceMotion = useReducedMotion();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onPress={onClose}
      />
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(140)}
        exiting={reduceMotion ? undefined : FadeOut.duration(120)}
        style={[styles.card, { top: anchorTop, backgroundColor: colors.backgroundElement }]}>
        <FormSwitch label={t('switchTo3D')} value={is3d} onValueChange={onToggle3d} />
        <View style={[styles.divider, { backgroundColor: semantic.separator }]} />
        {facilityToggles.map((toggle) => (
          <FormSwitch key={toggle.key} label={toggle.label} value={toggle.selected} onValueChange={toggle.onToggle} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    right: 16,
    width: 240,
    borderRadius: RADIUS.card,
    padding: SPACE.md,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: SPACE.xs },
});
