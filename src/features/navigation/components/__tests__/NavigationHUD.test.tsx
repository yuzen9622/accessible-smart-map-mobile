import { act, render, screen } from '@testing-library/react-native';

import NavigationHUD from '../NavigationHUD';
import { useNavStore } from '../../store/navStore';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));

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
