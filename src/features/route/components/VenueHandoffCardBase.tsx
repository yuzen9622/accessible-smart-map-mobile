import { View } from 'react-native';

import { getAppLanguage, useAppTranslation } from '@/shared/i18n';
import { SHAPE, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Button } from '@/shared/ui';
import { Text } from '@/shared/ui/typography/Text';

import { venueHandoffCopy } from '../domain/venueHandoffCopy';
import type { VenueHandoffCardProps } from './VenueHandoffCard.types';

export default function VenueHandoffCard({ handoff, onContinue }: VenueHandoffCardProps) {
  useAppTranslation();
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  const copy = venueHandoffCopy(getAppLanguage());
  return (
    <View style={{ gap: 8, padding: 16, borderRadius: SHAPE.card, backgroundColor: semantic.surface }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontWeight: '700' }}>{copy.title}</Text>
      <Text selectable style={{ color: colors.text }}>{handoff.destinationName}</Text>
      <Text selectable style={{ color: colors.textSecondary }}>
        {Math.round(handoff.leg.distanceM)} m · {Math.max(1, Math.ceil(handoff.leg.durationS / 60))} {copy.minutes}
      </Text>
      {onContinue ? <Button label={copy.confirm} onPress={onContinue} /> : null}
    </View>
  );
}
