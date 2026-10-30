import { ScrollView, StyleSheet, View } from 'react-native';

import { getAppLanguage, useAppTranslation } from '@/shared/i18n';
import { ACCENT_FILL, ICON_SIZE, ON_ACCENT_FILL, SHAPE, TYPE, useSemanticColors, useThemeColors } from '@/shared/theme';
import Icon from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/Icon.types';
import PressableScale from '@/shared/ui/PressableScale';
import { Text } from '@/shared/ui/typography/Text';

import { useIndoorStore } from '../store/indoorStore';
import type { VenueRouteStep } from '../types/venue';

export interface IndoorNavigationContentProps {
  onEnd: () => void;
}

function instructionIcon(step: VenueRouteStep): IconName {
  if (step.type === 'elevator') return 'elevator';
  if (step.type === 'arrive') return 'flag';
  if (step.type === 'depart') return 'navigation';
  if (step.type === 'stairs' || step.type === 'steps' || step.type === 'escalator') return 'arrowUpRight';
  return 'footprints';
}

export default function IndoorNavigationContent({ onEnd }: IndoorNavigationContentProps) {
  const { t } = useAppTranslation();
  const english = getAppLanguage() === 'en';
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  const plan = useIndoorStore((state) => state.plan);
  const guidance = useIndoorStore((state) => state.guidance);
  const route = plan.status === 'ready' ? plan.data : null;
  const currentIndex = guidance.status === 'guiding' ? guidance.stepIndex : guidance.status === 'complete' ? (route?.steps.length ?? 1) - 1 : 0;
  const current = route?.steps[currentIndex];
  const complete = guidance.status === 'complete';
  const confirmLabel = current?.type === 'depart'
    ? english ? 'I am at the start' : '確認已在起點'
    : current?.type === 'arrive'
      ? english ? 'Confirm arrival' : '確認抵達'
      : current?.toLevelRef
        ? english ? `I am on ${current.toLevelRef}` : `已到 ${current.toLevelRef}`
        : english ? 'Step completed' : '已完成這一步';

  return <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
    <View style={styles.header}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {complete ? t('arrived') : route ? t('stepOf', { current: currentIndex + 1, total: route.steps.length }) : t('preparingNav')}
      </Text>
      <PressableScale accessibilityRole="button" accessibilityLabel={t('endNav')} onPress={onEnd} style={styles.end}>
        <Text style={[styles.endText, { color: semantic.accent }]}>{t('endNav')}</Text>
      </PressableScale>
    </View>
    {current ? <View style={[styles.current, { backgroundColor: semantic.surface }]}>
      <View style={styles.instructionRow}>
        <Icon name={complete ? 'circleCheck' : instructionIcon(current)} size={ICON_SIZE.tile} color={semantic.accent} />
        <Text accessibilityLiveRegion="polite" style={[styles.instruction, { color: colors.text }]}>{current.instruction}</Text>
      </View>
      {guidance.status === 'guiding' ? <PressableScale accessibilityRole="button" accessibilityLabel={confirmLabel}
        onPress={() => useIndoorStore.getState().confirmStep()} style={styles.confirm}>
        <Icon name="check" size={ICON_SIZE.control} color={ON_ACCENT_FILL} />
        <Text style={styles.confirmText}>{confirmLabel}</Text>
      </PressableScale> : null}
    </View> : null}
    {route ? <View style={styles.steps}>
      {route.steps.map((step, index) => {
        const active = !complete && guidance.status === 'guiding' && index === currentIndex;
        return <PressableScale key={`${index}-${step.pathStart}`} accessibilityRole="button"
          accessibilityLabel={`${t('stepOf', { current: index + 1, total: route.steps.length })}，${step.instruction}`}
          accessibilityHint={english ? 'View this floor without changing your progress' : '查看此步驟樓層，不會推進導引'}
          accessibilityState={{ selected: active }}
          onPress={() => useIndoorStore.getState().selectFloor({ buildingId: route.path.buildingIds[step.pathStart], levelRef: route.path.levelRefs[step.pathStart] })}
          style={[styles.step, { borderBottomColor: semantic.separator, backgroundColor: active ? semantic.accentSoft : colors.background }]}>
          <Text style={[styles.number, { color: active ? semantic.accent : colors.textSecondary }]}>{index + 1}</Text>
          <Icon name={instructionIcon(step)} size={ICON_SIZE.control} color={active ? semantic.accent : colors.textSecondary} />
          <Text style={[styles.stepText, { color: colors.text }]}>{step.instruction}</Text>
        </PressableScale>;
      })}
    </View> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 16 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: TYPE.headline, fontWeight: '600', flexShrink: 1 },
  end: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  endText: { fontSize: TYPE.callout, fontWeight: '600' },
  current: { padding: 16, gap: 16, borderRadius: SHAPE.card, borderCurve: 'continuous' },
  instructionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  instruction: { flex: 1, fontSize: TYPE.title3, fontWeight: '600' },
  confirm: { minHeight: 50, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ACCENT_FILL, borderRadius: SHAPE.pill },
  confirmText: { color: ON_ACCENT_FILL, flexShrink: 1, fontSize: TYPE.callout, fontWeight: '600', textAlign: 'center' },
  steps: { gap: 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: SHAPE.control },
  number: { minWidth: 22, fontSize: TYPE.footnote, fontWeight: '600', fontVariant: ['tabular-nums'] },
  stepText: { flex: 1, fontSize: TYPE.subhead },
});
