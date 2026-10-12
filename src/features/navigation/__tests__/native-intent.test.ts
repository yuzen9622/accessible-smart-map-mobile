import { redirectSystemPath } from '@/app/+native-intent';
import { useNavStore } from '../store/navStore';

beforeEach(() => useNavStore.setState(useNavStore.getInitialState()));

const entryLinks = [
  'accessiblesmartmap://',
  'accessiblesmartmap:///',
  '/',
  'accessiblesmartmap://navigation',
  'accessiblesmartmap:///navigation',
  '/navigation',
  'accessiblesmartmap://navigation/?source=activity',
];

it.each(entryLinks)('returns to the existing navigation sheet for %s', (path) => {
  useNavStore.setState({ isNavigating: true, navigationId: 'current-session', currentStepIndex: 3 });
  expect(redirectSystemPath({ path, initial: false })).toBe('/navigation');
  expect(useNavStore.getState()).toMatchObject({ navigationId: 'current-session', currentStepIndex: 3 });
});

it.each(entryLinks)('opens the home sheet for a stale activity link: %s', (path) => {
  expect(redirectSystemPath({ path, initial: false })).toBe('/explore');
});

it.each(entryLinks)('keeps cold launch on the normal startup/onboarding path: %s', (path) => {
  expect(redirectSystemPath({ path, initial: true })).toBe('/');
});

it.each([
  'accessiblesmartmap://place/123?name=test',
  'accessiblesmartmap://sos-track/share-token',
  'accessiblesmartmap://chat?q=hello',
  '/settings',
  'https://example.com/navigation',
  'com.googleusercontent.apps.example:/oauthredirect',
  'http://[invalid',
])('preserves other deep links while navigating: %s', (path) => {
  useNavStore.setState({ isNavigating: true });
  expect(redirectSystemPath({ path, initial: false })).toBe(path);
});

describe('SOS Universal Links', () => {
  const token = 'ab'.repeat(16);

  it.each([
    `https://map.yuzen.dev/zh-TW/sos/?token=${token}`,
    `https://map.yuzen.dev/zh-TW/sos/?token=${token}&openExternalBrowser=1`,
    `https://map-dev.yuzen.dev/en/sos?token=${token.toUpperCase()}`,
  ])('opens the native family tracker for %s', (path) => {
    expect(redirectSystemPath({ path, initial: true })).toBe(`/sos-track/${token}`);
  });

  it('sends a malformed token home instead of a broken tracker', () => {
    expect(redirectSystemPath({ path: 'https://map.yuzen.dev/zh-TW/sos/?token=65f0c0ffee', initial: false })).toBe('/');
  });

  it('leaves other https paths alone', () => {
    const path = 'https://map.yuzen.dev/zh-TW/?place=abc';
    expect(redirectSystemPath({ path, initial: false })).toBe(path);
  });
});
