/**
 * 把 `UserDTO.avatar` 轉成 `<Image>` 能載入的網址。後端自己存的頭像是相對路徑
 * （`/api/v1/avatars/...`，以 API origin 為基準）；Google 登入帶來的是絕對網址；
 * 換頭像上傳中的本機預覽是 `file://`。其他形狀一律不載入。
 */
export function resolveAvatarUrl(value: string | null | undefined, apiBaseUrl: string): string | null {
  if (!value?.trim()) return null;
  try {
    if (value.startsWith('/')) {
      if (!value.startsWith('/api/v1/avatars/')) return null;
      return new URL(value, `${new URL(apiBaseUrl).origin}/`).href;
    }
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'file:' ? url.href : null;
  } catch {
    return null;
  }
}
