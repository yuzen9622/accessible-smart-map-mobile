import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { createElement } from 'react';
import { mapCamera } from '@/features/map';
import { createVenueDetail } from '@/features/indoor/domain/fixtures/venueFixture';
import { fetchRequest } from '@/shared/api';

import { toVenuePlaceDetail } from '../../domain/venuePlace';
import PlaceDetailView from '../../components/PlaceDetailView';
import type { PlaceDetail, PlaceResult } from '../../types/place';
import { usePlaceDetailViewModel } from '../usePlaceDetailViewModel';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('@/features/map', () => ({
  mapCamera: { flyTo: jest.fn() },
  useUserLocationStore: () => null,
  formatDistance: jest.requireActual('@/shared/geo').formatDistance,
  FACILITY_COLORS: { elevator: '#111111', ramp: '#222222', toilet: '#333333' },
}));
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), fetchRequest: jest.fn() }));
jest.mock('@/shared/config', () => ({ getAppConfig: () => ({ shareBaseUrl: 'https://map.example.com' }) }));
jest.mock('@/shared/i18n', () => ({
  useAppTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      const translations: Record<string, unknown> = jest.requireActual('@/shared/i18n/locale/zh-TW/translation.json');
      let value = typeof translations[key] === 'string' ? String(translations[key]) : key;
      for (const [name, replacement] of Object.entries(values ?? {})) value = value.replace(`{{${name}}}`, String(replacement));
      return value;
    },
    i18n: { language: 'zh-TW' },
  }),
}));
jest.mock('../useReviews', () => ({
  useReviews: () => ({ reviews: [], summary: null, totalCount: 0, loading: false, hasMore: false, loadMore: jest.fn() }),
}));

function entry(overrides: Partial<PlaceResult> = {}): PlaceDetail {
  return {
    kind: 'place',
    position: { lat: 25.033, lng: 121.5654 },
    place: {
      id: 'google:ChIJ-selected-place',
      source: 'google',
      name: '台北 101 & 商場',
      fullAddress: '臺北市信義區信義路五段7號',
      addressComponents: { road: null, district: null, city: null, postcode: null },
      location: { type: 'Point', coordinates: [121.5654, 25.033] },
      placeClass: null,
      placeType: null,
      typeLabel: null,
      distanceMeters: null,
      rating: null,
      accessibility: { status: 'unknown', wheelchair: null, nearbyFacilityCount: 0, source: 'none' },
      nearbyFacilities: { toilets: [], metro: [] },
      reviewKey: { placeId: 'ChIJ-selected-place', placeType: 'google' },
      externalLinks: { osm: null, google: 'https://www.google.com/maps/place/?q=place_id:ChIJ-selected-place' },
      attribution: null,
      ...overrides,
    },
  };
}

beforeEach(() => jest.resetAllMocks());

it('shows nearby campus facilities and checklist from the same bounds query', async () => {
  jest.mocked(fetchRequest).mockResolvedValue({
    ok: true,
    data: {
      nearbyBathroom: [],
      nearbyMetroA11y: [
        { facUid: 'toilet-1', facType: 'accessible_toilet', facTypeLabel: '無障礙廁所', '出入口電梯/無障礙坡道名稱': '無障礙廁所', distanceMeters: 12.4 },
        { facUid: 'ramp-1', facType: 'ramp', facTypeLabel: '無障礙坡道', '出入口電梯/無障礙坡道名稱': '無障礙坡道', distanceMeters: 180 },
      ],
      summary: { elevator: { count: 12, nearestMeters: 38 }, ramp: { count: 22, nearestMeters: 15 }, toilet: { count: 38, nearestMeters: 12 } },
    },
  } as Awaited<ReturnType<typeof fetchRequest>>);
  const campus = entry({ name: '國立臺中科技大學', location: { type: 'Point', coordinates: [120.6837712, 24.1497433] }, bounds: [120.6825, 24.1483, 120.6852, 24.1511] });
  if (campus.kind !== 'place') throw new Error('expected place');
  campus.position = { lat: 24.1497433, lng: 120.6837712 };
  const { result } = await renderHook(() => usePlaceDetailViewModel(campus));
  await waitFor(() => expect(result.current.nearbyRows).toHaveLength(2));
  expect(fetchRequest).toHaveBeenCalledTimes(1);
  const query = new URLSearchParams(String(jest.mocked(fetchRequest).mock.calls[0][0]).split('?')[1]);
  expect(query.get('lat')).toBe('24.1497433');
  expect(query.get('lng')).toBe('120.6837712');
  expect(query.get('bbox')).toBe('120.6825,24.1483,120.6852,24.1511');
  expect(result.current.nearbyRows.map(({ name, kind, distanceText }) => ({ name, kind, distanceText }))).toEqual([
    { name: '無障礙廁所', kind: 'toilet', distanceText: '10 m' },
    { name: '無障礙坡道', kind: 'ramp', distanceText: '180 m' },
  ]);
  expect(result.current.checklist.filter((row) => row.key !== 'wheelchair').map((row) => row.tone)).toEqual(['yes', 'yes', 'yes']);
});

