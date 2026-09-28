/**
 * 重算請求的 `clientRequestId`（後端以它做冪等重播）。格式為 RFC 4122 v4 UUID。
 * Web 用 `crypto.randomUUID()`；Hermes 不保證提供，這裡有 `crypto.getRandomValues` 就用，
 * 沒有才退回 `Math.random`（它只需要在同一個導航 session 內唯一，不是安全用途）。
 */
export function createClientRequestId(random: (bytes: Uint8Array) => void = defaultRandom): string {
  const bytes = new Uint8Array(16);
  random(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function defaultRandom(bytes: Uint8Array): void {
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
    return;
  }
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
}
