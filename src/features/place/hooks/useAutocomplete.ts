import { useEffect, useRef, useState } from 'react';

import { useAppTranslation } from '@/shared/i18n';

import { getPlaceAutocomplete } from '../api/placeSearch';
import { toApiLang } from '../domain/lang';
import { createSearchSessionToken } from '../domain/searchSession';
import type { AutocompleteItem } from '../types/place';

/**
 * 移植自 Web `src/hook/usePlacePredictions.ts`（commit 5eadc71）。
 * - debounce 400ms；每次輸入變動都用新的 `AbortController` 取消前一個請求。
 * - 沒有最小字數限制，只要 `trim()` 非空就會查詢。
 * - session token 用 `useState` 惰性初始化建立，查詢字串清空時自動換新，
 *   選定地點後由呼叫端顯式呼叫 `resetSession()`（對齊 Web `PlaceInput.tsx:227`，
 *   在 `getPlaceDetails` resolve 後才換）。用 `sessionTokenRef` 只是為了讓
 *   debounce 計時器觸發當下能讀到「呼叫當下」最新的 token（即使呼叫端在
 *   計時器排程後、觸發前呼叫了 `resetSession()`），render 過程本身不讀
 *   ref（避免 `react-hooks/refs` 規則：ref 只在 effect／callback 內讀寫）。
 * - `limit: 8` 寫死；`lang` 由 `toApiLang(i18n.language)` 推導。
 */
export function useAutocomplete(query: string, location?: { lat: number; lng: number }) {
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { i18n } = useAppTranslation();
  const lang = toApiLang(i18n.language);
  const [sessionToken, setSessionToken] = useState<string>(() => createSearchSessionToken());
  const sessionTokenRef = useRef(sessionToken);

  useEffect(() => {
    sessionTokenRef.current = sessionToken;
  }, [sessionToken]);

  const resetSession = () => {
    setSessionToken(createSearchSessionToken());
  };

  useEffect(() => {
    const trimmed = query.trim();
    const controller = new AbortController();

    const handler = setTimeout(() => {
      void (async () => {
        if (!trimmed) {
          setSuggestions([]);
          setLoading(false);
          // 直接用 state setter（穩定），不透過 resetSession，effect 才不必依賴每次 render 的新函式
          setSessionToken(createSearchSessionToken());
          return;
        }
        setLoading(true);
        try {
          const res = await getPlaceAutocomplete(
            {
              q: trimmed,
              sessiontoken: sessionTokenRef.current,
              lat: location?.lat,
              lng: location?.lng,
              limit: 8,
              lang,
            },
            controller.signal,
          );
          if (!controller.signal.aborted) {
            setSuggestions(res.data ?? []);
          }
        } catch {
          if (!controller.signal.aborted) setSuggestions([]);
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }, trimmed ? 400 : 0);

    return () => {
      clearTimeout(handler);
      controller.abort();
    };
  }, [query, lang, location?.lat, location?.lng]);

  return { suggestions, loading, sessionToken, resetSession };
}
