import { act, fireEvent, render } from '@testing-library/react-native';

import { venueHandoffFixture } from '@/features/route/domain/testing/venueHandoffFixture';
import { useRouteSessionStore } from '@/features/route/store/routeSessionStore';
import { changeAppLanguage } from '@/shared/i18n';

import { endNavigation } from '../../controller/navigationSession';
import { useNavStore } from '../../store/navStore';
import NavigationStepsScreen from '../NavigationStepsScreen';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, router: { navigate: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../controller/navigationSession', () => ({ endNavigation: jest.fn() }));

beforeEach(async () => {
  jest.clearAllMocks();
  useNavStore.getState().reset();
  useNavStore.setState({ isNavigating: true, arrived: true });
  useRouteSessionStore.setState(useRouteSessionStore.getInitialState());
  await act(async () => { await changeAppLanguage('zh-TW'); });
});

it.each([
  { language: 'zh-TW' as const, label: '繼續室內導航', text: '繼續' },
  { language: 'en' as const, label: 'Continue indoors', text: 'Continue' },
])('puts a single concise continuation in the first arrival row in $language', async ({ language, label, text }) => {
  await act(async () => { await changeAppLanguage(language); });
  useRouteSessionStore.setState({ navigationVenueHandoff: venueHandoffFixture() });
  const onContinueVenue = jest.fn();
  const view = await render(<NavigationStepsScreen onContinueVenue={onContinueVenue} />);
  expect(view.getByText(text)).toBeTruthy();
  expect(view.getAllByRole('button')).toHaveLength(1);
  await fireEvent.press(view.getByRole('button', { name: label }));
  expect(onContinueVenue).toHaveBeenCalledTimes(1);
  expect(endNavigation).not.toHaveBeenCalled();
});

it.each(['ordinary', 'missing-callback'] as const)('retains the normal end action for %s arrivals', async (kind) => {
  if (kind === 'missing-callback') useRouteSessionStore.setState({ navigationVenueHandoff: venueHandoffFixture() });
  const onContinueVenue = jest.fn();
  const view = await render(<NavigationStepsScreen onContinueVenue={kind === 'ordinary' ? onContinueVenue : undefined} />);
  await fireEvent.press(view.getByRole('button', { name: '結束導航' }));
  expect(endNavigation).toHaveBeenCalledTimes(1);
  expect(onContinueVenue).not.toHaveBeenCalled();
});
