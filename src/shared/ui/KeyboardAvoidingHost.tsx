import { StyleSheet, View } from 'react-native';

import type { KeyboardAvoidingHostProps } from './KeyboardAvoidingHost.types';

/** Android／fallback：沒有 SwiftUI `Host`，系統 `adjustResize` 會縮小視窗，直接填滿即可。 */
export default function KeyboardAvoidingHost({ children }: KeyboardAvoidingHostProps) {
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
