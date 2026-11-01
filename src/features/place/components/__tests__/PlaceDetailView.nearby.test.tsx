import { render } from '@testing-library/react-native';

import type { PlaceDetailModel } from '../../hooks/usePlaceDetailViewModel';
import PlaceDetailView from '../PlaceDetailView';

const noop = () => {};
const model: PlaceDetailModel = {
  title: '國立臺中科技大學', subtitle: null, saved: false, saveLabel: '收藏', planRouteLabel: '規劃路線',
  shareLabel: '分享', shareUrl: '', onPlanRoute: noop, onToggleSave: noop, onShare: noop,
  categories: null, addCategoryLabel: '新增分類', newCategoryTitle: '分類', onCreateCategory: noop,
  checklistTitle: '無障礙資訊', checklist: [], checklistConfirmedLabel: null,
  reportLabel: '我知道', checklistSupplementLabel: '補充資訊',
  placeReport: { title: '回報', subtitle: '回報地點狀況', accessibilityLabel: '回報', onPress: noop },
  reviews: null, cctvLabel: '附近監視器', onOpenCctv: noop, infoLabel: '地點資訊', badges: [],
  nearbyTitle: '附近無障礙設施', nearbyEmptyLabel: '附近暫無無障礙設施資料',
  nearbyRows: [
    { key: 'toilet-1', name: '行政大樓廁所', typeLabel: '無障礙廁所', address: null, distanceText: '12 公尺', kind: 'toilet' },
    { key: 'ramp-1', name: '學校入口', typeLabel: '無障礙坡道', address: '三民路', distanceText: '180 公尺', kind: 'ramp' },
  ],
};

it('renders nearby facility names, categories and distances', async () => {
  const view = await render(<PlaceDetailView model={model} />);
  expect(view.getByText('附近無障礙設施')).toBeTruthy();
  expect(view.getByText('行政大樓廁所')).toBeTruthy();
  expect(view.getByText('無障礙廁所')).toBeTruthy();
  expect(view.getByText('12 公尺')).toBeTruthy();
  expect(view.getByText('學校入口')).toBeTruthy();
  expect(view.getByText('無障礙坡道 · 三民路')).toBeTruthy();
  expect(view.getByText('180 公尺')).toBeTruthy();
  expect(view.queryByText('附近暫無無障礙設施資料')).toBeNull();
});
