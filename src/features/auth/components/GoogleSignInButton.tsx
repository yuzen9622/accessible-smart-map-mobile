import { StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { GOOGLE_SIGN_IN, SHAPE, TYPE } from '@/shared/theme';
import PressableScale from '@/shared/ui/PressableScale';

export interface GoogleSignInButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

/** Google 品牌規範的四色「G」。 */
function GoogleGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessible={false}>
      <Path
        fill={GOOGLE_SIGN_IN.red}
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill={GOOGLE_SIGN_IN.blue}
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill={GOOGLE_SIGN_IN.yellow}
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill={GOOGLE_SIGN_IN.green}
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

/**
 * Google 登入按鈕：白底、彩色 G，尺寸／圓角／字重與 `AppleSignInButton` 對齊（高 48、圓角 12、semibold）。
 * 白底落在白色卡片上會糊掉，所以加一圈細邊框。
 */
export default function GoogleSignInButton({ label, onPress, disabled = false }: GoogleSignInButtonProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}>
      <GoogleGlyph size={20} />
      <Text style={styles.label} numberOfLines={1} allowFontScaling={false}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: SHAPE.authButton,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: GOOGLE_SIGN_IN.border,
    backgroundColor: GOOGLE_SIGN_IN.background,
  },
  label: { fontSize: TYPE.authButton, fontWeight: '600', color: GOOGLE_SIGN_IN.text },
  disabled: { opacity: 0.5 },
});
