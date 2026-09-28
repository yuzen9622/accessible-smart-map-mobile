/**
 * 移植自 Web `src/lib/place/lang.ts`（commit 5eadc71，逐行搬移）。
 *
 * 把 App／i18n 的語言標籤對應到 place-search 端點接受的 `lang` 值。
 * 後端 schema 只接受 `zh-*`／`en-*`，**其餘一律 400 而非退回中文**，所以
 * 未預期的值（例如偵測到 "ja"）回傳 `undefined`，讓呼叫端省略該參數——
 * 後端會把「沒帶 lang」視為 zh-TW，這比送出後端不認得的值安全。
 */
export function toApiLang(language?: string): 'zh-TW' | 'en' | undefined {
  if (!language) return undefined;
  const tag = language.toLowerCase();
  if (tag === 'zh' || tag.startsWith('zh-')) return 'zh-TW';
  if (tag === 'en' || tag.startsWith('en-')) return 'en';
  return undefined;
}
