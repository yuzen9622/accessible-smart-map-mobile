import { isAppLanguage, resolveDeviceLanguage } from '../language';

describe('resolveDeviceLanguage', () => {
  it('繁中、簡中都對應 zh-TW', () => {
    expect(resolveDeviceLanguage([{ languageCode: 'zh', languageScriptCode: 'Hant', regionCode: 'TW' }])).toBe('zh-TW');
    expect(resolveDeviceLanguage([{ languageCode: 'zh', languageScriptCode: 'Hans', regionCode: 'CN' }])).toBe('zh-TW');
  });

  it('依偏好順序取第一個支援的語系', () => {
    expect(
      resolveDeviceLanguage([
        { languageCode: 'ja', regionCode: 'JP' },
        { languageCode: 'en', regionCode: 'US' },
        { languageCode: 'zh', regionCode: 'TW' },
      ]),
    ).toBe('en');
  });

  it('沒有支援語系或 languageCode 為 null 時回到 zh-TW', () => {
    expect(resolveDeviceLanguage([{ languageCode: 'ja' }, { languageCode: null }])).toBe('zh-TW');
    expect(resolveDeviceLanguage([])).toBe('zh-TW');
  });
});

describe('isAppLanguage', () => {
  it('只接受支援語系字串', () => {
    expect(isAppLanguage('en')).toBe(true);
    expect(isAppLanguage('zh-TW')).toBe(true);
    expect(isAppLanguage('zh')).toBe(false);
    expect(isAppLanguage(1)).toBe(false);
  });
});
