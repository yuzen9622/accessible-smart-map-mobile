import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { mapCamera, useMapUiStore } from '@/features/map';
import { motionDuration } from '@/shared/accessibility';
import { haversineMeters, lngLatToLatLng } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { ACCENT_FILL, ELEVATION, ICON_SIZE, ON_ACCENT_FILL, SHAPE, SPACE, TYPE } from '@/shared/theme';
import { MOTION } from '@/shared/theme/motion';
import { Icon } from '@/shared/ui';
import { SheetEdgeFollower } from '../../../../modules/sheet-detent';
import { Text } from '@/shared/ui/typography/Text';
import PressableScale from '@/shared/ui/PressableScale';

import { usePlaceUiStore } from '../store/placeUiStore';

/** 中心點離目標 pin 超過這個距離（公尺）才算「飛出去了」，顯示按鈕。 */
const RETURN_BUTTON_DISTANCE_THRESHOLD_M = 50;
/** sheet 拉過畫面這個比例（從上算）後，按鈕就停在那條線上不再往上。 */
const FOLLOW_MAX_RISE = 0.5;

/**
 * 「回到搜尋點」浮動鈕：只在「使用者自己拖拽地圖」且「離目標 pin 超過門檻距離」時才出現
 * （使用者回饋 2026-10-25：剛搜尋完、程式自動把相機飛過去時按鈕也冒出來了——那是
 * `mapCamera.flyTo` 的自動置中，不是使用者手勢，不該算數）。`mapUiStore` 的
 * `lastRegionChangeWasUserInteraction` 由 `MapScreen` 的 `onRegionDidChange` 依原生事件的
 * `userInteraction` 旗標更新，直接拿來當「現在算不算使用者拖開」的唯一依據，不用另外存一份
 * local state 去同步：選到新地點時 `usePlaceDetailViewModel` 會呼叫 `mapCamera.flyTo` 把相機
 * 飛過去，那一次 `onRegionDidChange` 的 `userInteraction` 本來就是 false，旗標自然歸零；按下
 * 這顆按鈕的 `flyTo` 也一樣，不用手動重置。
 *
 * 位置（iOS）：用原生 `SheetEdgeFollower` 每個 display frame 讀 sheet 的 presentation layer，
 * 貼在 sheet 實際上緣的正上方、水平置中，拖曳與 detent 動畫都逐格跟著走；sheet 高過畫面一半後
 * 停在畫面中線（`maxRise`），不會再往上跑。以前用 `sheetInset`（detent 比例×視窗高度）推算，
 * 但 sheet 實際高度含浮動邊距，peek 時推算值偏低，按鈕被 sheet 蓋住。原生模組不存在
 * （Android／舊 dev client）時才退回下面這套推算位置。
 *
 * 退回路徑：位置跟著 `sheetInset`（sheet 目前高度）用 `Animated.Value` 平滑過渡，不是直接套用
 * 新數字：sheet 的偵測點（detent）變化是原生事件、沒有逐幀的拖曳進度可以綁定，只能在
 * 偵測點改變的瞬間把按鈕位置「動畫」過去，取代直接套用新 bottom 值的瞬間跳動／摔落
 * （使用者回饋：按鈕位置沒有隨 Sheet 動態懸浮，直接摔落並與把手重疊）。
 */
export default function ReturnToSearchButton() {
  const { t } = useAppTranslation();
  const selectedPlace = usePlaceUiStore((state) => state.selectedPlace);
  const center = useMapUiStore((state) => state.center);
  const userInteraction = useMapUiStore((state) => state.lastRegionChangeWasUserInteraction);
  const sheetInset = useMapUiStore((state) => state.sheetInset);

  const [insetAnim] = useState(() => new Animated.Value(sheetInset));
  useEffect(() => {
    Animated.timing(insetAnim, {
      toValue: sheetInset,
      duration: motionDuration(MOTION.move.duration),
      useNativeDriver: true,
    }).start();
  }, [sheetInset, insetAnim]);

  const centerLatLng = center ? lngLatToLatLng(center) : null;
  const distance = selectedPlace && centerLatLng ? haversineMeters(centerLatLng, selectedPlace.position) : 0;
  const visible = Boolean(selectedPlace && centerLatLng && userInteraction && distance > RETURN_BUTTON_DISTANCE_THRESHOLD_M);

  if (!visible || !selectedPlace) return null;

  const handlePress = () => {
    const { lat, lng } = selectedPlace.position;
    mapCamera.flyTo([lng, lat]);
  };

  const button = (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('nativeReturnToSearchPoint')}
      onPress={handlePress}
      style={styles.button}>
      <Icon name="mapPinned" size={ICON_SIZE.control} color={ON_ACCENT_FILL} />
      <Text style={styles.label}>{t('nativeReturnToSearchPoint')}</Text>
    </PressableScale>
  );

  if (SheetEdgeFollower) {
    return (
      <SheetEdgeFollower gap={SPACE.md} maxRise={FOLLOW_MAX_RISE} style={styles.follower}>
        {button}
      </SheetEdgeFollower>
    );
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { transform: [{ translateY: Animated.multiply(insetAnim, -1) }] }]}>
      {button}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 外層只管位置／動畫；內層的 PressableScale 管外觀，避免把 Animated 的插值直接餵給
  // 非 Animated 包裝的元件（RN 的 transform 型別需要具體數字，PressableScale 本身不是
  // `Animated.createAnimatedComponent` 包出來的）。
  follower: { position: 'absolute', bottom: 0, alignSelf: 'center' },
  wrap: { position: 'absolute', bottom: SPACE.md, alignSelf: 'center' },
  button: {
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
