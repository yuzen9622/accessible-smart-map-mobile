import { StyleSheet } from 'react-native';

import { boundsContain, mapCamera, useMapUiStore } from '@/features/map';
import { useAppTranslation } from '@/shared/i18n';
import { ACCENT_FILL, ELEVATION, ICON_SIZE, ON_ACCENT_FILL, SHAPE, SPACE, TYPE } from '@/shared/theme';
import { Icon } from '@/shared/ui';
import { Text } from '@/shared/ui/typography/Text';
import PressableScale from '@/shared/ui/PressableScale';

import { usePlaceUiStore } from '../store/placeUiStore';

/**
 * 「回到搜尋點」浮動鈕：使用者把地圖滑開、目前選定的搜尋 pin 離開可視範圍時才出現
 * （`onRegionDidChange` 更新 `mapUiStore.bounds`，跟 pin 座標比對）。按下後 `flyTo` 平滑移回，
 * 移動完成後 `onRegionDidChange` 重新算出 pin 又在範圍內，按鈕自己消失，不需要額外的
 * 「到了就隱藏」狀態。懸浮在首頁 sheet 的原生把手正上方，位置跟著 `sheetInset` 升降
 * （使用者回饋 2026-10-25）。
 */
export default function ReturnToSearchButton() {
  const { t } = useAppTranslation();
  const selectedPlace = usePlaceUiStore((state) => state.selectedPlace);
  const bounds = useMapUiStore((state) => state.bounds);
  const sheetInset = useMapUiStore((state) => state.sheetInset);

  if (!selectedPlace || !bounds || boundsContain(bounds, selectedPlace.position)) return null;

  const handlePress = () => {
    const { lat, lng } = selectedPlace.position;
    mapCamera.flyTo([lng, lat]);
  };

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('nativeReturnToSearchPoint')}
      onPress={handlePress}
      style={[styles.button, { bottom: sheetInset + SPACE.md }]}>
      <Icon name="mapPinned" size={ICON_SIZE.control} color={ON_ACCENT_FILL} />
      <Text style={styles.label}>{t('nativeReturnToSearchPoint')}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    paddingVertical: 10,
    paddingHorizontal: SPACE.lg,
    borderRadius: SHAPE.pill,
    borderCurve: 'continuous',
    backgroundColor: ACCENT_FILL,
    boxShadow: ELEVATION.floating,
  },
  label: { color: ON_ACCENT_FILL, fontSize: TYPE.subhead, fontWeight: '600' },
});
