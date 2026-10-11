import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { HazardDetailModel } from '../../hooks/useHazardDetail';
import HazardDetailPanel from '../HazardDetailPanel';

jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/content-safety', () => ({ ContentActions: () => null }));
jest.mock('@/features/auth', () => ({
  useAuthStore: (selector: (state: { user: { _id: string } }) => unknown) => selector({ user: { _id: 'owner' } }),
}));
jest.mock('@/shared/i18n', () => ({ useAppTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/shared/ui', () => {
  const { Text, Pressable } = jest.requireActual('react-native');
  return {
    Icon: () => null,
    ErrorState: ({ title }: { title: string }) => <Text>{title}</Text>,
    Button: ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}><Text>{label}</Text></Pressable>
    ),
  };
});
jest.mock('expo-image', () => {
  const { View: MockView } = jest.requireActual('react-native');
  return { Image: MockView };
});
const mockSource = jest.fn((id: string): { uri: string; headers: Record<string, string> } | null => (
  { uri: `https://api.test/reports/${id}/photo`, headers: { Authorization: 'Bearer test-token' } }
));
const mockRecover = jest.fn();
jest.mock('../../api/hazardApi', () => ({
  hazardPhotoSource: (id: string) => mockSource(id),
  recoverHazardPhotoSource: (id: string) => mockRecover(id),
}));

function model(overrides: Partial<HazardDetailModel> = {}): HazardDetailModel {
  return {
    userId: 'owner', loading: false, failure: null, retry: jest.fn(),
    report: {
      _id: 'report-one', hazardType: 'obstacle', severity: 'difficult', status: 'verified', hasPhoto: true,
      reportedLocation: { type: 'Point', coordinates: [120.63734, 24.13039] },
      description: '此地方正在施工', confirmCount: 0, denyCount: 0,
      aiReview: { state: 'completed', decision: 'supported' },
    },
    typeLabel: 'Obstacle', severityLabel: 'Difficult', statusText: 'Accepted · 0 confirmed',
    reviewText: 'Photo supports the report; not on-site verification', createdText: '2026/10/11 11:15',
    canVote: true, voted: false, voting: false, confirm: jest.fn(), deny: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => { jest.clearAllMocks(); mockRecover.mockResolvedValue(null); });

it('renders the actual protected photo component in map report details', async () => {
  await render(<HazardDetailPanel model={model()} />);
  const photo = screen.getByLabelText('hazardPhoto');
  expect(photo.props.source).toEqual({ uri: 'https://api.test/reports/report-one/photo', headers: { Authorization: 'Bearer test-token' } });
  expect(photo.props.cachePolicy).toBe('none');
  expect(photo.props.contentFit).toBe('contain');
  await act(async () => { await photo.props.onLoad(); });
  expect(screen.queryByText('hazardPhotoLoading')).toBeNull();
  expect(screen.getByText('此地方正在施工')).toBeTruthy();
});

it('shows no-photo state without requesting an image', async () => {
  const data = model();
  const noPhoto = { ...data.report!, hasPhoto: false, photoUrl: 'https://storage.test/stale.jpg' };
  await render(<HazardDetailPanel model={{ ...data, report: noPhoto }} />);
  expect(mockSource).not.toHaveBeenCalled();
  expect(screen.getByText('hazardDetailNoPhoto')).toBeTruthy();
});

it('allows a failed photo to retry and recover', async () => {
  await render(<HazardDetailPanel model={model()} />);
  await act(async () => { await screen.getByLabelText('hazardPhoto').props.onError(); });
  expect(screen.getByText('hazardPhotoUnavailable')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'myReportsRetry' }));
  const photo = screen.getByLabelText('hazardPhoto');
  await act(async () => { await photo.props.onLoad(); });
  expect(screen.queryByText('hazardPhotoUnavailable')).toBeNull();
});

it('resets the photo when switching reports and never displays a legacy storage URL', async () => {
  const data = model();
  const { rerender } = await render(<HazardDetailPanel model={data} />);
  await act(async () => { await screen.getByLabelText('hazardPhoto').props.onLoad(); });
  const legacyReport = { ...data.report!, _id: 'report-two', hasPhoto: undefined, photoUrl: 'https://storage.test/private.jpg' };
  await rerender(<HazardDetailPanel model={{ ...data, report: legacyReport }} />);
  expect(screen.getByLabelText('hazardPhoto').props.source.uri).toBe('https://api.test/reports/report-two/photo');
  expect(screen.getByText('hazardPhotoLoading')).toBeTruthy();
});

it('explains protected photo access without an unauthenticated retry loop', async () => {
  mockSource.mockReturnValueOnce(null);
  await render(<HazardDetailPanel model={model()} />);
  expect(screen.getByText('hazardPhotoUnavailable')).toBeTruthy();
  expect(screen.getByText('hazardDetailPhotoAccess')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'myReportsRetry' })).toBeNull();
  expect(mockRecover).not.toHaveBeenCalled();
});

it('hides confirmation actions when the report cannot be voted on', async () => {
  await render(<HazardDetailPanel model={model({ canVote: false })} />);
  expect(screen.queryByText('hazardDetailOnSite')).toBeNull();
  expect(screen.queryByRole('button', { name: 'hazardDetailConfirm' })).toBeNull();
});

it('keeps vote callbacks and pending/voted gating', async () => {
  const data = model();
  const { rerender } = await render(<HazardDetailPanel model={data} />);
  await fireEvent.press(screen.getByRole('button', { name: 'hazardDetailConfirm' }));
  await fireEvent.press(screen.getByRole('button', { name: 'hazardDetailDeny' }));
  expect(data.confirm).toHaveBeenCalledTimes(1);
  expect(data.deny).toHaveBeenCalledTimes(1);
  await rerender(<HazardDetailPanel model={{ ...data, voting: true }} />);
  await fireEvent.press(screen.getByRole('button', { name: 'hazardDetailConfirm' }));
  expect(data.confirm).toHaveBeenCalledTimes(1);
  await rerender(<HazardDetailPanel model={{ ...data, voted: true }} />);
  expect(screen.getByText('hazardVoted')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'hazardDetailConfirm' })).toBeNull();
});
