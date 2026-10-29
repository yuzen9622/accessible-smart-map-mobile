import { ApiError } from '@/shared/api';
import type { LngLat, LngLatZ } from './types';

export function invalidVenueData(): never {
  throw new ApiError('場館資料格式不完整，請重新載入後再試。', 502, 'INVALID_BACKEND_DATA');
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : invalidVenueData();
}
export function text(value: unknown): string {
  return typeof value === 'string' ? value : invalidVenueData();
}
export function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}
export function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : invalidVenueData();
}
export function integer(value: unknown): number {
  const result = number(value);
  return Number.isInteger(result) ? result : invalidVenueData();
}
export function nonnegative(value: unknown): number {
  const result = number(value);
  return result >= 0 ? result : invalidVenueData();
}
export function version(value: unknown): number {
  const result = integer(value);
  return result > 0 ? result : invalidVenueData();
}
export function boolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : invalidVenueData();
}
export function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  return Array.isArray(value) ? value.map((item: unknown) => parse(item)) : invalidVenueData();
}
export function optional<T>(value: unknown, parse: (item: unknown) => T): T | undefined {
  return value === undefined ? undefined : parse(value);
}
export function nullable<T>(value: unknown, parse: (item: unknown) => T): T | null {
  return value === null ? null : parse(value);
}
export function choice<const T extends readonly string[]>(value: unknown, values: T): T[number] {
  return values.find((item) => item === value) ?? invalidVenueData();
}
export function point(value: unknown): LngLat {
  const coordinates = array(value, number);
  if (coordinates.length !== 2) return invalidVenueData();
  const [lng, lat] = coordinates;
  if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return invalidVenueData();
  return [lng, lat];
}
export function point3(value: unknown): LngLatZ {
  const coordinates = array(value, number);
  if (coordinates.length !== 3) return invalidVenueData();
  const [lng, lat, z] = coordinates;
  point([lng, lat]);
  return [lng, lat, z];
}
export function pair<T>(value: unknown, parse: (item: unknown) => T): [T, T] {
  const values = array(value, parse);
  if (values.length !== 2) return invalidVenueData();
  return [values[0], values[1]];
}
export function uniqueIds<T>(values: T[], getId: (value: T) => string | number): void {
  if (new Set(values.map(getId)).size !== values.length) invalidVenueData();
}
