import { toApiLang } from '../lang';

// 移植自 Web `src/lib/place/__tests__/lang.test.ts`（commit 5eadc71）。

describe('toApiLang', () => {
  it('normalizes every accepted zh tag onto zh-TW', () => {
    for (const tag of ['zh', 'zh-TW', 'zh-tw', 'zh-Hant-TW', 'zh-CN']) {
      expect(toApiLang(tag)).toBe('zh-TW');
    }
  });

  it('normalizes every accepted en tag onto en', () => {
    for (const tag of ['en', 'en-US', 'en-GB']) {
      expect(toApiLang(tag)).toBe('en');
    }
  });

  it('omits the param for languages the backend rejects', () => {
    for (const tag of ['ja', 'ko', 'fr-FR', '', undefined]) {
      expect(toApiLang(tag)).toBeUndefined();
    }
  });
});
