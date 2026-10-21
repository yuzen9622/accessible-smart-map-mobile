import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { ensureAiDataConsent } from '@/shared/privacy';

import { startVoiceSession, dismissVoiceSession } from '../../controller/voiceController';
import { initialVoiceViewState } from '../../domain/voiceViewState';
import { useVoiceStore } from '../../store/voiceStore';
import VoiceModeView from '../VoiceModeView';

let mockLanguage: 'zh-TW' | 'en' = 'zh-TW';
jest.mock('@/features/ai', () => ({
  ...jest.requireActual('@/features/ai/domain/toolLabels'),
  getAggregatedToolResults: jest.requireActual('@/features/ai/domain/toolResultCards').getAggregatedToolResults,
  ToolResultsBox: jest.requireActual('@/features/ai/components/ToolResultsBox').default,
  openAiResult: jest.fn(),
}));
jest.mock('@/shared/i18n', () => ({
  useAppTranslation: () => ({ t: (key: string) => {
    const translations = mockLanguage === 'en'
      ? jest.requireActual('@/shared/i18n/locale/en/translation.json')
      : jest.requireActual('@/shared/i18n/locale/zh-TW/translation.json');
    return key.split('.').reduce((value, segment) => value[segment], translations);
  } }),
}));
jest.mock('../../controller/voiceController', () => ({
  startVoiceSession: jest.fn(), dismissVoiceSession: jest.fn(), endVoiceSession: jest.fn(),
  retryRouteContextSync: jest.fn(), resumeVoicePlayback: jest.fn(), toggleVoiceMute: jest.fn(),
}));
jest.mock('@/shared/privacy', () => ({ ensureAiDataConsent: jest.fn() }));
jest.mock('../VoiceWaveform', () => () => null);
jest.mock('../../store/voiceLevels', () => ({ voiceLevelFor: () => ({ value: 0 }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const { useMemo } = jest.requireActual('react');
  return {
    __esModule: true, default: { View }, useReducedMotion: () => true,
    useSharedValue: (value: number) => useMemo(() => ({ value, set: jest.fn() }), [value]),
    useAnimatedStyle: () => ({}), withTiming: (v: number) => v,
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(ensureAiDataConsent).mockResolvedValue(true);
  useVoiceStore.setState({ ...initialVoiceViewState, toolResults: [], routeSyncState: 'idle', launchOrigin: null });
});

it.each(['zh-TW', 'en'] as const)('shows recoverable errors and working retry/close controls in %s', async language => {
  mockLanguage = language;
  useVoiceStore.setState({ status: { status: 'error', code: 'ROUTE_RESPONSE_INVALID' } });
  const view = await render(<VoiceModeView />);
  const message = language === 'en' ? "We couldn't verify this route result. Please retry voice." : '無法確認這次路線結果，請重試語音';
  expect(view.getByText(message)).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: language === 'en' ? 'Retry' : '重新嘗試' }));
  await waitFor(() => expect(startVoiceSession).toHaveBeenCalledTimes(1));
  await fireEvent.press(view.getByRole('button', { name: language === 'en' ? 'Close' : '關閉' }));
  expect(dismissVoiceSession).toHaveBeenCalledTimes(1);
});

it('shows full query cards while voice is still listening', async () => {
  mockLanguage = 'zh-TW';
  useVoiceStore.setState({ status: { status: 'listening' }, toolResults: [
    { type: 'result', name: 'findGooglePlaces', ok: true, result: { ok: true, places: [{ name: '市政府無障礙入口', formatted_address: '市府路1號', geometry: { location: { lat: 25, lng: 121 } } }] } },
  ] });
  const view = await render(<VoiceModeView />);
  expect(view.getByText('市政府無障礙入口')).toBeTruthy();
  expect(view.getByText('市府路1號')).toBeTruthy();
  expect(view.getByRole('button', { name: '結束語音對話' })).toBeTruthy();
});

it('shows the farewell state without pretending the microphone is listening', async () => {
  mockLanguage = 'zh-TW';
  useVoiceStore.setState({ status: { status: 'ending' } });
  const view = await render(<VoiceModeView />);
  expect(view.getByText('正在結束對話…')).toBeTruthy();
  expect(view.queryByText('聆聽中…')).toBeNull();
});

it('does not reconnect voice when the user has not consented to sharing data with AI', async () => {
  mockLanguage = 'zh-TW';
  jest.mocked(ensureAiDataConsent).mockResolvedValue(false);
  useVoiceStore.setState({ status: { status: 'error', code: 'ROUTE_RESPONSE_INVALID' } });
  const view = await render(<VoiceModeView />);
  await fireEvent.press(view.getByRole('button', { name: '重新嘗試' }));
  await waitFor(() => expect(ensureAiDataConsent).toHaveBeenCalledTimes(1));
  expect(startVoiceSession).not.toHaveBeenCalled();
});

it('replaces the pending tool label with a failure notice while retaining voice controls', async () => {
  mockLanguage = 'zh-TW';
  useVoiceStore.setState({ status: { status: 'listening' }, activeTool: { type: 'call', name: 'planAccessibleRoute' } });
  const view = await render(<VoiceModeView />);
  await act(() => useVoiceStore.setState({ activeTool: { type: 'result', name: 'planAccessibleRoute', ok: false } }));
  expect(view.getByText('這次查詢未完成，你可以補充資訊繼續對話')).toBeTruthy();
  expect(view.getByRole('button', { name: '結束語音對話' })).toBeTruthy();
  expect(view.queryByRole('button', { name: '重新嘗試' })).toBeNull();
});
