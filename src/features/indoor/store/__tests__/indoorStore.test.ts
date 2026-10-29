import { loadVenue, loadVenues } from '../../api/venueApi';
import { createVenueDetail, createVenueRoute } from '../../domain/fixtures/venueFixture';
import type { VenueDetail } from '../../types/venue';
import { createIndoorStore } from '../indoorStore';

jest.mock('../../api/venueApi', () => ({ loadVenue: jest.fn(), loadVenues: jest.fn() }));
const detailApi = jest.mocked(loadVenue);

function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error('Promise not initialized'); };
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  detailApi.mockResolvedValue(createVenueDetail());
});

it('瀏覽換層與已確認所在樓層分離，只有確認電梯步驟才換已確認樓層', async () => {
  const store = createIndoorStore();
  await store.getState().adoptRoute(createVenueRoute());
  store.getState().startGuidance();
  store.getState().selectFloor({ buildingId: 'a', levelRef: '2F' });
  expect(store.getState().guidance).toEqual({ status: 'guiding', stepIndex: 0, confirmed: { buildingId: 'a', levelRef: '1F' } });
  store.getState().confirmStep();
  store.getState().confirmStep();
  expect(store.getState().guidance).toMatchObject({ stepIndex: 2, confirmed: { levelRef: '1F' } });
  store.getState().confirmStep();
  expect(store.getState().guidance).toMatchObject({ stepIndex: 3, confirmed: { levelRef: '2F' } });
  store.getState().confirmStep();
  store.getState().confirmStep();
  expect(store.getState().guidance.status).toBe('complete');
  store.getState().endGuidance();
  expect(store.getState().guidance.status).toBe('idle');
});

it('離開場館後，晚到的詳細資料不會重新開啟室內模式', async () => {
  const store = createIndoorStore();
  const pending = deferred<VenueDetail>();
  detailApi.mockReturnValueOnce(pending.promise);
  const request = store.getState().selectVenue('test-venue');
  store.getState().exitVenue();
  pending.resolve(createVenueDetail());
  await request;
  expect(store.getState()).toMatchObject({ active: false, venue: { status: 'idle' } });
});

it('拒絕未知地點及樓層，空場館列表可呈現', async () => {
  const store = createIndoorStore();
  await store.getState().selectVenue('test-venue');
  store.getState().selectPlace('invented');
  store.getState().selectFloor({ buildingId: 'a', levelRef: '99F' });
  expect(store.getState()).toMatchObject({ selectedPlaceId: null, floor: { levelRef: '1F' } });
  jest.mocked(loadVenues).mockResolvedValueOnce([]);
  await store.getState().loadCatalog();
  expect(store.getState().catalog).toEqual({ status: 'ready', data: [] });
});

it('只採用既有規劃結果，載入新版本時拒絕過期路線', async () => {
  const store = createIndoorStore();
  const route = createVenueRoute();
  expect(await store.getState().adoptRoute(route)).toBe(true);
  expect(store.getState().plan).toEqual({ status: 'ready', data: route });
  expect(store.getState().guidance.status).toBe('idle');
  detailApi.mockResolvedValueOnce({ ...createVenueDetail(), version: 4 });
  expect(await store.getState().adoptRoute(route)).toBe(false);
  expect(store.getState().plan.status).toBe('idle');
});

it('並行採用路線時，使用者換場館會作廢舊結果', async () => {
  const store = createIndoorStore();
  const pending = deferred<VenueDetail>();
  detailApi.mockReturnValueOnce(pending.promise);
  const adoption = store.getState().adoptRoute(createVenueRoute());
  await store.getState().selectVenue('test-venue');
  pending.resolve(createVenueDetail());
  expect(await adoption).toBe(false);
  expect(store.getState().plan.status).toBe('idle');
});

it('暫時顯示戶外地圖保留路線快照，結束共用session才清除路線', async () => {
  const store = createIndoorStore();
  await store.getState().adoptRoute(createVenueRoute());
  store.getState().suspend();
  expect(store.getState()).toMatchObject({ active: false, plan: { status: 'ready' } });
  store.getState().resume();
  store.getState().clearRoute();
  expect(store.getState()).toMatchObject({ active: true, plan: { status: 'idle' }, guidance: { status: 'idle' } });
});

it.each(['clearRoute', 'suspend', 'exitVenue'] as const)('%s 作廢載入中的採用，晚到結果不恢復已取消路線', async (cancel) => {
  const store = createIndoorStore();
  const pending = deferred<VenueDetail>();
  detailApi.mockReturnValueOnce(pending.promise);
  const adoption = store.getState().adoptRoute(createVenueRoute());
  store.getState()[cancel]();
  pending.resolve(createVenueDetail());
  expect(await adoption).toBe(false);
  expect(store.getState().plan.status).toBe('idle');
});

it('元件離開時以signal取消該次採用，不會在返回頁面後開始舊路線', async () => {
  const store = createIndoorStore();
  const pending = deferred<VenueDetail>();
  detailApi.mockReturnValueOnce(pending.promise);
  const controller = new AbortController();
  const adoption = store.getState().adoptRoute(createVenueRoute(), controller.signal);
  controller.abort();
  pending.resolve(createVenueDetail());
  expect(await adoption).toBe(false);
  expect(store.getState().plan.status).toBe('idle');
});
