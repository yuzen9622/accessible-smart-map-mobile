/**
 * 火車／高鐵時刻查詢，對應後端 `GET /api/v1/transit/train/timetable`（兩站間）與
 * `/transit/train/station-timetable`（單站發車看板）。兩個查詢都「成功才有資料，
 * 失敗只有錯誤訊息」，型別用 discriminated union 表達，呼叫端不會同時拿到兩者。
 */

export const RAIL_SYSTEMS = ['TRA', 'THSR'] as const;
export type RailSystem = (typeof RAIL_SYSTEMS)[number];

export interface TrainTimetableEntry {
  trainNo: string;
  trainType: string | null;
  departureTime: string;
  arrivalTime: string;
  arrivesNextDay: boolean;
  durationMinutes: number;
}

export interface StationTimetableEntry {
  trainNo: string;
  trainType: string | null;
  direction: number | null;
  destination: string | null;
  departureTime: string;
  arrivalTime: string | null;
}

export interface StationSuggestion {
  name: string;
  stationID: string;
}

export interface TrainTimetable {
  railSystem: RailSystem;
  date: string;
  origin: { name: string; stationID: string };
  destination: { name: string; stationID: string };
  totalCount: number;
  matchedCount: number;
  firstTrain: string | null;
  lastTrain: string | null;
  trains: TrainTimetableEntry[];
  note: string | null;
}

export interface StationTimetable {
  railSystem: RailSystem;
  date: string;
  station: { name: string; stationID: string };
  departAfter: string;
  totalCount: number;
  matchedCount: number;
  firstTrain: string | null;
  lastTrain: string | null;
  trains: StationTimetableEntry[];
  note: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRailSystem(value: unknown): value is RailSystem {
  return typeof value === 'string' && (RAIL_SYSTEMS as readonly string[]).includes(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stationRef(value: unknown): { name: string; stationID: string } | null {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.stationID !== 'string') return null;
  return { name: value.name, stationID: value.stationID };
}

export function parseTrainTimetableEntry(value: unknown): TrainTimetableEntry | null {
  if (!isRecord(value)) return null;
  const { trainNo, departureTime, arrivalTime, durationMinutes } = value;
  if (typeof trainNo !== 'string' || typeof departureTime !== 'string' || typeof arrivalTime !== 'string') return null;
  if (typeof durationMinutes !== 'number') return null;
  return {
    trainNo,
    trainType: stringOrNull(value.trainType),
    departureTime,
    arrivalTime,
    arrivesNextDay: value.arrivesNextDay === true,
    durationMinutes,
  };
}

export function parseStationTimetableEntry(value: unknown): StationTimetableEntry | null {
  if (!isRecord(value)) return null;
  const { trainNo, departureTime } = value;
  if (typeof trainNo !== 'string' || typeof departureTime !== 'string') return null;
  return {
    trainNo,
    trainType: stringOrNull(value.trainType),
    direction: numberOrNull(value.direction),
    destination: stringOrNull(value.destination),
    departureTime,
    arrivalTime: stringOrNull(value.arrivalTime),
  };
}

/** 後端回應解析失敗時回 `null`，呼叫端一律當成查詢失敗處理（跟後端 `{ok:false}` 同一條錯誤路徑）。 */
export function parseTrainTimetable(value: unknown): TrainTimetable | null {
  if (!isRecord(value)) return null;
  const { railSystem, date, totalCount, matchedCount, trains } = value;
  const origin = stationRef(value.origin);
  const destination = stationRef(value.destination);
  if (
    !isRailSystem(railSystem) ||
    typeof date !== 'string' ||
    !origin ||
    !destination ||
    typeof totalCount !== 'number' ||
    typeof matchedCount !== 'number' ||
    !Array.isArray(trains)
  ) {
    return null;
  }
  return {
    railSystem,
    date,
    origin,
    destination,
    totalCount,
    matchedCount,
    firstTrain: stringOrNull(value.firstTrain),
    lastTrain: stringOrNull(value.lastTrain),
    trains: trains.map(parseTrainTimetableEntry).filter((entry): entry is TrainTimetableEntry => entry !== null),
    note: stringOrNull(value.note),
  };
}

export function parseStationSuggestion(value: unknown): StationSuggestion | null {
  if (!isRecord(value)) return null;
  const { name, stationID } = value;
  if (typeof name !== 'string' || typeof stationID !== 'string') return null;
  return { name, stationID };
}

export function parseStationSuggestions(value: unknown): StationSuggestion[] {
  if (!isRecord(value) || !Array.isArray(value.stations)) return [];
  return value.stations
    .map(parseStationSuggestion)
    .filter((entry): entry is StationSuggestion => entry !== null);
}

export function parseStationTimetable(value: unknown): StationTimetable | null {
  if (!isRecord(value)) return null;
  const { railSystem, date, departAfter, totalCount, matchedCount, trains } = value;
  const station = stationRef(value.station);
  if (
    !isRailSystem(railSystem) ||
    typeof date !== 'string' ||
    typeof departAfter !== 'string' ||
    !station ||
    typeof totalCount !== 'number' ||
    typeof matchedCount !== 'number' ||
    !Array.isArray(trains)
  ) {
    return null;
  }
  return {
    railSystem,
    date,
    station,
    departAfter,
    totalCount,
    matchedCount,
    firstTrain: stringOrNull(value.firstTrain),
    lastTrain: stringOrNull(value.lastTrain),
    trains: trains.map(parseStationTimetableEntry).filter((entry): entry is StationTimetableEntry => entry !== null),
    note: stringOrNull(value.note),
  };
}
