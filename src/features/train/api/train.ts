import { fetchRequest } from '@/shared/api';

import {
  parseStationSuggestions,
  parseStationTimetable,
  parseTrainTimetable,
  type RailSystem,
  type StationSuggestion,
  type StationTimetable,
  type TrainTimetable,
} from '../domain/train';

const TIMETABLE_PATH = '/api/v1/transit/train/timetable';
const STATION_TIMETABLE_PATH = '/api/v1/transit/train/station-timetable';
const STATIONS_PATH = '/api/v1/transit/train/stations';

export interface TrainTimetableParams {
  originStation: string;
  destinationStation: string;
  railSystem?: RailSystem;
  date?: string;
  departAfter?: string;
  arriveBy?: string;
}

export interface StationTimetableParams {
  station: string;
  railSystem?: RailSystem;
  date?: string;
  departAfter?: string;
}

export interface StationSuggestParams {
  query?: string;
  railSystem?: RailSystem;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, value);
  }
  return query.toString();
}

/** 失敗時 `fetchRequest` 會拋 `ApiError`（後端用 400 帶錯誤訊息，如「起訖站相同」），呼叫端自行 catch。 */
export async function fetchTrainTimetable(
  params: TrainTimetableParams,
  signal?: AbortSignal,
): Promise<TrainTimetable> {
  const query = buildQuery({
    originStation: params.originStation,
    destinationStation: params.destinationStation,
    railSystem: params.railSystem,
    date: params.date,
    departAfter: params.departAfter,
    arriveBy: params.arriveBy,
  });
  const response = await fetchRequest(`${TIMETABLE_PATH}?${query}`, { signal });
  const result = parseTrainTimetable(response.data);
  if (!result) throw new Error('Unexpected train timetable response shape');
  return result;
}

export async function fetchStationTimetable(
  params: StationTimetableParams,
  signal?: AbortSignal,
): Promise<StationTimetable> {
  const query = buildQuery({
    station: params.station,
    railSystem: params.railSystem,
    date: params.date,
    departAfter: params.departAfter,
  });
  const response = await fetchRequest(`${STATION_TIMETABLE_PATH}?${query}`, { signal });
  const result = parseStationTimetable(response.data);
  if (!result) throw new Error('Unexpected station timetable response shape');
  return result;
}

export async function fetchStationSuggestions(
  params: StationSuggestParams,
  signal?: AbortSignal,
): Promise<StationSuggestion[]> {
  const query = buildQuery({ query: params.query, railSystem: params.railSystem });
  const response = await fetchRequest(`${STATIONS_PATH}?${query}`, { signal });
  return parseStationSuggestions(response.data);
}
