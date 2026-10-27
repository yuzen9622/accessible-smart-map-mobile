import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';

import { pickHazardPhoto } from '../photoPicker';

const mockCamera = jest.fn();
const mockLibrary = jest.fn();
const mockPermission = jest.fn();
const mockSave = jest.fn();
const mockRender = jest.fn();
const mockManipulate = jest.fn();

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: () => mockPermission(),
  launchCameraAsync: (...args: unknown[]) => mockCamera(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLibrary(...args),
}));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: (...args: unknown[]) => mockManipulate(...args) },
  SaveFormat: { JPEG: 'jpeg' },
}));

const capturedAt = new Date(2026, 9, 27, 12, 0, 0).getTime();
let now = capturedAt + 60_000;

function asset(overrides: Partial<ImagePickerAsset> = {}): ImagePickerAsset {
  return {
    uri: 'file:///photo.heic', width: 1200, height: 1600,
    mimeType: 'image/heic', fileSize: 2_000_000,
    exif: { DateTimeOriginal: '2026:10:27 12:00:00' },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'ios');
  now = capturedAt + 60_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  mockPermission.mockResolvedValue({ granted: true });
  mockLibrary.mockResolvedValue({ canceled: false, assets: [asset()] });
  mockCamera.mockResolvedValue({ canceled: false, assets: [asset()] });
  mockSave.mockResolvedValue({ uri: 'file:///compressed.jpg' });
  mockRender.mockResolvedValue({ saveAsync: mockSave });
  mockManipulate.mockReturnValue({ resize: jest.fn(), renderAsync: mockRender });
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('accepts a recent library original, requests EXIF, and needs no full-library permission', async () => {
  expect(await pickHazardPhoto('library')).toEqual({
    kind: 'ok', photo: { uri: 'file:///photo.heic', type: 'image/heic', name: 'hazard.heic', size: 2_000_000, capturedAt },
  });
  expect(mockLibrary).toHaveBeenCalledWith(expect.objectContaining({ exif: true, allowsEditing: false, quality: 1 }));
  expect(mockPermission).not.toHaveBeenCalled();
  expect(mockManipulate).not.toHaveBeenCalled();
});

it.each([
  [null, 'PHOTO_TIME_UNAVAILABLE'],
  [{ DateTime: '2026:10:27 12:01:00' }, 'PHOTO_TIME_UNAVAILABLE'],
  [{ DateTimeOriginal: '2026:10:27 11:50:59' }, 'PHOTO_TOO_OLD'],
  [{ DateTimeOriginal: '2026:10:27 12:01:01' }, 'PHOTO_TIME_INVALID'],
])('rejects invalid library capture metadata before transcoding: %j', async (exif, error) => {
  mockLibrary.mockResolvedValue({ canceled: false, assets: [asset({ exif, fileSize: 8_000_000 })] });
  expect(await pickHazardPhoto('library')).toEqual({ kind: 'invalid', error });
  expect(mockManipulate).not.toHaveBeenCalled();
});

it('preserves original capture time when compressing a recent photo', async () => {
  mockLibrary.mockResolvedValue({ canceled: false, assets: [asset({ fileSize: 8_000_000 })] });
  expect(await pickHazardPhoto('library')).toEqual({
    kind: 'ok', photo: { uri: 'file:///compressed.jpg', type: 'image/jpeg', name: 'hazard.jpg', size: null, capturedAt },
  });
});

it('rejects a photo that expires while being transcoded', async () => {
  mockLibrary.mockResolvedValue({ canceled: false, assets: [asset({ fileSize: 8_000_000 })] });
  mockSave.mockImplementationOnce(async () => {
    now = capturedAt + 600_001;
    return { uri: 'file:///compressed.jpg' };
  });
  expect(await pickHazardPhoto('library')).toEqual({ kind: 'invalid', error: 'PHOTO_TOO_OLD' });
});

it.each(['ios', 'android'] as const)('uses native camera launch time conservatively without EXIF on %s', async (platform) => {
  jest.replaceProperty(Platform, 'OS', platform);
  const startedAt = now;
  mockCamera.mockImplementationOnce(async () => {
    now += 30_000;
    return { canceled: false, assets: [asset({ exif: null })] };
  });
  expect(await pickHazardPhoto('camera')).toMatchObject({ kind: 'ok', photo: { capturedAt: startedAt } });
});

it('does not refresh the age when the camera confirmation remains open for over 10 minutes', async () => {
  mockCamera.mockImplementationOnce(async () => {
    now += 600_001;
    return { canceled: false, assets: [asset({ exif: null })] };
  });
  expect(await pickHazardPhoto('camera')).toEqual({ kind: 'invalid', error: 'PHOTO_TOO_OLD' });
});

it('never replaces an old camera EXIF date with launch time', async () => {
  mockCamera.mockResolvedValue({ canceled: false, assets: [asset({ exif: { DateTimeOriginal: '2020:01:01 12:00:00' } })] });
  expect(await pickHazardPhoto('camera')).toEqual({ kind: 'invalid', error: 'PHOTO_TOO_OLD' });
});

it('does not trust the web camera file chooser without capture metadata', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  mockCamera.mockResolvedValue({ canceled: false, assets: [asset({ exif: null })] });
  expect(await pickHazardPhoto('camera')).toEqual({ kind: 'invalid', error: 'PHOTO_TIME_UNAVAILABLE' });
});

it('returns cancellation and denied camera access without processing photos', async () => {
  mockLibrary.mockResolvedValue({ canceled: true, assets: null });
  expect(await pickHazardPhoto('library')).toEqual({ kind: 'cancelled' });
  mockPermission.mockResolvedValue({ granted: false });
  expect(await pickHazardPhoto('camera')).toEqual({ kind: 'denied' });
  expect(mockCamera).not.toHaveBeenCalled();
  expect(mockManipulate).not.toHaveBeenCalled();
});
