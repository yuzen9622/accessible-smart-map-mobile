import { parseAppConfig } from '../appConfig';

describe('parseAppConfig', () => {
  const valid = {
    EXPO_PUBLIC_END_POINT: 'https://map-dev.yuzen.dev/',
    EXPO_PUBLIC_SHARE_BASE_URL: 'https://map.yuzen.dev',
  };

  it('去掉結尾斜線，Google client ID 缺值時為 null', () => {
    expect(parseAppConfig(valid)).toEqual({
      ok: true,
      config: {
        apiBaseUrl: 'https://map-dev.yuzen.dev',
        shareBaseUrl: 'https://map.yuzen.dev',
        googleWebClientId: null,
        googleIosClientId: null,
        privacyPolicyUrl: null,
        termsUrl: null,
      },
    });
  });

  it('隱私權政策／服務條款網址只接受 https，其他視為未設定（不擋啟動）', () => {
    const result = parseAppConfig({
      ...valid,
      EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://map.yuzen.dev/privacy',
      EXPO_PUBLIC_TERMS_URL: 'http://insecure.example/terms',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.privacyPolicyUrl).toBe('https://map.yuzen.dev/privacy');
      expect(result.config.termsUrl).toBeNull();
    }
  });

  it('缺必要變數時回報錯誤，不給預設值', () => {
    const result = parseAppConfig({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('EXPO_PUBLIC_END_POINT');
    }
  });

  it('拒絕非 URL 與非 http(s) 協定', () => {
    expect(parseAppConfig({ ...valid, EXPO_PUBLIC_END_POINT: 'map-dev.yuzen.dev' }).ok).toBe(false);
    expect(parseAppConfig({ ...valid, EXPO_PUBLIC_SHARE_BASE_URL: 'ftp://map.yuzen.dev' }).ok).toBe(
      false,
    );
  });

  it('空白字串視為未設定', () => {
    expect(parseAppConfig({ ...valid, EXPO_PUBLIC_END_POINT: '   ' }).ok).toBe(false);
  });
});