it('renders the actual NUTC response through the query, model and detail view', async () => {
  // 固定使用 2026-10-31 正式 API 回應的前三筆；只替換 HTTP 傳輸。
  jest.mocked(fetchRequest).mockResolvedValue({ ok: true, data: {
    nearbyBathroom: [],
    nearbyMetroA11y: [
      { '項次': '83ad0a97-23cb-45e0-98aa-17ace73f6379', '出入口電梯/無障礙坡道名稱': '無障礙廁所', displayName: '國立臺中科技大學／三民校區 · 資訊大樓 · 2F · 無障礙廁所', source: 'campus', facUid: '83ad0a97-23cb-45e0-98aa-17ace73f6379', facType: 'accessible_toilet', facTypeLabel: '無障礙廁所', distanceMeters: 12.400803586189795 },
      { '項次': 'aed1f48e-de03-41b3-9454-0d642d3f83a7', '出入口電梯/無障礙坡道名稱': '無障礙坡道', displayName: '國立臺中科技大學／三民校區 · 資訊大樓 · 1F · 無障礙坡道', source: 'campus', facUid: 'aed1f48e-de03-41b3-9454-0d642d3f83a7', facType: 'outdoor_path', facTypeLabel: '室外通路', distanceMeters: 13.869296435740827 },
      { '項次': '2fbd9709-ea38-4919-9655-c38e16f3e65f', '出入口電梯/無障礙坡道名稱': '無障礙坡道', displayName: '國立臺中科技大學／三民校區 · 資訊大樓 · 1F · 無障礙坡道', source: 'campus', facUid: '2fbd9709-ea38-4919-9655-c38e16f3e65f', facType: 'ramp', facTypeLabel: '無障礙坡道', distanceMeters: 15.150520565632002 },
    ],
    summary: { elevator: { count: 12, nearestMeters: 38 }, ramp: { count: 22, nearestMeters: 15 }, toilet: { count: 38, nearestMeters: 12 } },
  } } as Awaited<ReturnType<typeof fetchRequest>>);
  const campus = entry({
    name: '國立臺中科技大學',
    location: { type: 'Point', coordinates: [120.6837712, 24.1497433] },
    bounds: [120.68253536970852, 24.148353719708492, 120.6852333302915, 24.1510516802915],
    accessibility: { status: 'accessible', wheelchair: 'yes', nearbyFacilityCount: 10, source: 'google' },
  });
  if (campus.kind !== 'place') throw new Error('expected place');
  campus.position = { lat: 24.1497433, lng: 120.6837712 };
  const { result } = await renderHook(() => usePlaceDetailViewModel(campus));
  await waitFor(() => expect(result.current.nearbyRows).toHaveLength(3));
  expect(fetchRequest).toHaveBeenCalledTimes(1);
  const query = new URLSearchParams(String(jest.mocked(fetchRequest).mock.calls[0][0]).split('?')[1]);
  expect(query.get('bbox')).toBe('120.68253536970852,24.148353719708492,120.6852333302915,24.1510516802915');

  const view = await render(createElement(PlaceDetailView, { model: result.current }));
  expect(view.getByText('附近無障礙設施')).toBeTruthy();
  expect(view.getByText('國立臺中科技大學／三民校區 · 資訊大樓 · 2F · 無障礙廁所')).toBeTruthy();
  expect(view.getAllByText('國立臺中科技大學／三民校區 · 資訊大樓 · 1F · 無障礙坡道')).toHaveLength(2);
  expect(view.getByText('無障礙廁所')).toBeTruthy();
  expect(view.getByText('室外通路')).toBeTruthy();
  expect(view.getByText('無障礙坡道')).toBeTruthy();
  expect(view.getAllByText('10 m')).toHaveLength(2);
  expect(view.getByText('20 m')).toBeTruthy();
  expect(view.getByLabelText('有電梯：有')).toBeTruthy();
  expect(view.getByLabelText('有坡道：有')).toBeTruthy();
  expect(view.getByLabelText('有無障礙廁所：有')).toBeTruthy();
  expect(view.queryByText('附近暫無無障礙設施資料')).toBeNull();
});

it('does not request nearby facilities for a coordinate without place bounds', async () => {
  const coordinate: PlaceDetail = { kind: 'coordinate', address: 'clicked', position: { lat: 24.15, lng: 120.68 } };
  const { result } = await renderHook(() => usePlaceDetailViewModel(coordinate));
  expect(fetchRequest).not.toHaveBeenCalled();
  expect(result.current.nearbyRows).toEqual([]);
});

