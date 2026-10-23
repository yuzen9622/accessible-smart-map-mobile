import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { DANGER_FILL, WHITE, TYPE, SHAPE, ELEVATION, SOS_BUTTON } from '@/shared/theme';

import { selectSosInProgress, useSosStore } from '../store/sosStore';
import PressableScale from '@/shared/ui/PressableScale';

/**
 * 地圖上的 SOS 浮動按鈕（SDD §4.4 MapControls、§10：SOS 主按鈕 ≥ 64 pt）。一下就開 SOS 畫面並開始 5 秒倒數
 * （倒數可取消，防誤觸在倒數畫面處理）；求救進行中顯示白色外圈，按下回到進行中畫面。
 */
export default function SosButton() {
  const { t } = useAppTranslation();
  const active = useSosStore(selectSosInProgress);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={active ? t('sosActiveTitle') : t('nativeSosButtonLabel')}
      accessibilityHint={active ? undefined : t('nativeSosButtonHint')}
      onPress={() => router.navigate('/sos')}
      style={[styles.button, active && styles.active]}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {/* 固定 64pt 圓鈕：字級上限 1.2，放大字級時「SOS」不會超出圓形 */}
        <Text style={styles.text} maxFontSizeMultiplier={1.2}>
          SOS
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: SOS_BUTTON.size,
    height: SOS_BUTTON.size,
    borderRadius: SHAPE.pill, borderCurve: 'continuous',
    backgroundColor: DANGER_FILL,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: ELEVATION.floating,
  },
  active: { borderWidth: 4, borderColor: WHITE },
  text: { color: WHITE, fontSize: TYPE.body, fontWeight: '700', letterSpacing: 1 },
});
