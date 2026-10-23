import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { SPACE, useSemanticColors, useThemeColors, TYPE, SHAPE } from '@/shared/theme';
import { FormButton, FormInput, FormScreen, FormSection, FormSegmented, FormText } from '@/shared/ui';
import { Text } from '@/shared/ui/typography/Text';

import type { StationSuggestion, StationTimetableEntry, TrainTimetableEntry } from '../domain/train';
import type { TrainSearchPanelProps } from './TrainSearchPanel.types';

/**
 * 火車／高鐵時刻查詢（像 Google 地圖查火車班次）：兩站間時刻或單站發車看板，兩個模式共用
 * 一個表單。沒有另外做 iOS SwiftUI 版——跟 `MyReportsPanel`／`HazardDetailPanel` 一樣，
 * 這類資料查詢頁用同一份 RN 版面在兩個平台上就夠（測試人員回饋 2026-10-11：全新功能）。
 */
export default function TrainSearchPanel({ model }: TrainSearchPanelProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const tones = useSemanticColors();

  return (
    <FormScreen>
      <FormSection title={t('nativeTrainModeTitle')}>
        <FormSegmented label={t('nativeTrainModeTitle')} value={model.mode} choices={model.modeChoices} onChange={model.onModeChange} />
      </FormSection>

      <FormSection title={t('nativeTrainRailSystemTitle')}>
        <FormSegmented
          label={t('nativeTrainRailSystemTitle')}
          value={model.railSystem}
          choices={model.railSystemChoices}
          onChange={model.onRailSystemChange}
        />
      </FormSection>

      <FormSection>
        {model.mode === 'od' ? (
          <>
            <FormInput
              label={model.originLabel}
              value={model.originStation}
              onChangeText={model.onOriginStationChange}
              onFocus={model.onOriginStationFocus}
            />
            <StationSuggestionList
              visible={model.activeField === 'origin'}
              suggestions={model.stationSuggestions}
              onSelect={(suggestion) => model.onStationSuggestionSelect('origin', suggestion)}
              colors={colors}
              accent={tones.accent}
            />
            <FormInput
              label={model.destinationLabel}
              value={model.destinationStation}
              onChangeText={model.onDestinationStationChange}
              onFocus={model.onDestinationStationFocus}
            />
            <StationSuggestionList
              visible={model.activeField === 'destination'}
              suggestions={model.stationSuggestions}
              onSelect={(suggestion) => model.onStationSuggestionSelect('destination', suggestion)}
              colors={colors}
              accent={tones.accent}
            />
          </>
        ) : (
          <>
            <FormInput label={model.stationLabel} value={model.station} onChangeText={model.onStationChange} onFocus={model.onStationFocus} />
            <StationSuggestionList
              visible={model.activeField === 'station'}
              suggestions={model.stationSuggestions}
              onSelect={(suggestion) => model.onStationSuggestionSelect('station', suggestion)}
              colors={colors}
              accent={tones.accent}
            />
          </>
        )}
        <FormButton label={model.searchLabel} onPress={model.onSearch} loading={model.loading} disabled={!model.canSearch} />
      </FormSection>

      {model.error ? (
        <FormSection>
          <FormText tone="error">{model.error}</FormText>
        </FormSection>
      ) : null}

      {model.odResult ? (
        <FormSection
          title={t('nativeTrainResultTitle', { origin: model.odResult.origin.name, destination: model.odResult.destination.name })}
          footer={model.odResult.note ?? undefined}>
          {model.odResult.trains.length === 0 ? (
            <FormText tone="secondary">{t('nativeTrainNoResults')}</FormText>
          ) : (
            model.odResult.trains.map((train) => (
              <OdTrainRow key={train.trainNo} train={train} colors={colors} accent={tones.accent} />
            ))
          )}
        </FormSection>
      ) : null}

      {model.stationResult ? (
        <FormSection
          title={t('nativeTrainStationResultTitle', { station: model.stationResult.station.name })}
          footer={model.stationResult.note ?? undefined}>
          {model.stationResult.trains.length === 0 ? (
            <FormText tone="secondary">{t('nativeTrainNoResults')}</FormText>
          ) : (
            model.stationResult.trains.map((train, index) => (
              <StationTrainRow key={`${train.trainNo}-${index}`} train={train} colors={colors} accent={tones.accent} />
            ))
          )}
        </FormSection>
      ) : null}
    </FormScreen>
  );
}

function StationSuggestionList({
  visible,
  suggestions,
  onSelect,
  colors,
  accent,
}: {
  visible: boolean;
  suggestions: StationSuggestion[];
  onSelect: (suggestion: StationSuggestion) => void;
  colors: { text: string; textSecondary: string };
  accent: string;
}) {
  if (!visible || suggestions.length === 0) return null;
  return (
    <View style={[styles.suggestionList, { borderColor: colors.textSecondary + '33' }]}>
      {suggestions.map((suggestion) => (
        <Pressable
          key={suggestion.stationID}
          onPress={() => onSelect(suggestion)}
          style={({ pressed }) => [styles.suggestionRow, pressed && { backgroundColor: colors.textSecondary + '1a' }]}>
          <Text style={{ color: accent, fontSize: TYPE.subhead }}>{suggestion.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function OdTrainRow({
  train,
  colors,
  accent,
}: {
  train: TrainTimetableEntry;
  colors: { text: string; textSecondary: string };
  accent: string;
}) {
  return (
    <View style={[styles.row, { borderColor: colors.textSecondary + '22' }]}>
      <View style={styles.rowMain}>
        <Text style={[styles.trainNo, { color: accent }]}>{train.trainNo}</Text>
        {train.trainType ? <Text style={{ color: colors.textSecondary, fontSize: TYPE.caption }}>{train.trainType}</Text> : null}
      </View>
      <Text style={{ color: colors.text, fontSize: TYPE.subhead }}>
        {train.departureTime} → {train.arrivalTime}
        {train.arrivesNextDay ? '+1' : ''}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: TYPE.footnote }}>{train.durationMinutes} 分</Text>
    </View>
  );
}

function StationTrainRow({
  train,
  colors,
  accent,
}: {
  train: StationTimetableEntry;
  colors: { text: string; textSecondary: string };
  accent: string;
}) {
  return (
    <View style={[styles.row, { borderColor: colors.textSecondary + '22' }]}>
      <View style={styles.rowMain}>
        <Text style={[styles.trainNo, { color: accent }]}>{train.trainNo}</Text>
        {train.trainType ? <Text style={{ color: colors.textSecondary, fontSize: TYPE.caption }}>{train.trainType}</Text> : null}
      </View>
      <Text style={{ color: colors.text, fontSize: TYPE.subhead }}>{train.departureTime}</Text>
      {train.destination ? <Text style={{ color: colors.textSecondary, fontSize: TYPE.footnote }}>{train.destination}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: 48,
    paddingVertical: SPACE.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { width: 64, gap: 2 },
  trainNo: { fontSize: TYPE.subhead, fontWeight: '700' },
  suggestionList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: SHAPE.control, borderCurve: 'continuous',
    marginTop: -SPACE.sm,
    marginBottom: SPACE.sm,
    overflow: 'hidden',
  },
  suggestionRow: {
    minHeight: 40,
    paddingHorizontal: SPACE.sm,
    justifyContent: 'center',
  },
});
