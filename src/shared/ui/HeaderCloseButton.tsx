import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';

/**
 * modal 導覽列的「關閉」按鈕。iOS pageSheet 雖可下滑關閉，但 VoiceOver／Switch Control 使用者需要明確的按鈕
 * （SDD §10 焦點與 modal）。
 */
export default function HeaderCloseButton({ onPress }: { onPress?: () => void }) {
  const { t } = useAppTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('close')}
      hitSlop={8}
      onPress={onPress ?? (() => router.back())}
      style={styles.button}>
      <Text style={styles.text}>{t('close')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 4 },
  text: { color: '#1565C0', fontSize: 17 },
});
