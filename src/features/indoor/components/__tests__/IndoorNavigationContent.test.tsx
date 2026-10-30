import { act, fireEvent, render } from '@testing-library/react-native';

import { changeAppLanguage } from '@/shared/i18n';

import { createVenueDetail, createVenueRoute } from '../../domain/fixtures/venueFixture';
import { useIndoorStore } from '../../store/indoorStore';
import IndoorNavigationContent from '../IndoorNavigationContent';

beforeEach(async () => {
  useIndoorStore.setState(useIndoorStore.getInitialState());
  useIndoorStore.setState({
    active: true, venue: { status: 'ready', data: createVenueDetail() },
    plan: { status: 'ready', data: createVenueRoute() },
    floor: { buildingId: 'a', levelRef: '1F' },
    guidance: { status: 'guiding', stepIndex: 2, confirmed: { buildingId: 'a', levelRef: '1F' } },
  });
  await act(async () => { await changeAppLanguage('zh-TW'); });
});

it('browses a step floor without advancing, then advances only after confirming the current elevator step', async () => {
  const view = await render(<IndoorNavigationContent onEnd={jest.fn()} />);
  expect(view.queryByLabelText('搜尋室內地點')).toBeNull();
  expect(view.queryByRole('button', { name: '查看此樓層資料說明' })).toBeNull();
  expect(view.queryByText(/沒有即時室內定位/)).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: /第 4 步.*沿二樓走廊前進/ }));
  expect(useIndoorStore.getState()).toMatchObject({
    floor: { buildingId: 'a', levelRef: '2F' },
    guidance: { status: 'guiding', stepIndex: 2, confirmed: { buildingId: 'a', levelRef: '1F' } },
  });
  await fireEvent.press(view.getByRole('button', { name: '已到 2F' }));
  expect(useIndoorStore.getState().guidance).toMatchObject({ status: 'guiding', stepIndex: 3, confirmed: { levelRef: '2F' } });
  await fireEvent.press(view.getByRole('button', { name: '已完成這一步' }));
  await fireEvent.press(view.getByRole('button', { name: '確認抵達' }));
  expect(useIndoorStore.getState().guidance.status).toBe('complete');
  expect(view.getAllByText('抵達終點空間前公共走道').length).toBeGreaterThan(0);
  expect(view.queryByRole('button', { name: '確認抵達' })).toBeNull();
});

it('delegates ending navigation to the shared navigation owner', async () => {
  const onEnd = jest.fn();
  const view = await render(<IndoorNavigationContent onEnd={onEnd} />);
  await fireEvent.press(view.getByRole('button', { name: '結束導航' }));
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(useIndoorStore.getState().guidance.status).toBe('guiding');
});
