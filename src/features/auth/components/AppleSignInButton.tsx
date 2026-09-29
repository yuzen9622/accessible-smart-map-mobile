import * as AppleAuthentication from 'expo-apple-authentication';
import { StyleSheet, useColorScheme } from 'react-native';

export interface AppleSignInButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

/** Apple 官方按鈕（HIG 規定外觀）；只在 iOS 顯示（`useAuthFlow.showApple`）。 */
export default function AppleSignInButton({ onPress, disabled = false }: AppleSignInButtonProps) {
  const dark = useColorScheme() === 'dark';
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={12}
      style={[styles.button, disabled && styles.disabled]}
      onPress={disabled ? () => {} : onPress}
    />
  );
}

const styles = StyleSheet.create({
  button: { height: 48, width: '100%' },
  disabled: { opacity: 0.5 },
});
