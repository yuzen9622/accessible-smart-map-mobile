import { Platform, StyleSheet } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { useCloseScreen } from '@/shared/navigation';
import { useSemanticColors, ICON_SIZE } from '@/shared/theme';

import Icon from './Icon';
import PressableScale from '@/shared/ui/PressableScale';

/**
 * modal 導覽列的關閉按鈕（X 圖示，不用文字）。iOS pageSheet 雖可下滑關閉，但 VoiceOver／Switch Control 使用者需要明確的按鈕
 * （SDD §10 焦點與 modal）。
 */
export default function HeaderCloseButton({ onPress }: { onPress?: () => void }) {
  const { t } = useAppTranslation();
  const closeScreen = useCloseScreen();
  // 深色導覽列上 #1565C0 只有約 2.9:1；改用規範的主色文字色（深色模式為亮藍）
  const color = useSemanticColors().accent;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('close')}
      hitSlop={8}
      onPress={onPress ?? closeScreen}
      style={styles.button}>
      <Icon name="close" size={ICON_SIZE.control} color={color} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // iOS 26 導覽列會替按鈕包一層 Liquid Glass 背景並自帶內距；內容再撐成 44×44 會被包成橢圓，
  // 所以 iOS 交給系統決定尺寸（玻璃按鈕本身已達 44pt 觸控範圍），Android 才自己補足觸控尺寸。
  button: Platform.select({
    ios: { width: 22, height: 22, justifyContent: 'center', alignItems: 'center' },
    default: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  }),
});
