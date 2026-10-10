import { act, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import MapScreen from '../components/MapScreen';
import { useMapUiStore } from '../store/mapUiStore';

let mockFocused = true;
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn() },
  usePathname: () => '/',
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const focused = mockFocused;
    React.useEffect(() => {
      if (focused) return callback();
    }, [callback, focused]);
  },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../hooks/useBasemapStyle', () => ({ useBasemapStyle: () => ({ status: 'loading' }) }));
jest.mock('../hooks/useLocationTracking', () => ({ useLocationTracking: () => {} }));
jest.mock('../hooks/useFacilitiesLoader', () => ({ useFacilitiesLoader: () => {} }));
jest.mock('../hooks/useNearbyParking', () => ({ useNearbyParking: () => {} }));
jest.mock('../components/FacilityLayer', () => () => null);
jest.mock('../components/FacilityPills', () => () => null);
jest.mock('../components/LayerChips', () => () => null);
jest.mock('../components/ParkingLayer', () => () => null);
jest.mock('../components/MapControls', () => () => null);
jest.mock('../../../../modules/sheet-detent', () => ({ SheetEdgeFollower: null, isSheetDetentAvailable: () => false }));
jest.mock('@/shared/ui', () => ({ LoadingState: () => null, ErrorState: () => null }));
jest.mock('@/shared/i18n', () => ({ useAppTranslation: () => ({ t: (key: string) => key }) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused = true;
  useMapUiStore.setState({ sheetInset: 0, sheetDetentIndex: 0 });
});

it('restores the navigation panel when the map regains focus during navigation', async () => {
  mockFocused = false;
  const view = await render(<MapScreen navigationMode />);
  expect(router.navigate).not.toHaveBeenCalled();
  mockFocused = true;
  await view.rerender(<MapScreen navigationMode />);
  expect(router.navigate).toHaveBeenLastCalledWith('/navigation');
});

it('opens search when no navigation is active', async () => {
  await render(<MapScreen />);
  expect(router.navigate).toHaveBeenCalledWith('/explore');
});

it('does not present a sheet before onboarding completes', async () => {
  await render(<MapScreen navigationMode homeSheetEnabled={false} />);
  expect(router.navigate).not.toHaveBeenCalled();
});

it('does not repeat navigation on unrelated map updates while focused', async () => {
  await render(<MapScreen navigationMode />);
  jest.mocked(router.navigate).mockClear();
  await act(() => useMapUiStore.getState().setSheetInset(180));
  expect(router.navigate).not.toHaveBeenCalled();
});
