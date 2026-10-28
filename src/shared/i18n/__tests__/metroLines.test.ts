import en from '../locale/en/translation.json';
import zh from '../locale/zh-TW/translation.json';

// 與後端 src/config/metro-lines.ts 的 lineKey 一致；後端新增線別時兩邊要一起補。
const LINE_KEYS = ["TRTC_BL","TRTC_R","TRTC_G","TRTC_O","TRTC_BR","TRTC_R_R-3","TRTC_G_G-3","TRTCMG_MK","NTMC_Y","NTMC_LB","TYMC_A","NTDLRT_V","NTDLRT_V_V-1","NTDLRT_V_V-2","NTALRT_K","KRTC_O","KRTC_R","TMRT_G","KLRT_C"];

it.each([['en', en], ['zh-TW', zh]] as const)('%s translates every backend metro line label', (_lang, messages) => {
  expect(Object.keys(messages.metroLines)).toEqual(LINE_KEYS);
  for (const name of Object.values(messages.metroLines)) expect(name.trim()).not.toBe('');
});
