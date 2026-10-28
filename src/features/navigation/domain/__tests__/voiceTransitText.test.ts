import en from '@/shared/i18n/locale/en/translation.json';
import zh from '@/shared/i18n/locale/zh-TW/translation.json';

import { voiceTransitLine } from '../voiceTransitText';

const translator = (messages: unknown) => (key: string, options?: Record<string, string | number>) => {
  const found = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);
  const text = typeof found === 'string' ? found : String(options?.defaultValue ?? key);
  return text.replace(/{{(\w+)}}/g, (_, name: string) => String(options?.[name] ?? ''));
};

const leg = {
  mode: 'METRO' as const, from: '市政府', to: '台北車站', routeName: '板南線', terminalStation: '頂埔',
  lineKey: 'TRTC_BL', fromNameEn: 'Taipei City Hall', toNameEn: 'Taipei Main Station', terminalNameEn: 'Dingpu',
};

it('follows the current UI language for line, terminal and stations', () => {
  expect(voiceTransitLine(leg, 'en', translator(en))).toBe('Bannan Line · toward Dingpu · Taipei City Hall → Taipei Main Station');
  expect(voiceTransitLine(leg, 'zh-TW', translator(zh))).toBe('板南線・往頂埔 · 市政府 → 台北車站');
});

it('keeps source names when English is missing and omits 往 without a terminal', () => {
  const bare = { mode: 'METRO' as const, from: '市政府', to: '台北車站', routeName: '板南線' };
  expect(voiceTransitLine(bare, 'en', translator(en))).toBe('板南線 · 市政府 → 台北車站');
  expect(voiceTransitLine({ mode: 'BUS', from: '甲站', to: '乙站', routeName: '307' }, 'en', translator(en))).toBe('307 · 甲站 → 乙站');
});
