import { type ConfigPlugin, withEntitlementsPlist } from 'expo/config-plugins.js'; // 帶 .js：eas-cli 以 Node 原生 ESM 載入本檔

/** 免費 Apple ID（Personal Team）不支援的 entitlement。 */
const UNSUPPORTED_ENTITLEMENTS = [
  'aps-environment',
  'com.apple.developer.applesignin',
  'com.apple.security.application-groups',
];

/**
 * 真機測試用（`IOS_FREE_SIGNING=1` 時由 app.config.ts 加在 plugin 清單最前面）：刪掉免費帳號簽不了的 entitlement。
 * expo-notifications／expo-apple-authentication 是 Expo 自動套用的預設 plugin，從清單移除也還會加回來，
 * 所以只能在 entitlements 階段刪。mod 是「越晚註冊越早執行」，放在最前面才會最後執行、蓋過它們。
 */
const withFreeSigning: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (mod) => {
    for (const key of UNSUPPORTED_ENTITLEMENTS) delete mod.modResults[key];
    return mod;
  });

export default withFreeSigning;
