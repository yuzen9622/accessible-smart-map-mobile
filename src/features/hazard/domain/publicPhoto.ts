/** DTO 的相對路徑以後端 origin 為基準；只接受同一後端的公開 bytes 入口。 */
export function resolvePublicPhotoUrl(value: string | null | undefined, apiBaseUrl: string): string | null {
  if (!value?.trim()) return null;
  try {
    const backend = new URL(apiBaseUrl);
    const url = new URL(value, `${backend.origin}/`);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.origin !== backend.origin || url.username || url.password) return null;
    if (!/^\/api\/v1\/a11y\/reports\/[^/]+\/photo\/public$/.test(url.pathname) || url.search || url.hash) return null;
    return url.href;
  } catch {
    return null;
  }
}