it.each([
  ['missing', undefined], ['null', null], ['inverted', [120.7, 24.1, 120.6, 24.2]],
  ['non-finite', [120.6, 24.1, Number.NaN, 24.2]], ['degenerate', [120.6, 24.1, 120.6, 24.2]],
] as const)('does not request nearby facilities for %s bounds', async (_label, bounds) => {
  const placeBounds = bounds ? [...bounds] as PlaceResult['bounds'] : bounds;
  const { result } = await renderHook(() => usePlaceDetailViewModel(entry({ bounds: placeBounds })));
  expect(fetchRequest).not.toHaveBeenCalled();
  expect(result.current.nearbyRows).toEqual([]);
  expect(result.current.checklist.filter((row) => row.key !== 'wheelchair').map((row) => row.tone)).toEqual(['unknown', 'unknown', 'unknown']);
});

it('does not show a previous place when its request finishes after a place change', async () => {
  let resolveOld: (value: Awaited<ReturnType<typeof fetchRequest>>) => void = () => {};
  jest.mocked(fetchRequest).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValueOnce({ ok: true, data: { nearbyBathroom: [{ _id: 'new', name: '新地點廁所' }], nearbyMetroA11y: [] } } as Awaited<ReturnType<typeof fetchRequest>>);
  const first = entry({ bounds: [121.5, 25, 121.6, 25.1] });
  const second = entry({ location: { type: 'Point', coordinates: [120.68, 24.15] }, bounds: [120.6, 24.1, 120.7, 24.2] });
  if (second.kind !== 'place') throw new Error('expected place');
  second.position = { lat: 24.15, lng: 120.68 };
  const { result, rerender } = await renderHook(({ selected }: { selected: PlaceDetail }) => usePlaceDetailViewModel(selected), { initialProps: { selected: first } });
  await waitFor(() => expect(fetchRequest).toHaveBeenCalledTimes(1));
  const firstSignal = jest.mocked(fetchRequest).mock.calls[0][1]?.signal;
  await rerender({ selected: second });
  expect(firstSignal?.aborted).toBe(true);
  await waitFor(() => expect(result.current.nearbyRows[0]?.name).toBe('新地點廁所'));
  await act(() => resolveOld({ ok: true, data: { nearbyBathroom: [{ _id: 'old', name: '舊地點廁所' }], nearbyMetroA11y: [] } } as Awaited<ReturnType<typeof fetchRequest>>));
  expect(result.current.nearbyRows.map((row) => row.name)).toEqual(['新地點廁所']);
});

it('clears the prior result and does not query 150 metres when switching to a place without bounds', async () => {
  jest.mocked(fetchRequest).mockResolvedValue({ ok: true, data: {
    nearbyBathroom: [{ _id: 'old', name: '舊地點廁所' }], nearbyMetroA11y: [],
  } } as Awaited<ReturnType<typeof fetchRequest>>);
  const first = entry({ bounds: [121.5, 25, 121.6, 25.1] });
  const second = entry({ bounds: null });
  const { result, rerender } = await renderHook(({ selected }: { selected: PlaceDetail }) => usePlaceDetailViewModel(selected), { initialProps: { selected: first } });
  await waitFor(() => expect(result.current.nearbyRows[0]?.name).toBe('舊地點廁所'));
  await rerender({ selected: second });
  expect(result.current.nearbyRows).toEqual([]);
  expect(fetchRequest).toHaveBeenCalledTimes(1);
});

it('opens the CCTV sheet with the place coordinates', async () => {
  const { result } = await renderHook(() => usePlaceDetailViewModel(entry()));
  await act(() => result.current.onOpenCctv());
  expect(router.navigate).toHaveBeenCalledWith({
    pathname: '/cctv/[coords]',
    params: { coords: '25.033,121.5654' },
  });
});

it('plans from a room or to a room using its identity without replacing the indoor camera', async () => {
  const detail = createVenueDetail();
  const room = toVenuePlaceDetail(detail, detail.places[1]);
  const { result } = await renderHook(() => usePlaceDetailViewModel(room));
  expect(result.current.title).toBe('終點空間');
  expect(result.current.subtitle).toBe('測試館・2F');
  expect(result.current.venue?.warnings).toContain('門位尚未確認，導引抵達空間前公共走道。');
  expect(result.current.checklist).toEqual([]);
  expect(result.current.reviews).toBeNull();
  expect(fetchRequest).not.toHaveBeenCalled();
  expect(mapCamera.flyTo).not.toHaveBeenCalled();
  await act(() => result.current.onPlanRoute());
  expect(router.navigate).toHaveBeenLastCalledWith({ pathname: '/plan', params: { venueId: 'test-venue', venuePlaceId: 'end', venueField: 'destination' } });
  await act(() => result.current.venue?.onSetOrigin());
  expect(router.navigate).toHaveBeenLastCalledWith({ pathname: '/plan', params: { venueId: 'test-venue', venuePlaceId: 'end', venueField: 'origin' } });
});
