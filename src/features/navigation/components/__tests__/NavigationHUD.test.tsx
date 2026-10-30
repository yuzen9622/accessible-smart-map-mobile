import { act, fireEvent, render, screen } from '@testing-library/react-native';

import NavigationHUD from '../NavigationHUD';
import { useNavStore } from '../../store/navStore';
import { endNavigation } from '../../controller/navigationSession';
import { useRouteSessionStore } from '@/features/route/store/routeSessionStore';
import { venueHandoffFixture } from '@/features/route/domain/testing/venueHandoffFixture';
import { changeAppLanguage } from '@/shared/i18n';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('../../controller/navigationSession', () => ({ endNavigation: jest.fn() }));

beforeEach(async () => {
  jest.clearAllMocks();
  useNavStore.getState().reset();
  useRouteSessionStore.setState(useRouteSessionStore.getInitialState());
  await act(async () => { await changeAppLanguage('en'); });
});

it('renders backend transit names without inventing unknown stops', async () => {
  useNavStore.getState().reset();
  useNavStore.getState().setNavigationSource('voice');
  useNavStore.getState().setVoiceTransit({ onVehicle: true, leg: { mode: 'BUS', from: '甲站', to: '乙站', routeName: '307' } });
  const rendered = await render(<NavigationHUD />);
  expect(screen.getByText('307 · 甲站 → 乙站')).toBeTruthy();
  await act(async () => { useNavStore.getState().setVoiceTransit({ onVehicle: true, leg: null }); });
  await rendered.rerender(<NavigationHUD />);
  expect(screen.queryByText('307 · 甲站 → 乙站')).toBeNull();
});

it('shows the metro line toward the train terminal, keeping the alighting station as the destination', async () => {
  useNavStore.getState().reset();
  useNavStore.getState().setNavigationSource('voice');
  useNavStore.getState().setVoiceTransit({ onVehicle: true,
    leg: { mode: 'METRO', from: '市政府', to: '台北車站', routeName: '板南線', terminalStation: '頂埔',
      lineKey: 'TRTC_BL', fromNameEn: 'Taipei City Hall', toNameEn: 'Taipei Main Station', terminalNameEn: 'Dingpu' } });
  const rendered = await render(<NavigationHUD />);
  expect(screen.getByText('Bannan Line · toward Dingpu · Taipei City Hall → Taipei Main Station')).toBeTruthy();
  await act(async () => {
    useNavStore.getState().setVoiceTransit({ onVehicle: true,
      leg: { mode: 'METRO', from: '市政府', to: '台北車站', routeName: '板南線' } });
  });
  await rendered.rerender(<NavigationHUD />);
  expect(screen.getByText('板南線 · 市政府 → 台北車站')).toBeTruthy();
});

it.each([
  { language: 'zh-TW' as const, label: '繼續室內導航', text: '繼續' },
  { language: 'en' as const, label: 'Continue indoors', text: 'Continue' },
])('offers the indoor continuation directly in the arrived HUD in $language', async ({ language, label, text }) => {
  await act(async () => { await changeAppLanguage(language); });
  useNavStore.setState({ isNavigating: true, arrived: true });
  useRouteSessionStore.setState({ navigationVenueHandoff: venueHandoffFixture() });
  const onContinueVenue = jest.fn();
  const view = await render(<NavigationHUD onContinueVenue={onContinueVenue} />);
  expect(view.getByText(text)).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: label }));
  expect(onContinueVenue).toHaveBeenCalledTimes(1);
  expect(endNavigation).not.toHaveBeenCalled();
});

it.each(['ordinary', 'missing-callback'] as const)('keeps ending navigation available for %s arrivals', async (kind) => {
  useNavStore.setState({ isNavigating: true, arrived: true });
  if (kind === 'missing-callback') useRouteSessionStore.setState({ navigationVenueHandoff: venueHandoffFixture() });
  const onContinueVenue = jest.fn();
  const view = await render(<NavigationHUD onContinueVenue={kind === 'ordinary' ? onContinueVenue : undefined} />);
  await fireEvent.press(view.getByRole('button', { name: 'End Navigation' }));
  expect(endNavigation).toHaveBeenCalledTimes(1);
  expect(onContinueVenue).not.toHaveBeenCalled();
});

it('does not offer the arrival continuation before reaching the outdoor endpoint', async () => {
  useNavStore.setState({ isNavigating: true, arrived: false });
  useRouteSessionStore.setState({ navigationVenueHandoff: venueHandoffFixture() });
  const view = await render(<NavigationHUD onContinueVenue={jest.fn()} />);
  expect(view.queryByRole('button', { name: 'Continue indoors' })).toBeNull();
});
