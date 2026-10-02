import { Pressable, StyleSheet } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { useCloseScreen } from '@/shared/navigation';
import { useSemanticColors } from '@/shared/theme';

import Icon from './Icon';

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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('close')}
      hitSlop={8}
      onPress={onPress ?? closeScreen}
      style={styles.button}>
      <Icon name="close" size={22} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
});
