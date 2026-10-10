import Host from '@/shared/ui/typography/PreferenceHost.ios';

import { PlatformColor, StyleSheet, View } from 'react-native';

import type { KeyboardAvoidingHostProps } from './KeyboardAvoidingHost.types';
import { useKeyboardInset } from './useKeyboardInset';

/** 聚焦的輸入框與鍵盤上緣至少隔這麼多（約一列 Form 內距），整列看得到、不會貼著鍵盤。 */
const FIELD_CLEARANCE = 24;

/**
 * 填滿畫面、會讓開鍵盤的 SwiftUI `Host`（給有輸入框的 `Form` 用）。
 *
 * `Host` 預設的鍵盤 safe area 只保證輸入框「文字那一行」在可視範圍內、貼齊鍵盤上緣，
 * 列的上下內距留在鍵盤後面（實測登入表單的密碼欄被擋住半格）。改由外層把 `Host` 縮到
 * 鍵盤上緣再往上留一段：SwiftUI 會在 `Host` 變矮時把聚焦欄位捲回可視範圍，於是欄位與鍵盤
 * 之間一定有留白。留白區用 `Form` 同色的 grouped 背景，看起來仍是同一張表單。
 */
export default function KeyboardAvoidingHost({ children }: KeyboardAvoidingHostProps) {
  const keyboardInset = useKeyboardInset();
  return (
    <View style={[styles.root, styles.background, { paddingBottom: keyboardInset > 0 ? keyboardInset + FIELD_CLEARANCE : 0 }]}>
      <Host style={styles.root} ignoreSafeArea="keyboard">
        {children}
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  background: { backgroundColor: PlatformColor('systemGroupedBackground') },
});
