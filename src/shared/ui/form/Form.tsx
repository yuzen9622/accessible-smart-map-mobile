import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';

import { ACCENT_FILL, DANGER_FILL, scaledSize, useSemanticColors, useThemeColors, WHITE, SHAPE, TYPE } from '@/shared/theme';
import { useFontScale } from '@/shared/preferences';
import PressableScale from '@/shared/ui/PressableScale';

/**
 * Android／fallback 的設定式表單基元（iOS 用 SwiftUI `Form`）。
 * 對應 SDD §4.5 表格的 Compose `LazyColumn` + `ListItem`：`@expo/ui/jetpack-compose` 未實跑驗證、
 * 且本機沒有 Android 裝置，先以 RN 元件實作並確保觸控目標 ≥ 48 dp、所有互動元素有無障礙語意。
 */

// 與全 App 同一個主色／危險色（`shared/theme/tokens.ts`）；以前這裡寫死另一種藍 #1565C0。
const ACCENT = ACCENT_FILL;
export const FORM_DESTRUCTIVE = DANGER_FILL;

export function FormScreen({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  return (
    <ScrollView
      style={{ backgroundColor: colors.backgroundElement }}
      contentContainerStyle={styles.screen}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      {children}
    </ScrollView>
  );
}

export function FormSection({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const colors = useThemeColors();
  const scale = useFontScale();
  return (
    <View style={styles.section}>
      {title ? (
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: scaledSize(TYPE.footnote, scale) }]}>
          {title}
        </Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: colors.background }]}>{children}</View>
      {footer ? <Text style={[styles.footer, { color: colors.textSecondary, fontSize: scaledSize(TYPE.caption, scale) }]}>{footer}</Text> : null}
    </View>
  );
}

/** 文字用的主色／危險色：深色模式要用亮一階的版本（實心底色才用 ACCENT_FILL／DANGER_FILL）。 */
function useTextTones() {
  const tones = useSemanticColors();
  return { accent: tones.accent, danger: tones.danger.fg };
}

export function FormText({ children, tone = 'primary' }: { children: ReactNode; tone?: 'primary' | 'secondary' | 'error' }) {
  const colors = useThemeColors();
  const scale = useFontScale();
  const text = useTextTones();
  const color = tone === 'error' ? text.danger : tone === 'secondary' ? colors.textSecondary : colors.text;
  return (
    <Text
      accessibilityLiveRegion={tone === 'error' ? 'polite' : 'none'}
      style={[styles.text, { color, fontSize: scaledSize(tone === 'primary' ? 16 : 14, scale) }]}>
      {children}
    </Text>
  );
}

export interface FormInputProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoComplete?: TextInputProps['autoComplete'];
  maxLength?: number;
  multiline?: boolean;
  onSubmitEditing?: () => void;
  onFocus?: () => void;
}

export function FormInput({ label, value, onChangeText, secure, keyboardType, autoComplete, maxLength, multiline, onSubmitEditing, onFocus }: FormInputProps) {
  const colors = useThemeColors();
  const scale = useFontScale();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={label}
      placeholderTextColor={colors.textSecondary}
      accessibilityLabel={label}
      secureTextEntry={secure}
      keyboardType={keyboardType}
      autoComplete={autoComplete}
      autoCapitalize={keyboardType === 'email-address' || secure ? 'none' : 'sentences'}
      autoCorrect={!(keyboardType === 'email-address' || secure)}
      maxLength={maxLength}
      multiline={multiline}
      onSubmitEditing={onSubmitEditing}
      onFocus={onFocus}
      style={[
        styles.input,
        multiline && styles.multiline,
        { color: colors.text, borderColor: colors.backgroundElement, fontSize: scaledSize(TYPE.callout, scale) },
      ]}
    />
  );
}

export interface FormRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** 放在標籤左邊的圖示（Lucide，裝飾性）。 */
  icon?: ReactNode;
}

export function FormRow({ label, value, onPress, destructive, disabled, icon }: FormRowProps) {
  const colors = useThemeColors();
  const scale = useFontScale();
  const text = useTextTones();
  const content = (
    <>
      {icon ? <View importantForAccessibility="no-hide-descendants">{icon}</View> : null}
      <Text style={[styles.rowLabel, { color: destructive ? text.danger : onPress ? text.accent : colors.text, fontSize: scaledSize(TYPE.callout, scale) }]}>
        {label}
      </Text>
      {value ? <Text style={[styles.rowValue, { color: colors.textSecondary, fontSize: scaledSize(TYPE.subhead, scale) }]}>{value}</Text> : null}
    </>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={value ? `${label}，${value}` : label} style={styles.row}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale feedback="highlight"
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}，${value}` : label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, disabled && styles.dim]}>
      {content}
    </PressableScale>
  );
}

export function FormSwitch({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  /** 副標題（第二行灰字），對應 iOS Toggle 的兩行標籤。 */
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const colors = useThemeColors();
  const scale = useFontScale();
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}>
        <Text style={{ color: colors.text, fontSize: scaledSize(TYPE.callout, scale) }}>{label}</Text>
        {description ? (
          <Text style={{ color: colors.textSecondary, fontSize: scaledSize(TYPE.footnote, scale) }}>{description}</Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={description ? `${label}，${description}` : label}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      />
    </View>
  );
}

export interface FormChoice<T extends string> {
  value: T;
  label: string;
}

/** 分段選擇（對應 SwiftUI `Picker(segmented)`／Compose `SingleChoiceSegmentedButtonRow`）。 */
export function FormSegmented<T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: T;
  choices: FormChoice<T>[];
  onChange: (v: T) => void;
}) {
  const colors = useThemeColors();
  const scale = useFontScale();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.segmented}>
      {choices.map((choice) => {
        const selected = choice.value === value;
        return (
          <PressableScale
            key={choice.value}
            accessibilityRole="radio"
            accessibilityLabel={choice.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(choice.value)}
            style={[styles.segment, { backgroundColor: selected ? ACCENT : colors.backgroundElement }]}>
            <Text style={{ color: selected ? WHITE : colors.text, fontSize: scaledSize(TYPE.subhead, scale), fontWeight: selected ? '600' : '400' }}>
              {choice.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function FormButton({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
}) {
  const colors = useThemeColors();
  const scale = useFontScale();
  const background = variant === 'primary' ? ACCENT : variant === 'destructive' ? FORM_DESTRUCTIVE : colors.backgroundElement;
  const foreground = variant === 'secondary' ? colors.text : WHITE;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[styles.button, { backgroundColor: background }, disabled && styles.dim]}>
      {loading ? <ActivityIndicator color={foreground} /> : <Text style={{ color: foreground, fontSize: scaledSize(TYPE.callout, scale), fontWeight: '600' }}>{label}</Text>}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 48, gap: 20 },
  section: { gap: 6 },
  sectionTitle: { textTransform: 'uppercase', paddingHorizontal: 12 },
  card: { borderRadius: SHAPE.card, borderCurve: 'continuous', paddingHorizontal: 12, paddingVertical: 4, gap: 4 },
  footer: { paddingHorizontal: 12 },
  text: { paddingVertical: 10 },
  input: { minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowLabel: { flex: 1 },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  segmented: { flexDirection: 'row', gap: 6, paddingVertical: 8, flexWrap: 'wrap' },
  segment: { minHeight: 44, flexGrow: 1, borderRadius: SHAPE.control, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  button: { minHeight: 50, borderRadius: SHAPE.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', marginVertical: 6, paddingHorizontal: 16 },
  dim: { opacity: 0.5 },
});
