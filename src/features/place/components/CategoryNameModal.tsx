import { useState } from 'react';
import { Modal, StyleSheet, TextInput, View, Pressable } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { SPACE, useSemanticColors, useThemeColors, TYPE, SHAPE } from '@/shared/theme';
import { Text } from '@/shared/ui/typography/Text';
import PressableScale from '@/shared/ui/PressableScale';

export interface CategoryNameModalProps {
  visible: boolean;
  title: string;
  initialValue?: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}

/**
 * 新增／重新命名收藏分類的小輸入框（像 Google 地圖「建立新清單」）。純 RN `Modal` + `TextInput`，
 * 不分平台——iOS 的 `@expo/ui` SwiftUI Form 沒有現成的文字輸入彈窗可用，這裡獨立於那套 Form 之外
 * 疊一層原生 Modal，兩平台共用同一份實作最簡單（測試人員回饋 2026-10-11：分類要能自己編輯）。
 *
 * 內容拆成 `CategoryNameModalContent` 並只在 `visible` 時掛載：`initialValue` 只需要在打開那一刻
 * 當 `useState` 初始值，不必用 effect 同步（每次重新打開都是全新掛載，state 自然重置）。
 */
export default function CategoryNameModal({ visible, title, initialValue, onCancel, onSubmit }: CategoryNameModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {visible ? (
        <CategoryNameModalContent title={title} initialValue={initialValue} onCancel={onCancel} onSubmit={onSubmit} />
      ) : null}
    </Modal>
  );
}

function CategoryNameModalContent({
  title,
  initialValue,
  onCancel,
  onSubmit,
}: Omit<CategoryNameModalProps, 'visible'>) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const tones = useSemanticColors();
  const [value, setValue] = useState(initialValue ?? '');
  const trimmed = value.trim();

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      <View style={[styles.card, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={t('nativeSavedCategoryNamePlaceholder')}
          placeholderTextColor={colors.textSecondary}
          autoFocus
          style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
          returnKeyType="done"
          onSubmitEditing={() => trimmed && onSubmit(trimmed)}
        />
        <View style={styles.actions}>
          <PressableScale accessibilityRole="button" onPress={onCancel} style={styles.actionButton}>
            <Text style={{ color: colors.textSecondary, fontSize: TYPE.callout }}>{t('cancel')}</Text>
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            disabled={!trimmed}
            onPress={() => onSubmit(trimmed)}
            style={styles.actionButton}>
            <Text style={{ color: trimmed ? tones.accent : colors.textSecondary, fontSize: TYPE.callout, fontWeight: '600' }}>
              {t('done')}
            </Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  card: { width: '84%', borderRadius: SHAPE.card, borderCurve: 'continuous', padding: SPACE.lg, gap: SPACE.md },
  title: { fontSize: TYPE.body, fontWeight: '600' },
  input: { minHeight: 44, borderRadius: SHAPE.control, borderCurve: 'continuous', paddingHorizontal: SPACE.md, fontSize: TYPE.callout },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACE.lg },
  actionButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: SPACE.sm },
});
