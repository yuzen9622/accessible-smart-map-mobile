import { View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors, ICON_SIZE } from '@/shared/theme';
import { Icon } from '@/shared/ui';
import { Text } from '@/shared/ui/typography/Text';

import { routeStyles } from './palette';

/**
 * 路線與設施資訊僅供參考的安全提示（App Store 1.4.1）。路線給輪椅與視障使用者照著走，
 * 資料來源（TDX、OSM、群眾回報）可能過時，要提醒以現場實際狀況為準。
 */
export default function RouteSafetyNotice() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  return (
    <View accessible style={routeStyles.row}>
      <Icon name="info" size={ICON_SIZE.body} color={colors.textSecondary} />
      <Text style={[routeStyles.metaText, routeStyles.flex, { color: colors.textSecondary }]}>{t('nativeRouteSafetyNotice')}</Text>
    </View>
  );
}
