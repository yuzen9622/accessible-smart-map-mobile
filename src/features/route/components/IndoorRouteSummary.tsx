import { StyleSheet, View } from 'react-native';

import { formatDistance } from '@/shared/geo';
import { getAppLanguage, useAppTranslation } from '@/shared/i18n';
import { ICON_SIZE, SHAPE, TYPE, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';
import PressableScale from '@/shared/ui/PressableScale';
import { Text } from '@/shared/ui/typography/Text';
import type { VenueRoute } from '@/shared/venue';

import { localizedDuration, type Translate } from '../domain/routeCard';
import { ROUTE_ON_ACCENT_COLOR, routeStyles } from './palette';

interface IndoorRouteSummaryProps {
  route: VenueRoute;
  showSteps?: boolean;
  onStartNavigation: () => void;
  onOpenDetail?: () => void;
}

export default function IndoorRouteSummary({ route, showSteps = false, onStartNavigation, onOpenDetail }: IndoorRouteSummaryProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  const language = getAppLanguage();
  const floors = [...new Set(route.path.levelRefs.filter((level) => level !== null))];
  const duration = localizedDuration(Math.max(1, Math.ceil(route.durationS / 60)), t as Translate);

  return <View style={[routeStyles.card, { backgroundColor: semantic.surface }]}>
    <View style={styles.summary}>
      <Text accessibilityRole="header" style={[styles.duration, { color: colors.text }]}>{duration}</Text>
      <Text style={[routeStyles.bodyText, { color: colors.textSecondary }]}>{formatDistance(route.distanceM)}</Text>
    </View>
    {floors.length > 0 ? <View style={routeStyles.row}>
      <Icon name="cuboid" size={ICON_SIZE.body} color={semantic.accent} />
      <Text style={[routeStyles.bodyText, routeStyles.flex, { color: colors.text }]}>{floors.join(' · ')}</Text>
    </View> : null}
    {route.stairFlights > 0 ? <Text style={[routeStyles.bodyText, { color: semantic.warn.fg }]}>
      {language === 'en' ? 'Includes stairs' : '路線包含樓梯'}
    </Text> : null}
    {showSteps ? <View style={routeStyles.section}>
      {route.steps.map((step, index) => <View key={`${index}-${step.pathStart}`} style={[routeStyles.listRow, { borderBottomColor: semantic.separator }]}>
        <Text style={[styles.number, { color: semantic.accent }]}>{index + 1}</Text>
        <Text selectable style={[routeStyles.bodyText, routeStyles.flex, { color: colors.text }]}>{step.instruction}</Text>
      </View>)}
    </View> : null}
    <View style={styles.actions}>
      <PressableScale accessibilityRole="button" accessibilityLabel={t('startNav')} onPress={onStartNavigation} style={[routeStyles.primaryButton, routeStyles.flex]}>
        <Icon name="navigation" size={ICON_SIZE.body} color={ROUTE_ON_ACCENT_COLOR} />
        <Text style={routeStyles.primaryButtonText}>{t('startNav')}</Text>
      </PressableScale>
      {onOpenDetail ? <PressableScale accessibilityRole="button" accessibilityLabel={t('nativeRouteDetails')} onPress={onOpenDetail}
        style={[styles.detailButton, { borderColor: semantic.separator }]}>
        <Text style={[routeStyles.bodyText, { color: semantic.accent }]}>{t('nativeRouteDetails')}</Text>
      </PressableScale> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 12 },
  duration: { fontSize: TYPE.title1, fontWeight: '700' },
  number: { minWidth: 24, fontSize: TYPE.subhead, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 8, marginTop: 8 },
  detailButton: { minHeight: 50, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: SHAPE.pill },
});
