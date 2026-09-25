/**
 * API 回應型別，移植自 Web `src/types/response.d.ts`（commit 5eadc71）。
 * 後端普遍以 `status`／`code`／`message` 為主要判斷欄位，`ok`／`success`
 * 是舊版相容欄位，兩者只要任一為 true 即視為成功（見 fetch.ts `isApiResponse`
 * 呼叫端的 `isSuccess` 判斷）。
 */
export interface ApiResponse<T> {
  ok?: boolean;
  success?: boolean;
  status: 'success' | 'error';
  code: number;
  message: string;
  data?: T;
  accessToken?: string;
  refreshToken?: string;
}

function hasStringProp(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === 'string';
}

function hasNumberProp(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === 'number';
}

/**
 * `unknown` 收窄用的 type guard：只驗證 `ApiResponse<T>` 的必要欄位
 * （`status`、`code`、`message`），不驗證 `data` 的形狀——`data` 型別由
 * 呼叫端自行以 schema 或更細的 guard 再收窄一次。
 */
export function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (!hasStringProp(candidate, 'status')) {
    return false;
  }
  if (candidate.status !== 'success' && candidate.status !== 'error') {
    return false;
  }
  if (!hasNumberProp(candidate, 'code')) {
    return false;
  }
  if (!hasStringProp(candidate, 'message')) {
    return false;
  }
  return true;
}
