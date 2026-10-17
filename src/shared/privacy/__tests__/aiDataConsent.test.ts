import { Alert, type AlertButton } from 'react-native';

import { usePreferencesStore } from '@/shared/preferences';

import { ensureAiDataConsent, requestAiDataConsent } from '../aiDataConsent';
import { openLegalDocument } from '../legal';

jest.mock('../legal', () => ({ openLegalDocument: jest.fn() }));

const t = (key: string) => key;

function pressButton(text: string) {
  const buttons: AlertButton[] = jest.mocked(Alert.alert).mock.calls[0]?.[2] ?? [];
  const button = buttons.find((candidate) => candidate.text === text);
  if (!button?.onPress) throw new Error(`no button ${text}`);
  button.onPress();
}

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  usePreferencesStore.getState().setPreferences({ aiDataConsent: false });
});

afterEach(() => jest.restoreAllMocks());

it('skips the prompt once the user has already agreed', async () => {
  usePreferencesStore.getState().setPreferences({ aiDataConsent: true });
  await expect(ensureAiDataConsent(t)).resolves.toBe(true);
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('discloses the data sharing and remembers an explicit agreement', async () => {
  const result = ensureAiDataConsent(t);
  expect(Alert.alert).toHaveBeenCalledWith('aiConsent.title', 'aiConsent.body', expect.any(Array), expect.any(Object));
  pressButton('aiConsent.accept');
  await expect(result).resolves.toBe(true);
  expect(usePreferencesStore.getState().aiDataConsent).toBe(true);
});

it('blocks the AI action and keeps consent off when the user declines', async () => {
  const result = ensureAiDataConsent(t);
  pressButton('aiConsent.decline');
  await expect(result).resolves.toBe(false);
  expect(usePreferencesStore.getState().aiDataConsent).toBe(false);
});

it('opens the privacy policy without granting consent', async () => {
  const result = requestAiDataConsent(t);
  pressButton('aiConsent.privacyPolicy');
  await expect(result).resolves.toBe(false);
  expect(openLegalDocument).toHaveBeenCalledWith('privacy');
  expect(usePreferencesStore.getState().aiDataConsent).toBe(false);
});
