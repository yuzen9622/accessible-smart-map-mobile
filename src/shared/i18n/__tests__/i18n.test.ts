import i18n from '..';

describe('i18n 初始化', () => {
  it('同步完成初始化並可切換語系', async () => {
    expect(i18n.isInitialized).toBe(true);
    await i18n.changeLanguage('zh-TW');
    expect(i18n.t('settingTitle')).toBe('設定');
    await i18n.changeLanguage('en');
    expect(i18n.t('settingTitle')).not.toBe('settingTitle');
  });

  it('英文複數 key 可由 count 選出', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('transferCount', { count: 1 })).not.toBe(i18n.t('transferCount', { count: 2 }));
  });
});
