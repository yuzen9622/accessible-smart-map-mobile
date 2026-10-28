import type { Translate } from './transitCopy';
import type { VoiceTransit } from './types';

/**
 * 語音乘車中 HUD 的一行字：線名用後端的線別標籤翻譯，站名依「目前」介面語言在原文與來源英文名之間選，
 * 不沿用任何舊語系的 display 字。沒有終點就只顯示線名。
 */
export function voiceTransitLine(leg: NonNullable<VoiceTransit['leg']>, language: 'en' | 'zh-TW', t: Translate): string {
  const pick = (source: string, english: string | undefined) => (language === 'en' && english?.trim()) || source;
  const line = leg.lineKey ? t(`metroLines.${leg.lineKey}`, { defaultValue: leg.routeName ?? '' }) : leg.routeName;
  const route = leg.terminalStation?.trim()
    ? t('metroLineToward', { line: line ?? '', terminal: pick(leg.terminalStation, leg.terminalNameEn) })
    : line;
  return [route, `${pick(leg.from, leg.fromNameEn)} → ${pick(leg.to, leg.toNameEn)}`].filter(Boolean).join(' · ');
}
