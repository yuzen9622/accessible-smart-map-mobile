export const MAX_REPORT_PHOTO_AGE_MS = 10 * 60 * 1000;

export type PhotoAgeValidation =
  | { valid: true }
  | { valid: false; error: 'PHOTO_TIME_UNAVAILABLE' | 'PHOTO_TOO_OLD' | 'PHOTO_TIME_INVALID' };

/** 只使用原始拍攝時間；編輯、匯入或檔案建立時間不能證明照片的新舊。 */
export function getHazardPhotoCapturedAt(exif: unknown): number | null {
  if (typeof exif !== 'object' || exif === null || !('DateTimeOriginal' in exif)) return null;
  if (typeof exif.DateTimeOriginal !== 'string') return null;
  const parts = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(exif.DateTimeOriginal.trim());
  if (!parts) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const hour = Number(parts[4]);
  const minute = Number(parts[5]);
  const second = Number(parts[6]);
  if (year < 1) return null;

  const offset = 'OffsetTimeOriginal' in exif ? exif.OffsetTimeOriginal : undefined;
  let offsetMinutes: number | null = null;
  if (offset !== undefined) {
    if (typeof offset !== 'string') return null;
    if (offset === 'Z') {
      offsetMinutes = 0;
    } else {
      const offsetParts = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
      if (!offsetParts) return null;
      const hours = Number(offsetParts[2]);
      const minutes = Number(offsetParts[3]);
      if (hours > 23 || minutes > 59) return null;
      offsetMinutes = (hours * 60 + minutes) * (offsetParts[1] === '+' ? 1 : -1);
    }
  }

  const date = new Date(0);
  if (offsetMinutes === null) {
    // 沒有時區的 EXIF 是相機本地時間，依裝置目前時區解讀。
    date.setFullYear(year, month - 1, day);
    date.setHours(hour, minute, second, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day
      || date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second) return null;
    return date.getTime();
  }

  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day
    || date.getUTCHours() !== hour || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) return null;
  return date.getTime() - offsetMinutes * 60 * 1000;
}

export function validateHazardPhotoAge(capturedAt: number | null, now: number): PhotoAgeValidation {
  if (capturedAt === null) return { valid: false, error: 'PHOTO_TIME_UNAVAILABLE' };
  if (!Number.isFinite(capturedAt) || !Number.isFinite(now) || capturedAt > now) {
    return { valid: false, error: 'PHOTO_TIME_INVALID' };
  }
  if (now - capturedAt > MAX_REPORT_PHOTO_AGE_MS) return { valid: false, error: 'PHOTO_TOO_OLD' };
  return { valid: true };
}
