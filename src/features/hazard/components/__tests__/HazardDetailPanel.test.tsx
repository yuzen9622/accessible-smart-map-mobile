import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { HazardDetailModel } from '../../hooks/useHazardDetail';
import HazardDetailPanel from '../HazardDetailPanel';

jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/content-safety', () => ({ ContentActions: () => null }));
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
jest.mock('expo-image', () => ({ Image: jest.requireActual('react-native').View }));
const mockPrivate = jest.fn();
const mockRecover = jest.fn();
jest.mock('../../api/hazardApi', () => ({
  publicHazardPhotoSource: (url: string | null) => url ? { uri: `https://backend.test${url}` } : null,
  hazardPhotoSource: (...args: unknown[]) => mockPrivate(...args),
  recoverHazardPhotoSource: (...args: unknown[]) => mockRecover(...args),
}));

function model(overrides: Partial<HazardDetailModel> = {}): HazardDetailModel {
  return {
    userId: null, loading: false, failure: null, retry: jest.fn(),
    report: {
      _id: 'report-one', hazardType: 'obstacle', severity: 'difficult', status: 'verified', hasPhoto: true,
      publicPhotoUrl: '/api/v1/a11y/reports/report-one/photo/public',
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

beforeEach(() => { jest.clearAllMocks(); });

it('loads the DTO public URL anonymously without a private source or token', async () => {
  await render(<HazardDetailPanel model={model()} />);
  const photo = screen.getByLabelText('hazardPhoto');
  expect(photo.props.source).toEqual({ uri: 'https://backend.test/api/v1/a11y/reports/report-one/photo/public' });
  expect(photo.props.cachePolicy).toBe('none');
  expect(photo.props.contentFit).toBe('contain');
  await act(async () => { photo.props.onLoad(); });
  expect(screen.queryByText('hazardPhotoLoading')).toBeNull();
  expect(mockPrivate).not.toHaveBeenCalled();
  expect(screen.getByText('此地方正在施工')).toBeTruthy();
});

it('does not load a null public URL even for the owner with hasPhoto and a legacy URL', async () => {
  const data = model();
  const report = { ...data.report!, reporterId: 'owner', publicPhotoUrl: null, hasPhoto: true, photoUrl: 'https://storage.test/stale.jpg' };
  await render(<HazardDetailPanel model={{ ...data, userId: 'owner', report }} />);
  expect(screen.queryByLabelText('hazardPhoto')).toBeNull();
  expect(screen.getByText('hazardPublicPhotoUnavailable')).toBeTruthy();
  expect(mockPrivate).not.toHaveBeenCalled();
});

it('shows no-photo state without requesting an image', async () => {
  const data = model();
  await render(<HazardDetailPanel model={{ ...data, report: { ...data.report!, publicPhotoUrl: null, hasPhoto: false } }} />);
  expect(screen.queryByLabelText('hazardPhoto')).toBeNull();
  expect(screen.getByText('hazardDetailNoPhoto')).toBeTruthy();
});

it('shows public-unavailable on 404 without private recovery or a login hint', async () => {
  await render(<HazardDetailPanel model={model()} />);
  await act(async () => { screen.getByLabelText('hazardPhoto').props.onError({ error: 'HTTP 404' }); });
  expect(screen.getByText('hazardPublicPhotoUnavailable')).toBeTruthy();
  expect(screen.queryByText('hazardDetailPhotoAccess')).toBeNull();
  expect(screen.queryByLabelText('hazardPhoto')).toBeNull();
  expect(mockPrivate).not.toHaveBeenCalled();
  expect(mockRecover).not.toHaveBeenCalled();
});

it('removes a loaded photo when a refreshed DTO clears the URL, then resets for another report', async () => {
  const data = model();
  const { rerender } = await render(<HazardDetailPanel model={data} />);
  await act(async () => { screen.getByLabelText('hazardPhoto').props.onLoad(); });
  await rerender(<HazardDetailPanel model={{ ...data, report: { ...data.report!, publicPhotoUrl: null, status: 'expired' } }} />);
  expect(screen.queryByLabelText('hazardPhoto')).toBeNull();
  await rerender(<HazardDetailPanel model={{ ...data, report: { ...data.report!, _id: 'report-two', publicPhotoUrl: '/api/v1/a11y/reports/report-two/photo/public' } }} />);
  expect(screen.getByLabelText('hazardPhoto').props.source.uri).toBe('https://backend.test/api/v1/a11y/reports/report-two/photo/public');
  expect(screen.getByText('hazardPhotoLoading')).toBeTruthy();
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
