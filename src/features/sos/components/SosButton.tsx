import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';

import { selectSosInProgress, useSosStore } from '../store/sosStore';

const SOS_RED = '#C62828';

/**
 * 地圖上的 SOS 浮動按鈕（SDD §4.4 MapControls、§10：SOS 主按鈕 ≥ 64 pt）。一下就開 SOS 畫面並開始 5 秒倒數
 * （倒數可取消，防誤觸在倒數畫面處理）；求救進行中顯示白色外圈，按下回到進行中畫面。
 */
export default function SosButton() {
  const { t } = useAppTranslation();
  const active = useSosStore(selectSosInProgress);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? t('sosActiveTitle') : t('nativeSosButtonLabel')}
      accessibilityHint={active ? undefined : t('nativeSosButtonHint')}
      onPress={() => router.push('/sos')}
      style={({ pressed }) => [styles.button, active && styles.active, pressed && styles.pressed]}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text style={styles.text}>SOS</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: SOS_RED,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  active: { borderWidth: 4, borderColor: '#FFFFFF' },
  pressed: { opacity: 0.8 },
  text: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
});
