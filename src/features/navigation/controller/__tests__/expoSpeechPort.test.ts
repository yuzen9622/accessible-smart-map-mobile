import * as Speech from 'expo-speech';

import { expoSpeechPort } from '../expoSpeechPort';

jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); });

it.each<{ language: 'zh-TW' | 'en'; expectedLanguage: string }>([
  { language: 'zh-TW', expectedLanguage: 'zh-TW' },
  { language: 'en', expectedLanguage: 'en-US' },
])('uses an independent speech session for $language navigation', ({ language, expectedLanguage }) => {
  expoSpeechPort.speak('Navigation instruction', language);

  expect(Speech.speak).toHaveBeenCalledWith('Navigation instruction', {
    language: expectedLanguage,
    rate: 0.9,
    useApplicationAudioSession: false,
  });
});
