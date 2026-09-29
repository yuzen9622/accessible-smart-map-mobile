/**
 * 與後端 Zod 規則一致，讓前端在送出前就擋掉明顯不合法的密碼（後端仍會再驗證）。
 * 移植自 Web `src/lib/passwordValidation.ts`（commit f82cda8）。
 * 差異：Web 直接回傳中文訊息；本 repo 有中英語系，改回傳錯誤碼，由 UI 以 `nativeAuth.password.*` 翻譯。
 */
const MAX_PASSWORD_BYTES = 72; // bcrypt 的硬上限，超過會被默默截斷。

export type PasswordError = 'tooShort' | 'tooLong' | 'needsLetterAndDigit';

export function validatePassword(password: string): PasswordError | null {
  if (password.length < 8) {
    return 'tooShort';
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return 'tooLong';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'needsLetterAndDigit';
  }
  return null;
}

/** 與 Web 註冊表單相同的寬鬆 email 檢查（完整驗證交給後端）。 */
export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
