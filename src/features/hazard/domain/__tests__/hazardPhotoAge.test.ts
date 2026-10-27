import { getHazardPhotoCapturedAt, MAX_REPORT_PHOTO_AGE_MS, validateHazardPhotoAge } from '../hazardPhotoAge';

describe('hazard photo capture time', () => {
  it('interprets EXIF without an offset in the device local timezone', () => {
    expect(getHazardPhotoCapturedAt({ DateTimeOriginal: '2026:10:27 09:50:00' }))
      .toBe(new Date(2026, 9, 27, 9, 50, 0).getTime());
  });

  it.each([
    ['+08:00', '2026-10-27T01:50:00Z'],
    ['-05:30', '2026-10-27T15:20:00Z'],
    ['Z', '2026-10-27T09:50:00Z'],
    ['+00:00', '2026-10-27T09:50:00Z'],
  ])('honors the original timezone offset %s', (offset, expected) => {
    expect(getHazardPhotoCapturedAt({ DateTimeOriginal: '2026:10:27 09:50:00', OffsetTimeOriginal: offset }))
      .toBe(Date.parse(expected));
  });

  it('accepts a leap day', () => {
    expect(getHazardPhotoCapturedAt({ DateTimeOriginal: '2024:02:29 23:59:59', OffsetTimeOriginal: 'Z' }))
      .toBe(Date.parse('2024-02-29T23:59:59Z'));
  });

  it.each([
    '2026:02:29 09:50:00', '2026:04:31 09:50:00', '0000:10:27 09:50:00',
    '2026:00:27 09:50:00', '2026:13:27 09:50:00', '2026:10:00 09:50:00',
    '2026:10:27 24:00:00', '2026:10:27 09:60:00', '2026:10:27 09:50:60',
    '2026-10-27T09:50:00Z', 'not a date', '',
  ])('rejects invalid dates without normalizing them: %s', (value) => {
    expect(getHazardPhotoCapturedAt({ DateTimeOriginal: value })).toBeNull();
    expect(getHazardPhotoCapturedAt({ DateTimeOriginal: value, OffsetTimeOriginal: 'Z' })).toBeNull();
  });

  it.each(['+24:00', '+08:60', '+0800', 'UTC', '', null, 8])('rejects invalid offsets: %s', (offset) => {
    expect(getHazardPhotoCapturedAt({ DateTimeOriginal: '2026:10:27 09:50:00', OffsetTimeOriginal: offset })).toBeNull();
  });

  it.each([null, undefined, {}, [], '2026:10:27 09:50:00', { DateTimeOriginal: 123 }])('rejects missing capture metadata: %s', (exif) => {
    expect(getHazardPhotoCapturedAt(exif)).toBeNull();
  });

  it('never substitutes modification or digitization time for a missing capture time', () => {
    expect(getHazardPhotoCapturedAt({ DateTime: '2026:10:27 09:50:00', DateTimeDigitized: '2026:10:27 09:50:00' })).toBeNull();
  });

  it('rejects an old original even when it was edited or digitized recently', () => {
    const capturedAt = getHazardPhotoCapturedAt({
      DateTimeOriginal: '2026:10:26 09:50:00',
      OffsetTimeOriginal: 'Z',
      DateTime: '2026:10:27 09:50:00',
      DateTimeDigitized: '2026:10:27 09:50:00',
    });
    expect(validateHazardPhotoAge(capturedAt, Date.parse('2026-10-27T09:50:00Z')))
      .toEqual({ valid: false, error: 'PHOTO_TOO_OLD' });
  });
});

describe('hazard photo 10-minute age limit', () => {
  const now = Date.parse('2026-10-27T10:00:00Z');

  it.each([0, 1, MAX_REPORT_PHOTO_AGE_MS - 1, MAX_REPORT_PHOTO_AGE_MS])('accepts age %i ms', (age) => {
    expect(validateHazardPhotoAge(now - age, now)).toEqual({ valid: true });
  });

  it('rejects one millisecond past the inclusive limit', () => {
    expect(validateHazardPhotoAge(now - MAX_REPORT_PHOTO_AGE_MS - 1, now))
      .toEqual({ valid: false, error: 'PHOTO_TOO_OLD' });
  });

  it('rejects a photo that expires after selection', () => {
    const capturedAt = now - MAX_REPORT_PHOTO_AGE_MS + 1;
    expect(validateHazardPhotoAge(capturedAt, now)).toEqual({ valid: true });
    expect(validateHazardPhotoAge(capturedAt, now + 2)).toEqual({ valid: false, error: 'PHOTO_TOO_OLD' });
  });

  it('rejects missing capture time', () => {
    expect(validateHazardPhotoAge(null, now)).toEqual({ valid: false, error: 'PHOTO_TIME_UNAVAILABLE' });
  });

  it.each([now + 1, Number.NaN, Infinity, -Infinity])('rejects future or invalid capture time: %s', (capturedAt) => {
    expect(validateHazardPhotoAge(capturedAt, now)).toEqual({ valid: false, error: 'PHOTO_TIME_INVALID' });
  });

  it.each([Number.NaN, Infinity, -Infinity])('rejects an invalid comparison clock: %s', (clock) => {
    expect(validateHazardPhotoAge(now, clock)).toEqual({ valid: false, error: 'PHOTO_TIME_INVALID' });
  });
});
