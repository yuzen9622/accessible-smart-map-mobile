import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo, Alert } from 'react-native';

import { flushPromises } from '@/shared/testing/flushPromises';

import type { HazardPhoto } from '../../controller/photoPicker';
import { MAX_REPORT_PHOTO_AGE_MS } from '../../domain/hazardPhotoAge';
import type { HazardReport } from '../../domain/types';
import { useHazardReport } from '../useHazardReport';

const mockPick = jest.fn();
const mockCreate = jest.fn();
jest.mock('../../controller/photoPicker', () => ({ pickHazardPhoto: (...args: unknown[]) => mockPick(...args) }));
jest.mock('../../api/hazardApi', () => ({
  createHazardReport: (...args: unknown[]) => mockCreate(...args),
  uncertainReportId: () => null,
}));
jest.mock('@/features/auth', () => ({ useAuthStore: () => false, selectIsLoggedIn: () => false }));
jest.mock('@/features/map', () => ({ useUserLocationStore: () => null }));
jest.mock('@/features/place', () => ({ reverseGeocodeLabel: async () => '現場位置' }));
jest.mock('@/shared/i18n', () => ({ useAppTranslation: () => ({ t: (key: string) => key, i18n: { language: 'zh-TW' } }) }));
jest.mock('@/shared/navigation', () => ({ useCloseScreen: () => jest.fn() }));
jest.mock('@/shared/privacy', () => ({ ensureAiDataConsent: async () => true }));
jest.mock('@/shared/haptics', () => ({ haptic: { success: jest.fn(), error: jest.fn() } }));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('../../controller/hazardLayerController', () => ({ refreshNearbyHazards: async () => undefined }));
jest.mock('../useMyReports', () => ({ invalidateMyReports: jest.fn() }));

const NOW = Date.parse('2026-10-27T06:00:00Z');
const draft = { lat: 25, lng: 121, description: '入口有障礙物' };
const report: HazardReport = {
  _id: 'report-one', hazardType: 'obstacle', status: 'pending', publicPhotoUrl: null,
  reportedLocation: { type: 'Point', coordinates: [121, 25] },
};
function photo(capturedAt = NOW, uri = 'file:///hazard.jpg'): HazardPhoto {
  return { uri, type: 'image/jpeg', name: 'hazard.jpg', size: 1000, capturedAt };
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  mockPick.mockReset();
  mockCreate.mockReset().mockResolvedValue({ report, merged: false });
});
afterEach(() => jest.restoreAllMocks());

it('submits a recent library photo at the inclusive ten-minute boundary', async () => {
  const selected = photo(NOW - MAX_REPORT_PHOTO_AGE_MS);
  mockPick.mockResolvedValue({ kind: 'ok', photo: selected });
  const { result } = await renderHook(() => useHazardReport(draft));
  await act(async () => { result.current.chooseFromLibrary(); await flushPromises(); });
  expect(mockPick).toHaveBeenCalledWith('library');
  expect(result.current.photo).toEqual(selected);
  expect(result.current.canSubmit).toBe(true);

  await act(async () => { result.current.submit(); await flushPromises(); });
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
    latitude: 25, longitude: 121, description: draft.description,
    photo: { uri: selected.uri, name: selected.name, type: selected.type },
  }));
  expect(result.current.result?.reportId).toBe('report-one');
});

it('blocks a photo that expires in the draft, preserves the draft, and recovers after retaking it', async () => {
  const selected = photo();
  mockPick.mockResolvedValueOnce({ kind: 'ok', photo: selected });
  const { result } = await renderHook(() => useHazardReport(draft));
  await act(async () => { result.current.chooseFromLibrary(); await flushPromises(); });
  const later = NOW + MAX_REPORT_PHOTO_AGE_MS + 1;
  jest.spyOn(Date, 'now').mockReturnValue(later);

  await act(async () => { result.current.submit(); await flushPromises(); });
  expect(mockCreate).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenLastCalledWith('exifTooOld');
  expect(result.current.photo).toEqual(selected);
  expect(result.current.description).toBe(draft.description);
  expect(result.current.submitting).toBe(false);

  const retaken = photo(later, 'file:///retaken.jpg');
  mockPick.mockResolvedValueOnce({ kind: 'ok', photo: retaken });
  await act(async () => { result.current.takePhoto(); await flushPromises(); });
  expect(mockPick).toHaveBeenLastCalledWith('camera');
  await act(async () => { result.current.submit(); await flushPromises(); });
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
    photo: { uri: retaken.uri, name: retaken.name, type: retaken.type },
  }));
  expect(result.current.result?.reportId).toBe('report-one');
});

it.each([
  ['PHOTO_TOO_OLD', 'exifTooOld'],
  ['PHOTO_TIME_UNAVAILABLE', 'nativeHazardPhotoTimeUnavailable'],
  ['PHOTO_TIME_INVALID', 'nativeHazardPhotoTimeInvalid'],
])('explains %s from the picker without replacing the existing photo', async (error, message) => {
  const selected = photo();
  mockPick.mockResolvedValueOnce({ kind: 'ok', photo: selected }).mockResolvedValueOnce({ kind: 'invalid', error });
  const { result } = await renderHook(() => useHazardReport(draft));
  await act(async () => { result.current.chooseFromLibrary(); await flushPromises(); });
  await act(async () => { result.current.chooseFromLibrary(); await flushPromises(); });
  expect(Alert.alert).toHaveBeenLastCalledWith(message);
  expect(result.current.photo).toEqual(selected);
  expect(mockCreate).not.toHaveBeenCalled();
});

it('preserves the existing photo when the user cancels the library picker', async () => {
  const selected = photo();
  mockPick.mockResolvedValueOnce({ kind: 'ok', photo: selected }).mockResolvedValueOnce({ kind: 'cancelled' });
  const { result } = await renderHook(() => useHazardReport(draft));
  await act(async () => { result.current.chooseFromLibrary(); await flushPromises(); });
  await act(async () => { result.current.chooseFromLibrary(); await flushPromises(); });
  expect(result.current.photo).toEqual(selected);
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(mockCreate).not.toHaveBeenCalled();
});
