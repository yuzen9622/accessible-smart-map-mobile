import { Platform, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { Text } from './Text';

const NUMERAL_STYLE: TextStyle = Platform.select<TextStyle>({
  ios: { fontFamily: 'ui-rounded', fontVariant: ['tabular-nums'], fontWeight: '700' },
  default: { fontVariant: ['tabular-nums'], fontWeight: '700' },
});

/** 時間、分鐘數、距離、車次號的品牌圓體數字。 */
export function Numeral({ style, ...props }: TextProps & { style?: StyleProp<TextStyle> }) {
  return <Text {...props} style={[NUMERAL_STYLE, style]} />;
}
