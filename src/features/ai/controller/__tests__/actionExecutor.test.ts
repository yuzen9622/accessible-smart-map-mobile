import { Linking } from 'react-native';
import { mapCamera } from '@/features/map';
import { logger } from '@/shared/logger';
import { executeAction, openAiResult } from '../actionExecutor';
import { mapToolToActions } from '../../domain/toolActionMapper';
import { useAiResultStore } from '../../store/aiResultStore';
import { t } from '../../domain/testing/translate';

jest.mock('@/features/map', () => jest.requireActual('@/features/navigation/controller/testing/fakeMap').mapModule);
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
const fly = jest.spyOn(mapCamera, 'flyTo');
const open = jest.spyOn(Linking, 'openURL');
const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);

beforeEach(() => { jest.clearAllMocks(); useAiResultStore.getState().clear(); open.mockResolvedValue(undefined); });

it('opens HTTP(S) sources and catches native open failures', async () => {
  openAiResult({ id: 'web', title: '來源', url: 'https://example.org' });
  expect(open).toHaveBeenCalledWith('https://example.org');
  open.mockRejectedValueOnce(new Error('native refused'));
  openAiResult({ id: 'web', title: '來源', url: 'https://example.org' });
  await Promise.resolve();
  expect(warn).toHaveBeenCalledWith('[ai] open result link failed', expect.any(Error));
});

it.each(['javascript:alert(1)', 'file:///private/data', 'tel:123', 'https://', 'intent://app'])('does not open unsafe source %s', (url) => {
  openAiResult({ id: 'web', title: '來源', url });
  expect(open).not.toHaveBeenCalled();
});

it('executes received vehicle snapshots and preserves markers when a later snapshot lacks coordinates', () => {
  const first = mapToolToActions('trackBuses', { ok: true, buses: [{ plateNumb: 'BUS-1', lat: 25.03, lng: 121.53 }] }, null, t);
  first.forEach(executeAction);
  expect(useAiResultStore.getState().markers).toEqual([expect.objectContaining({ title: 'BUS-1', position: { lat: 25.03, lng: 121.53 } })]);
  expect(fly).toHaveBeenCalledWith([121.53, 25.03], 16);
  mapToolToActions('trackBuses', { ok: true, buses: [{ plateNumb: 'BUS-2' }] }, null, t).forEach(executeAction);
  expect(useAiResultStore.getState().markers[0].title).toBe('BUS-1');
});
