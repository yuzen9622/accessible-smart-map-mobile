import { act, fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import { createVenueRoute } from '@/features/indoor/domain/fixtures/venueFixture';
import { changeAppLanguage } from '@/shared/i18n';

import { fitSelectedRoute } from '../../controller/routeSessionPort';
import { venueHandoffFixture } from '../../domain/testing/venueHandoffFixture';
import type { RoutePlanModel } from '../../hooks/useRoutePlanViewModel';
import RouteDetailScreen from '../../screens/RouteDetailScreen';
import { useRouteSessionStore } from '../../store/routeSessionStore';
import RoutePlanPanel from '../RoutePlanPanel';
import RouteSessionPill from '../RouteSessionPill';
import VenueHandoffCard from '../VenueHandoffCardBase';

jest.mock('expo-router', () => ({
  router: { navigate: jest.fn() },
  usePathname: () => '/explore',
  useLocalSearchParams: () => ({ index: '0' }),
  useNavigation: () => ({ isFocused: () => true, goBack: jest.fn() }),
  Stack: { Screen: () => null },
}));
jest.mock('../../controller/routeSessionPort', () => ({
  canNavigateRoute: () => true, fitSelectedRoute: jest.fn(), endRouteSession: jest.fn(),
}));
jest.mock('@expo/ui/swift-ui', () => {
  const actual = jest.requireActual('@expo/ui/swift-ui');
  const React = jest.requireActual('react');
  const { View, Text } = jest.requireActual('react-native');
  return {
    ...actual,
    Host: View,
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => React.createElement(View,
      { accessible: true, accessibilityRole: 'button', accessibilityLabel: label, onPress }, React.createElement(Text, null, label)),
  };
});

beforeEach(async () => {
  jest.clearAllMocks();
  useRouteSessionStore.setState(useRouteSessionStore.getInitialState());
  await act(async () => { await changeAppLanguage('zh-TW'); });
});

function indoorModel(): RoutePlanModel {
  return {
    originLabel: '2101', originIsMyLocation: false, destinationLabel: '2201',
    indoorRoute: createVenueRoute(), isIndoorJourney: true,
    travelModes: [], facilityFilters: [],
    routeModes: [{ value: 'wheelchair', label: '輪椅', selected: true, disabled: false, accessibilityLabel: '輪椅', onSelect: jest.fn() }],
    onSelectRouteMode: jest.fn(), gatedHint: null, canStart: true, loading: false, results: null,
    onSelectRoute: jest.fn(), onOpenRouteDetail: jest.fn(), error: null, onEdit: jest.fn(),
    onClearOrigin: jest.fn(), onClearDestination: jest.fn(), onSwap: jest.fn(), onStart: jest.fn(),
    labels: {
      title: '規劃路線', origin: '起點', destination: '終點', myLocation: '目前位置', swap: '交換起訖', edit: '編輯',
      clear: '清除', cancel: '取消', useMyLocation: '使用目前位置', searchPlaceholder: '搜尋', travelMode: '交通方式',
      a11yMode: '通行模式', start: '規劃', replan: '重新規劃', loading: '規劃中', chooseDestination: '選擇終點',
      startNav: '開始導航', routeOptions: '建議路線', close: '關閉', facilityFilterTitle: '沿途設施',
    },
  };
}

it('shows an indoor result in the existing plan panel with shared endpoints, modes and route-detail callback', async () => {
  const model = indoorModel();
  const start = jest.fn();
  const view = await render(<RoutePlanPanel model={model} onStartNavigation={start} />);
  expect(view.getByRole('button', { name: '起點：2101，編輯' })).toBeTruthy();
  expect(view.getByRole('button', { name: '輪椅' })).toBeTruthy();
  expect(view.getByText('1F · 2F')).toBeTruthy();
  expect(view.queryByRole('tablist', { name: '交通方式' })).toBeNull();
  expect(view.queryByText('沿途設施')).toBeNull();
  expect(view.queryByRole('button', { name: '規劃' })).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: '路線詳情' }));
  expect(model.onOpenRouteDetail).toHaveBeenCalledWith(0);
  await fireEvent.press(view.getByRole('button', { name: '開始導航' }));
  expect(start).toHaveBeenCalledTimes(1);
  expect(model.onSelectRoute).not.toHaveBeenCalled();
});

it('renders indoor steps inside the shared detail screen without an AccessibleRoute result', async () => {
  useRouteSessionStore.setState({ indoorRoute: createVenueRoute(), computeRoutes: null, selectRoute: null });
  const start = jest.fn();
  const view = await render(<RouteDetailScreen onStartNavigation={start} />);
  expect(view.getByText('搭乘電梯至 2F')).toBeTruthy();
  expect(view.getByText('抵達終點空間前公共走道')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: '開始導航' }));
  expect(start).toHaveBeenCalledTimes(1);
});

it('keeps the handoff card a summary until the navigation owner provides an explicit continuation', async () => {
  const handoff = venueHandoffFixture();
  const view = await render(<VenueHandoffCard handoff={handoff} />);
  expect(view.getByText(handoff.destinationName)).toBeTruthy();
  expect(view.queryByRole('button', { name: '已到入口，繼續' })).toBeNull();
  const continueRoute = jest.fn();
  await view.rerender(<VenueHandoffCard handoff={handoff} onContinue={continueRoute} />);
  await fireEvent.press(view.getByRole('button', { name: '已到入口，繼續' }));
  expect(continueRoute).toHaveBeenCalledTimes(1);
  expect(router.navigate).not.toHaveBeenCalled();
});

it.each(['origin', 'destination', 'route'] as const)('resumes an indoor %s session through the existing plan page', async (kind) => {
  const place = { venueId: 'test-venue', placeId: 'end' };
  useRouteSessionStore.setState({
    ...(kind === 'origin' ? { originVenuePlace: place } : kind === 'destination' ? { destinationVenuePlace: place } : { indoorRoute: createVenueRoute() }),
    destinationName: '2201',
  });
  const view = await render(<RouteSessionPill isNavigating={false} />);
  await fireEvent.press(view.getByRole('button', { name: /2201/ }));
  expect(router.navigate).toHaveBeenCalledWith('/plan');
  expect(fitSelectedRoute).toHaveBeenCalledTimes(1);
});
