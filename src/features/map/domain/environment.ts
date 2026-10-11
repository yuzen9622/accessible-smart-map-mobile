/**
 * 出發前環境資訊（天氣＋空氣品質）：後端 `/api/v1/a11y/environment` 聚合 CWA 天氣與
 * 環境部 PM2.5，各來源各自降級（一個失敗不影響另一個）。像 Google 地圖左上角那張
 * 溫度＋AQI 小卡片（測試人員回饋 2026-10-11）。
 */

export type EnvironmentStatus = 'ok' | 'unavailable';

export interface WeatherInfo {
  status: EnvironmentStatus;
  temperature: number | null;
  precipitationProbability: number | null;
  condition: string | null;
}

export interface AirQualityInfo {
  status: EnvironmentStatus;
  pm25: number | null;
  quality: string | null;
  advice: string | null;
}

export interface EnvironmentInfo {
  weather: WeatherInfo;
  airQuality: AirQualityInfo;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStatus(value: unknown): value is EnvironmentStatus {
  return value === 'ok' || value === 'unavailable';
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parseWeather(value: unknown): WeatherInfo {
  if (!isRecord(value) || !isStatus(value.status)) {
    return { status: 'unavailable', temperature: null, precipitationProbability: null, condition: null };
  }
  return {
    status: value.status,
    temperature: numberOrNull(value.temperature),
    precipitationProbability: numberOrNull(value.precipitationProbability),
    condition: stringOrNull(value.condition),
  };
}

function parseAirQuality(value: unknown): AirQualityInfo {
  if (!isRecord(value) || !isStatus(value.status)) {
    return { status: 'unavailable', pm25: null, quality: null, advice: null };
  }
  return {
    status: value.status,
    pm25: numberOrNull(value.pm25),
    quality: stringOrNull(value.quality),
    advice: stringOrNull(value.advice),
  };
}

/** 後端回應解析失敗（改版、網路層回了非預期內容）時回傳兩個 block 都是 `unavailable`，
 * 呼叫端不需要另外判斷「parse 失敗」跟「資料來源降級」兩種情況。 */
export function parseEnvironment(data: unknown): EnvironmentInfo {
  if (!isRecord(data)) {
    return { weather: parseWeather(undefined), airQuality: parseAirQuality(undefined) };
  }
  return { weather: parseWeather(data.weather), airQuality: parseAirQuality(data.airQuality) };
}
