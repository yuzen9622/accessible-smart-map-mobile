import { fetchRequest } from '@/shared/api';
import { appStorage } from '@/shared/storage';
import { fetchFacilities, readCachedFacilities } from '../facilities';
import { fetchNearbyParking } from '../parking';
import { toFacilityCollection } from '../../domain/facilities';

jest.mock('@/shared/api', () => ({ fetchRequest: jest.fn() }));
jest.mock('@/shared/i18n', () => ({ getAppLanguage: () => 'zh-TW' }));
const request = jest.mocked(fetchRequest);
const facility = {
  _id: 'a', name: '電梯', displayName: 'Elevator', displaySchoolName: 'School',
  category: 'elevator', source: 'osm', location: { type: 'Point', coordinates: [121.5, 25] },
};

const success = { ok: true, status: 'success' as const, code: 200, message: '' };
beforeEach(() => {
  request.mockReset();
  for (const lang of ['en', 'zh-TW']) appStorage.remove(`cache.facilities.v1.${lang}`);
});

describe('map source names', () => {
  it('sends explicit language, preserves source name, and isolates persisted caches', async () => {
    request.mockResolvedValueOnce({ ...success, data: [facility] });
    const en = await fetchFacilities(undefined, 'en');
    expect(request.mock.calls[0][0]).toContain('&lang=en');
    expect(en[0]).toMatchObject({ id: 'a', name: '電梯', displayName: 'Elevator', displaySchoolName: 'School' });
    expect(readCachedFacilities(Date.now(), 'en')?.facilities[0].displayName).toBe('Elevator');
    expect(readCachedFacilities(Date.now(), 'zh-TW')).toBeNull();
    request.mockResolvedValueOnce({ ...success, data: [{ ...facility, displayName: '電梯' }] });
    await fetchFacilities(undefined, 'zh-TW');
    expect(readCachedFacilities(Date.now(), 'en')?.facilities[0].displayName).toBe('Elevator');
    expect(readCachedFacilities(Date.now(), 'zh-TW')?.facilities[0].displayName).toBe('電梯');
    const features = toFacilityCollection(en, new Set(['elevator'])).features;
    expect(features[0].id).toBe('a');
    expect(features[0].properties.name).toBe('Elevator');
  });

  it('does not persist a response after cancellation', async () => {
    const controller = new AbortController();
    request.mockImplementationOnce(async () => {
      controller.abort();
      return { ...success, data: [facility] };
    });
    await fetchFacilities(controller.signal, 'en');
    expect(readCachedFacilities(Date.now(), 'en')).toBeNull();
  });

  it('preserves parking display fields separately from canonical names and IDs', async () => {
    request.mockResolvedValueOnce({ ...success, data: [{
      type: 'lot', _id: 'p', carParkId: 'source-p', name: '停車場', city: 'Taipei', importedAt: '',
      displayName: 'Parking', displayAddress: 'Address', address: '地址', location: facility.location,
    }] });
    const parking = await fetchNearbyParking({ lat: 25, lng: 121.5 }, undefined, 'en');
    expect(request.mock.calls[0][0]).toContain('&lang=en');
    expect(parking[0]).toMatchObject({ _id: 'p', name: '停車場', displayName: 'Parking', displayAddress: 'Address' });
  });
});
