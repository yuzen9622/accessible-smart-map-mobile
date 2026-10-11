import { useEffect, useState } from 'react';

import { ApiError } from '@/shared/api';
import { useAppTranslation } from '@/shared/i18n';

import { fetchStationSuggestions, fetchStationTimetable, fetchTrainTimetable } from '../api/train';
import { RAIL_SYSTEMS, type RailSystem, type StationSuggestion, type StationTimetable, type TrainTimetable } from '../domain/train';

export type TrainSearchMode = 'od' | 'station';
export type TrainStationField = 'origin' | 'destination' | 'station';

export interface TrainSearchViewModel {
  title: string;
  mode: TrainSearchMode;
  modeChoices: { value: TrainSearchMode; label: string }[];
  onModeChange: (mode: TrainSearchMode) => void;
  railSystem: RailSystem;
  railSystemChoices: { value: RailSystem; label: string }[];
  onRailSystemChange: (value: RailSystem) => void;
  originStation: string;
  onOriginStationChange: (value: string) => void;
  onOriginStationFocus: () => void;
  destinationStation: string;
  onDestinationStationChange: (value: string) => void;
  onDestinationStationFocus: () => void;
  station: string;
  onStationChange: (value: string) => void;
  onStationFocus: () => void;
  activeField: TrainStationField | null;
  stationSuggestions: StationSuggestion[];
  onStationSuggestionSelect: (field: TrainStationField, suggestion: StationSuggestion) => void;
  originLabel: string;
  destinationLabel: string;
  stationLabel: string;
  searchLabel: string;
  loading: boolean;
  error: string | null;
  odResult: TrainTimetable | null;
  stationResult: StationTimetable | null;
  onSearch: () => void;
  canSearch: boolean;
}

const RAIL_SYSTEM_LABEL_KEY: Record<RailSystem, string> = {
  TRA: 'nativeTrainRailSystemTra',
  THSR: 'nativeTrainRailSystemThsr',
};

export function useTrainSearchViewModel(): TrainSearchViewModel {
  const { t } = useAppTranslation();
  const [mode, setMode] = useState<TrainSearchMode>('od');
  const [railSystem, setRailSystem] = useState<RailSystem>('TRA');
  const [originStation, setOriginStation] = useState('');
  const [destinationStation, setDestinationStation] = useState('');
  const [station, setStation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [odResult, setOdResult] = useState<TrainTimetable | null>(null);
  const [stationResult, setStationResult] = useState<StationTimetable | null>(null);
  const [activeField, setActiveField] = useState<TrainStationField | null>(null);
  const [stationSuggestions, setStationSuggestions] = useState<StationSuggestion[]>([]);

  useEffect(() => {
    if (!activeField) return;
    const query = activeField === 'origin' ? originStation : activeField === 'destination' ? destinationStation : station;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchStationSuggestions({ query: query.trim() || undefined, railSystem }, controller.signal)
        .then(setStationSuggestions)
        .catch(() => setStationSuggestions([]));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeField, originStation, destinationStation, station, railSystem]);

  const onStationSuggestionSelect = (field: TrainStationField, suggestion: StationSuggestion) => {
    if (field === 'origin') setOriginStation(suggestion.name);
    else if (field === 'destination') setDestinationStation(suggestion.name);
    else setStation(suggestion.name);
    setActiveField(null);
  };

  const canSearch = mode === 'od' ? originStation.trim() !== '' && destinationStation.trim() !== '' : station.trim() !== '';

  const onSearch = () => {
    if (!canSearch || loading) return;
    setLoading(true);
    setError(null);
    const run = async () => {
      try {
        if (mode === 'od') {
          setOdResult(await fetchTrainTimetable({ originStation, destinationStation, railSystem }));
          setStationResult(null);
        } else {
          setStationResult(await fetchStationTimetable({ station, railSystem }));
          setOdResult(null);
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('nativeTrainSearchFailed'));
        setOdResult(null);
        setStationResult(null);
      } finally {
        setLoading(false);
      }
    };
    void run();
  };

  return {
    title: t('nativeTrainSearchTitle'),
    mode,
    modeChoices: [
      { value: 'od', label: t('nativeTrainModeOd') },
      { value: 'station', label: t('nativeTrainModeStation') },
    ],
    onModeChange: setMode,
    railSystem,
    railSystemChoices: RAIL_SYSTEMS.map((system) => ({ value: system, label: t(RAIL_SYSTEM_LABEL_KEY[system]) })),
    onRailSystemChange: setRailSystem,
    originStation,
    onOriginStationChange: setOriginStation,
    onOriginStationFocus: () => setActiveField('origin'),
    destinationStation,
    onDestinationStationChange: setDestinationStation,
    onDestinationStationFocus: () => setActiveField('destination'),
    station,
    onStationChange: setStation,
    onStationFocus: () => setActiveField('station'),
    activeField,
    stationSuggestions,
    onStationSuggestionSelect,
    originLabel: t('nativeTrainOriginLabel'),
    destinationLabel: t('nativeTrainDestinationLabel'),
    stationLabel: t('nativeTrainStationLabel'),
    searchLabel: t('nativeTrainSearchCta'),
    loading,
    error,
    odResult,
    stationResult,
    onSearch,
    canSearch,
  };
}
