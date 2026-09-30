// 測試用翻譯器：載入 zh-TW 字串表並做 `{{name}}` 插值，讓從 Web 搬來的中文斷言可以原封不動通過。
// （不走 i18next：domain 測試要在 node 下跑、不依賴 i18n 實例；複數規則不在此驗，zh-TW 沒有複數。）
import zhTW from '../../../../shared/i18n/locale/zh-TW/translation.json';

import type { Translate } from '../types';

const table: Record<string, unknown> = zhTW;

export const t: Translate = (key, options) => {
  const template = table[key];
  if (typeof template !== 'string') throw new Error(`missing zh-TW i18n key: ${key}`);
  return template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(options?.[name] ?? ''));
};
