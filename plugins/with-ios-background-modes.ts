import { type ConfigPlugin, withInfoPlist } from 'expo/config-plugins.js'; // 帶 .js：eas-cli 以 Node 原生 ESM 載入本檔

/**
 * App 沒有用到 Background Fetch，但 expo-task-manager 的 plugin 會無條件加上 `fetch`。宣告用不到的背景模式
 * 會被審查追問（App Store 2.5.4），所以在這裡刪掉；背景定位（導航、SOS）與背景音訊（導航語音）照常保留。
 * mod 是「越晚註冊越早執行」：app.config.ts 把本 plugin 放在清單最前面，才會在 expo-task-manager 之後執行。
 */
const UNUSED_BACKGROUND_MODES = ['fetch'];

const withIosBackgroundModes: ConfigPlugin = (config) =>
  withInfoPlist(config, (mod) => {
    const modes = mod.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) {
      mod.modResults.UIBackgroundModes = modes.filter((mode) => !UNUSED_BACKGROUND_MODES.includes(mode));
    }
    return mod;
  });

export default withIosBackgroundModes;
