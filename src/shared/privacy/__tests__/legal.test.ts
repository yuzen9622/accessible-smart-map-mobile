import { getAppConfig, type AppConfig } from '@/shared/config';

import { legalDocumentUrl } from '../legal';

jest.mock('@/shared/config', () => ({ getAppConfig: jest.fn() }));

function mockConfig(overrides: Partial<AppConfig>) {
  jest.mocked(getAppConfig).mockReturnValue({
    apiBaseUrl: 'https://api.example.com',
    shareBaseUrl: 'https://map.example.com',
    googleWebClientId: null,
    googleIosClientId: null,
    privacyPolicyUrl: null,
    termsUrl: null,
    lineBotBasicId: null,
    ...overrides,
  });
}

it('falls back to the localized policy pages when no override is configured', () => {
  mockConfig({});
  expect(legalDocumentUrl('privacy', 'zh-TW')).toBe('https://map.yuzen.dev/zh-TW/policies/privacy-policy');
  expect(legalDocumentUrl('terms', 'en')).toBe('https://map.yuzen.dev/en/policies/terms-of-use');
});

it('prefers the configured URLs', () => {
  mockConfig({ privacyPolicyUrl: 'https://example.com/privacy', termsUrl: 'https://example.com/terms' });
  expect(legalDocumentUrl('privacy', 'en')).toBe('https://example.com/privacy');
  expect(legalDocumentUrl('terms', 'zh-TW')).toBe('https://example.com/terms');
});
