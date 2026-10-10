import { createContext, useContext, type Ref } from 'react';
import {
  StyleSheet, Text as NativeText, TextInput as NativeTextInput,
  type TextProps, type TextInputProps, type StyleProp, type TextStyle,
} from 'react-native';

import { useFontScale } from '@/shared/preferences/useFontScale';
import { usePreferencesStore } from '@/shared/preferences/preferencesStore';

const InsideText = createContext(false);

/** Increase weak weights without reducing an existing bold heading. */
function contrastWeight(style: StyleProp<TextStyle>, highContrast: boolean, nested = false): TextStyle {
  if (!highContrast) return {};
  const weight = StyleSheet.flatten(style)?.fontWeight;
  if (nested && weight === undefined) return {};
  return { fontWeight: weight === 'bold' || Number(weight) >= 600 ? weight : '600' };
}

/** Scale only typography; RN still applies the device's Dynamic Type setting. */
function scaledStyle(style: StyleProp<TextStyle>, scale: number, nested = false): TextStyle {
  const flat = StyleSheet.flatten(style);
  const fontSize = flat?.fontSize ?? (nested ? undefined : 14);
  return {
    ...(fontSize === undefined ? {} : { fontSize: fontSize * scale }),
    ...(flat?.lineHeight === undefined ? {} : { lineHeight: flat.lineHeight * scale }),
    ...(flat?.letterSpacing === undefined ? {} : { letterSpacing: flat.letterSpacing * scale }),
  };
}

/** Use unscaled design sizes here. Existing `scaledSize` callers keep native Text. */
export function Text({ style, children, ref, ...props }: TextProps & { ref?: Ref<NativeText> }) {
  const scale = useFontScale();
  const highContrast = usePreferencesStore(s => s.highContrast);
  const nested = useContext(InsideText);
  return (
    <InsideText.Provider value>
      <NativeText {...props} ref={ref} style={[style, scaledStyle(style, scale, nested), contrastWeight(style, highContrast, nested)]}>
        {children}
      </NativeText>
    </InsideText.Provider>
  );
}

export function TextInput({ style, ref, ...props }: TextInputProps & { ref?: Ref<NativeTextInput> }) {
  const scale = useFontScale();
  const highContrast = usePreferencesStore(s => s.highContrast);
  return <NativeTextInput {...props} ref={ref} style={[style, scaledStyle(style, scale), contrastWeight(style, highContrast)]} />;
}

