import { act, fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import EnvironmentChip from '../components/EnvironmentChip';
import EnvironmentDetailScreen from '../screens/EnvironmentDetailScreen';
import { useEnvironmentStore } from '../store/environmentStore';
import type { EnvironmentInfo } from '../domain/environment';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('@/shared/i18n', () => ({ useAppTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('expo-glass-effect', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    isLiquidGlassAvailable: () => true,
    GlassView: (props: object) => React.createElement(View, { ...props, testID: 'glass' }),
  };
});

const environment: EnvironmentInfo = {
  weather: { status: 'ok', temperature: 25, precipitationProbability: 60, condition: '陰短暫雨' },
  airQuality: { status: 'ok', pm25: 20, quality: '普通', advice: null },
};

beforeEach(() => {
  jest.clearAllMocks();
  useEnvironmentStore.setState({ info: environment });
});

it('updates the chip and detail icons together when the weather changes', async () => {
  const view = await render(<><EnvironmentChip /><EnvironmentDetailScreen /></>);
  expect(view.getAllByTestId('icon-cloudRain', { includeHiddenElements: true })).toHaveLength(2);
  expect(view.getAllByText('25°')).toHaveLength(2);
  await act(() => useEnvironmentStore.getState().setInfo({
    ...environment,
    weather: { ...environment.weather, condition: '晴' },
  }));
  expect(view.getAllByTestId('icon-sun', { includeHiddenElements: true })).toHaveLength(2);
  expect(view.queryAllByTestId('icon-cloudRain', { includeHiddenElements: true })).toHaveLength(0);
});

it('keeps the weather and AQI chip tappable after adding glass', async () => {
  const view = await render(<EnvironmentChip />);
  expect(view.getByText('普通')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'nativeEnvironmentChipTitle，陰短暫雨' }));
  expect(router.navigate).toHaveBeenCalledWith('/environment');
});

it('keeps temperature and AQI without inventing an icon for unknown weather', async () => {
  useEnvironmentStore.setState({ info: { ...environment, weather: { ...environment.weather, condition: null } } });
  const view = await render(<EnvironmentChip />);
  expect(view.getByText('25°')).toBeTruthy();
  expect(view.queryAllByTestId(/^icon-/, { includeHiddenElements: true }).map(el => el.props.testID)).toEqual(['icon-wind']);
});

it('shows AQI alone when weather is unavailable and hides the chip when neither source is available', async () => {
  useEnvironmentStore.setState({ info: { ...environment, weather: { ...environment.weather, status: 'unavailable' } } });
  const view = await render(<EnvironmentChip />);
  expect(view.queryByText('25°')).toBeNull();
  expect(view.getByText('普通')).toBeTruthy();
  expect(view.queryAllByTestId(/^icon-/, { includeHiddenElements: true }).map(el => el.props.testID)).toEqual(['icon-wind']);
  await act(() => useEnvironmentStore.setState({ info: {
    weather: { ...environment.weather, status: 'unavailable' },
    airQuality: { ...environment.airQuality, status: 'unavailable' },
  } }));
  expect(view.queryByRole('button')).toBeNull();
});
