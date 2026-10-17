import { ApiError } from './fetch';

/** 後端發布前文字過濾（App Store 1.2）擋下評論／回報描述時，驗證錯誤 `errors[].message` 的固定值。 */
export const OBJECTIONABLE_CONTENT = 'OBJECTIONABLE_CONTENT';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 400 `VALIDATION_FAILED` 的 `data.errors` 裡有任一欄位被判定為不當內容。 */
export function isObjectionableContentError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.reason !== 'VALIDATION_FAILED' || !isRecord(error.data)) return false;
  const issues = error.data.errors;
  return Array.isArray(issues) && issues.some((issue) => isRecord(issue) && issue.message === OBJECTIONABLE_CONTENT);
}
