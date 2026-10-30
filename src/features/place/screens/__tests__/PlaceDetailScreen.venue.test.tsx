import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text as MockText, Pressable as MockPressable } from 'react-native';

import { loadVenue } from '@/features/indoor/api/venueApi';
import { createVenueDetail } from '@/features/indoor/domain/fixtures/venueFixture';

import { getPlaceDetails } from '../../api/placeSearch';
import { usePlaceUiStore } from '../../store/placeUiStore';
import type { PlaceDetail } from '../../types/place';
import PlaceDetailScreen from '../PlaceDetailScreen';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, useLocalSearchParams: jest.fn() }));
jest.mock('@/features/indoor/api/venueApi', () => ({ loadVenue: jest.fn() }));
jest.mock('../../api/placeSearch', () => ({ getPlaceDetails: jest.fn() }));
jest.mock('@/shared/ui', () => ({
  HeaderCloseButton: () => null,
  ErrorState: ({ retry }: { retry?: { onPress: () => void } }) => <MockPressable accessibilityLabel="重試" onPress={retry?.onPress}><MockText>無法載入</MockText></MockPressable>,
}));
jest.mock('../../components/PlaceDetailSkeleton', () => function MockSkeleton() { return <MockText>載入中</MockText>; });
jest.mock('../../components/PlaceDetailPanel', () => function MockPanel({ entry }: { entry: PlaceDetail }) { return <MockText>{entry.kind === 'venue-place' ? entry.name : '一般地點'}</MockText>; });

beforeEach(() => {
  jest.clearAllMocks();
  usePlaceUiStore.getState().setSelectedPlace(null);
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'venue:test-venue:end' });
  jest.mocked(loadVenue).mockResolvedValue(createVenueDetail());
});

it('loads a room through the existing place screen and retries without calling outdoor details', async () => {
  jest.mocked(loadVenue).mockRejectedValueOnce(new Error('offline'));
  await render(<PlaceDetailScreen />);
  await act(async () => {});
  expect(screen.getByText('無法載入')).toBeTruthy();
  expect(usePlaceUiStore.getState().selectedPlace).toBeNull();
  await fireEvent.press(screen.getByLabelText('重試'));
  await act(async () => {});
  expect(screen.getByText('終點空間')).toBeTruthy();
  expect(usePlaceUiStore.getState().selectedPlace).toMatchObject({ kind: 'venue-place', venueId: 'test-venue', placeId: 'end', buildingId: 'a', levelRef: '2F', sourceVersion: 3 });
  expect(getPlaceDetails).not.toHaveBeenCalled();
});

it('ignores a previous room response after a different room is opened on the same screen', async () => {
  let finish: (detail: ReturnType<typeof createVenueDetail>) => void = () => {};
  jest.mocked(loadVenue).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const view = await render(<PlaceDetailScreen />);
  const firstSignal = jest.mocked(loadVenue).mock.calls[0][1];
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'venue:test-venue:start' });
  await view.rerender(<PlaceDetailScreen />);
  await act(async () => {});
  expect(firstSignal?.aborted).toBe(true);
  expect(screen.getByText('起點空間')).toBeTruthy();
  await act(async () => finish(createVenueDetail()));
  expect(screen.queryByText('終點空間')).toBeNull();
  expect(usePlaceUiStore.getState().selectedPlace).toMatchObject({ kind: 'venue-place', placeId: 'start' });
});
