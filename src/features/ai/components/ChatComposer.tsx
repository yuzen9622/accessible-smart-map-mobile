import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useFontScale } from '@/shared/preferences';
import { ACCENT_FILL, MIN_TOUCH, ON_ACCENT_FILL, RADIUS, TYPE, scaledSize, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

export interface ChatComposerProps {
  isDark: boolean;
  isLoading: boolean;
  placeholder: string;
  sendLabel: string;
  stopLabel: string;
  suggestions: string[];
  /** 預填的問題（深層連結 `chat?q=`、首頁問句轉交）；只填入不送出。 */
  initialText?: string;
  /** 輸入框右側、送出鈕左側的附加按鈕（語音 feature 的麥克風，由 app 路由注入）；串流中與已輸入文字時隱藏。 */
  accessory?: ReactNode;
  onSend: (text: string) => void;
  onStop: () => void;
}

/**
 * 聊天輸入列（對齊 Web `AIChatBot.tsx` 底部）：建議 chips（只在還沒問過問題時出現）＋多行輸入＋送出／停止。
 * 串流中送出鈕換成停止鈕（Web 的 `Square`），輸入框仍可打字但送不出去。
 */
export default function ChatComposer({
  isDark,
  isLoading,
  placeholder,
  sendLabel,
  stopLabel,
  suggestions,
  initialText = '',
  accessory,
  onSend,
  onStop,
}: ChatComposerProps) {
  const colors = useThemeColors();
  const tones = useSemanticColors();
  const fontScale = useFontScale();
  const [text, setText] = useState(initialText);
  const canSend = text.trim().length > 0 && !isLoading;

  const submit = () => {
    const value = text.trim();
    if (!value || isLoading) return;
    setText('');
    onSend(value);
  };

  return (
    <View style={styles.root}>
      {suggestions.length > 0 && !isLoading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              accessibilityRole="button"
              onPress={() => onSend(suggestion)}
              style={({ pressed }) => [styles.chip, { backgroundColor: tones.accentSoft }, pressed && styles.pressed]}>
              <Icon name="sparkles" size={14} color={tones.accent} />
              <Text style={[styles.chipText, { color: tones.accent, fontSize: scaledSize(TYPE.subhead, fontScale) }]}>{suggestion}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={[styles.bar, { backgroundColor: colors.backgroundElement, borderColor: tones.separator }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={placeholder}
          multiline
          submitBehavior="submit"
          onSubmitEditing={submit}
          returnKeyType="send"
          style={[styles.input, { color: colors.text, fontSize: scaledSize(TYPE.body, fontScale) }]}
        />
        {accessory && !isLoading && text.length === 0 ? accessory : null}
        {isLoading ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={stopLabel}
            onPress={onStop}
            hitSlop={6}
            style={({ pressed }) => [styles.action, { backgroundColor: colors.text }, pressed && styles.pressed]}>
            <Icon name="stop" size={14} color={colors.background} strokeWidth={3} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={sendLabel}
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={submit}
            hitSlop={6}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: canSend ? ACCENT_FILL : tones.neutral.bg },
              pressed && styles.pressed,
            ]}>
            <Icon name="arrowUp" size={18} color={canSend ? ON_ACCENT_FILL : colors.textSecondary} strokeWidth={2.5} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const ACTION = 34;

const styles = StyleSheet.create({
  root: { gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  chips: { gap: 8, paddingHorizontal: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TOUCH - 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
  },
  chipText: { fontWeight: '600' },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    minHeight: MIN_TOUCH,
  },
  input: { flex: 1, maxHeight: 140, paddingTop: 7, paddingBottom: 7 },
  action: { width: ACTION, height: ACTION, borderRadius: ACTION / 2, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
