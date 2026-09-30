// 測試用翻譯器：讀 zh-TW 字串表，支援巢狀 key（`chatbot.voice.statusIdle`）與 `{{name}}` 插值。
// 放在 `testing/` 而非 `__tests__/`，因 jest 會把 `__tests__` 下所有檔當測試套件執行。
import zhTW from '../../../../shared/i18n/locale/zh-TW/translation.json';

import type { Translate } from '@/features/ai/domain';

function lookup(key: string): string | undefined {
  let node: unknown = zhTW;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return undefined;
    node = Object.entries(node).find(([k]) => k === part)?.[1];
  }
  return typeof node === 'string' ? node : undefined;
}

export const t: Translate = (key, options) => {
  const template = lookup(key);
  if (template === undefined) throw new Error(`missing zh-TW i18n key: ${key}`);
  return template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(options?.[name] ?? ''));
};
