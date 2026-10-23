import type { ComponentProps } from 'react';
import { Platform, type TextStyle } from 'react-native';

import { Text } from './Text';

const NUMERAL_STYLE: TextStyle = Platform.select<TextStyle>({
  ios: { fontFamily: 'ui-rounded', fontVariant: ['tabular-nums'], fontWeight: '700' },
  default: { fontVariant: ['tabular-nums'], fontWeight: '700' },
});

/** 時間、分鐘數、距離、車次號的品牌圓體數字（沿用 `Text` 的字級倍率與 `fixedSize`）。 */
export function Numeral({ style, ...props }: ComponentProps<typeof Text>) {
  return <Text {...props} style={[NUMERAL_STYLE, style]} />;
}
