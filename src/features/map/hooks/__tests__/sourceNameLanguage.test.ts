import { act, renderHook } from '@testing-library/react-native';
import { fetchRequest, type ApiResponse } from '@/shared/api';
import { appStorage } from '@/shared/storage';
import { useFacilitiesLoader } from '../useFacilitiesLoader';
import { useNearbyParking } from '../useNearbyParking';
import { useFacilityStore } from '../../store/facilityStore';
import { useParkingStore } from '../../store/parkingStore';

let mockLanguage = 'zh-TW';
jest.mock('@/shared/i18n', () => ({
  useAppTranslation: () => ({ i18n: { language: mockLanguage } }),
  getAppLanguage: () => mockLanguage,
}));
jest.mock('@/shared/api', () => ({ fetchRequest: jest.fn() }));
jest.mock('../useFetchLocation', () => {
  const point = { lat: 25, lng: 121.5 };
  return { useFetchLocation: () => point };
});
const request = jest.mocked(fetchRequest);
const success = { ok: true, status: 'success' as const, code: 200, message: '' };
const location = { type: 'Point', coordinates: [121.5, 25] };
const facility = (displayName: string) => ({ _id: 'a', name: '電梯', displayName, category: 'elevator', source: 'osm', location });
const parking = (displayName: string) => ({ type: 'lot', _id: 'p', carParkId: 'p', name: '停車場', displayName, city: 'Taipei', importedAt: '', location });

beforeEach(() => {
  mockLanguage = 'zh-TW'; request.mockReset();
  for (const lang of ['en', 'zh-TW']) appStorage.remove(`cache.facilities.v1.${lang}`);
  useFacilityStore.setState({ facilities: null, loadError: null });
  useParkingStore.setState({ items: null });
});

it('ignores delayed old-language facilities even when transport ignores abort', async () => {
  let resolveOld!: (value: ApiResponse<unknown>) => void;
  request.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const hook = await renderHook(() => useFacilitiesLoader());
  request.mockResolvedValueOnce({ ...success, data: [facility('Elevator')] });
  mockLanguage = 'en';
  await hook.rerender({});
  expect(useFacilityStore.getState().facilities?.[0].displayName).toBe('Elevator');
  await act(async () => resolveOld({ ...success, data: [facility('電梯')] }));
  expect(useFacilityStore.getState().facilities?.[0]).toMatchObject({ id: 'a', name: '電梯', displayName: 'Elevator' });
  expect(request.mock.calls.map(([url]) => String(url).split('lang=')[1])).toEqual(['zh-TW', 'en']);
  await hook.unmount();
});

it('ignores delayed old-language parking and clears old names on a language refresh', async () => {
  let resolveOld!: (value: ApiResponse<unknown>) => void;
  request.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const hook = await renderHook(() => useNearbyParking());
  request.mockResolvedValueOnce({ ...success, data: [parking('Parking')] });
  mockLanguage = 'en';
  await hook.rerender({});
  expect(useParkingStore.getState().items?.[0].displayName).toBe('Parking');
  await act(async () => resolveOld({ ...success, data: [parking('停車場')] }));
  expect(useParkingStore.getState().items?.[0]).toMatchObject({ _id: 'p', displayName: 'Parking' });
  await hook.unmount();
});
