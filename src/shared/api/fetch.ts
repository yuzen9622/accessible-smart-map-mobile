import { getAppConfig } from '@/shared/config';

import { getAuthPort, type AuthSession } from './auth-port';
import { isApiResponse, type ApiResponse } from './types';

/**
 * 移植自 Web `src/lib/fetch.ts`（commit `5eadc71`）。行為刻意逐條對齊：
 * 401 → refresh 一次 → retry 一次；403 視為伺服器端撤銷，立即失效不 refresh；
 * `skipAuthRetry` 讓「用 401 表示業務錯誤」的端點（如改密碼打錯目前密碼）
 * 略過 refresh-retry；205／`data: null` 視為成功。
 *
 * 與 Web 版的差異（見 port-ledger）：
 * - 認證狀態改由注入的 `AuthPort`（`./auth-port.ts`）提供，取代 Web 直接耦合
 *   `useAuthStore`／`authRefresh.ts` 的 single-flight coordinator；single-flight
 *   本身留給 Phase 3 `features/auth` 的 `AuthPort.refresh` 實作。
 * - 拿掉 Web 版以 `sonner` toast 提示「登入已過期」的呼叫：`shared/api` 不依賴
 *   UI 層，是否提示交由呼叫端（未來 auth feature）依 `authenticatedRequest`
 *   的回傳值自行處理。
 * - 新增「非 JSON 錯誤本文」的容錯：Web 版對 204／205 以外的回應直接
 *   `response.json()`，非 JSON body 會讓整個 promise 以 SyntaxError reject；
 *   本版改為以 HTTP 狀態碼合成一個等價的 `ApiResponse` envelope，因為原生
 *   網路環境（代理、閘道）更容易回傳非 JSON 錯誤頁。
 */

export interface RequestOptions<TBody = unknown> {
  method?: string;
  body?: TBody;
  headers?: Record<string, string>;
  requireAuth?: boolean;
  signal?: AbortSignal;
  /** Mutation owner fence, checked before sending and around refresh/retry. */
  isCurrent?: () => boolean;
  /**
   * 有些需要登入的端點把 401 挪用為業務錯誤（例：POST /user/auth/password
   * 「目前密碼錯誤」），設定這個旗標讓呼叫端自行檢查回應，不要觸發
   * refresh-retry-then-invalidate-session（否則打錯密碼會被登出）。
   */
  skipAuthRetry?: boolean;
  /** 測試專用：覆寫這次請求要打的 base URL；預設 `getAppConfig().apiBaseUrl`。 */
  baseUrl?: string;
  /**
   * 逾時（毫秒，含讀取 body）。預設一般請求 20 秒、上傳（FormData）60 秒；0 表示不設逾時。
   * 弱網路下 fetch 不會自己放棄，沒有逾時就會一直轉圈。
   */
  timeoutMs?: number;
}

export const DEFAULT_TIMEOUT_MS = 20_000;
export const UPLOAD_TIMEOUT_MS = 60_000;
/** 逾時以 `ApiError(code 408, reason REQUEST_TIMEOUT)` 拋出，與呼叫端自行 abort（原樣拋 AbortError）區分。 */
export const REQUEST_TIMEOUT_REASON = 'REQUEST_TIMEOUT';

/**
 * 本模組 401-retry 遞迴專用的內部旗標，不對外開放。
 */
interface InternalRequestOptions<TBody = unknown> extends RequestOptions<TBody> {
  __retried?: boolean;
}

export class ApiError extends Error {
  code: number;
  reason?: string;
  /**
   * 錯誤信封原始的 `data` 欄位——例如 400 的
   * `{ errors: [{ path, message }] }` 欄位驗證清單，頂層 `message`／`reason`
   * 承載不了這些細節。
   */
  data?: unknown;

  constructor(message: string, code: number, reason?: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.reason = reason;
    this.data = data;
  }
}

function extractReason(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const reason = (data as Record<string, unknown>).reason;
  return typeof reason === 'string' ? reason : undefined;
}

function syntheticEnvelope(response: Response, message: string): ApiResponse<unknown> {
  return {
    ok: response.ok,
    status: response.ok ? 'success' : 'error',
    code: response.status,
    message,
  };
}

async function parseResponseBody(response: Response): Promise<ApiResponse<unknown>> {
  // 204／205 本身沒有 body；某些端點（例：DELETE emergency-contacts）也用
  // 205 + 空 body 表示成功，呼叫 response.json() 會丟
  // "Unexpected end of JSON input"，所以直接以 HTTP 狀態合成信封。
  const hasBody = response.status !== 204 && response.status !== 205;
  if (!hasBody) {
    return syntheticEnvelope(response, response.statusText);
  }
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return syntheticEnvelope(response, response.statusText || 'Invalid JSON response body');
  }
  if (isApiResponse(parsed)) {
    return parsed;
  }
  return syntheticEnvelope(response, response.statusText || 'Unexpected response body shape');
}

/**
 * 403 有兩種意思：認證 middleware 的撤銷（token 無效、tokenVersion 變動、session 被撤銷；訊息 `Forbidden`、
 * 沒有 `data.reason`），與業務上的權限不足（`NOT_SESSION_OWNER`、`NOT_CONTACT_OWNER`、改別人的評論…）。
 * Web 版任何 403 都登出；原生只在前者登出，否則例如 SOS 復原查到上一個帳號的 session 會把現在的帳號登出。
 */
function isRevocation403(data: ApiResponse<unknown>): boolean {
  return extractReason(data.data) === undefined && data.message.trim().toLowerCase() === 'forbidden';
}

/** 給不經 `fetchRequest` 的直接 fetch（例：auth refresh）用：拿到回應標頭前逾時就 abort（拋錯）。 */
export async function timedFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** 呼叫端的 signal 與逾時合併成一個 signal；逾時才轉成 `ApiError`，呼叫端 abort 照原樣拋出。 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<ApiResponse<unknown>> {
  if (timeoutMs <= 0) {
    const response = await fetch(url, signal ? { ...init, signal } : init);
    return parseResponseBody(response);
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', forwardAbort);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return await parseResponseBody(response);
  } catch (error) {
    if (timedOut) throw new ApiError('Request timed out', 408, REQUEST_TIMEOUT_REASON);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

export function getAccessToken(): string | undefined {
  return getAuthPort().getSession()?.accessToken;
}

export async function fetchRequest<TBody = unknown>(
  url: string,
  options: RequestOptions<TBody> = {},
): Promise<ApiResponse<unknown>> {
  const {
    method = 'GET',
    body,
    headers = {},
    requireAuth = false,
    signal,
    isCurrent,
    skipAuthRetry = false,
    baseUrl,
    timeoutMs,
    __retried,
  } = options as InternalRequestOptions<TBody>;

  const assertCurrent = () => {
    if (isCurrent && !isCurrent()) throw new ApiError('Request superseded', 409, 'REQUEST_SUPERSEDED');
  };
  assertCurrent();
  const authPort = getAuthPort();
  // 在這次呼叫（原始呼叫或 retry）最開始、任何 await 之前擷取，是
  // retry-still-401 分支 compare-and-commit 失效時比對用的參照。
  const sessionAtEntry: AuthSession | null = authPort.getSession();

  const resolvedUrl = /^https?:\/\//.test(url)
    ? url
    : `${baseUrl ?? getAppConfig().apiBaseUrl}${url}`;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const requestHeaders: Record<string, string> = {
    // multipart 的 boundary 要由 fetch 自己產生，不能手動設 Content-Type
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    // 後端 B-01：`/api/v1/user/*` 看到 `X-Client: mobile` 才走原生傳輸（token 放 body、不發 cookie、
    // 不做瀏覽器 CSRF 的 Origin 檢查）；其他路由忽略這個 header。
    'X-Client': 'mobile',
    ...headers,
  };
  if (requireAuth) {
    // 與 Web 版一致：即使沒有 token 也會設定 Authorization header
    // （`Bearer undefined`），交由後端回 401 觸發 refresh-retry。
    requestHeaders.Authorization = `Bearer ${sessionAtEntry?.accessToken}`;
  }

  const init: RequestInit = {
    method,
    headers: requestHeaders,
  };
  if (body !== undefined) {
    init.body = isFormData ? (body as FormData) : JSON.stringify(body);
  }
  const timeout = timeoutMs ?? (isFormData ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
  const data = await fetchWithTimeout(resolvedUrl, init, signal, timeout);
  assertCurrent();
  const isSuccess = data.ok === true || data.success === true;

  if (!isSuccess && data.code === 403 && requireAuth && isRevocation403(data)) {
    // 伺服器端撤銷（例如 tokenVersion 變動）：refresh 也一定失敗，直接失效，
    // 不留在「已登入但一直 403」的狀態。
    authPort.invalidateSession(sessionAtEntry);
    throw new ApiError(
      data.message || 'Fetch error',
      data.code,
      extractReason(data.data),
      data.data,
    );
  }

  if (!isSuccess && data.code !== 401) {
    throw new ApiError(
      data.message || 'Fetch error',
      data.code,
      extractReason(data.data),
      data.data,
    );
  }

  if (data.code === 401 && requireAuth && !skipAuthRetry) {
    assertCurrent();
    if (__retried) {
      // 已經 refresh 過並 retry 過一次——不再遞迴，以呼叫當下擷取的
      // sessionAtEntry 做 compare-and-commit 失效，把 401 原樣回傳。
      authPort.invalidateSession(sessionAtEntry);
      return data;
    }
    const newAccessToken = await authPort.refresh(sessionAtEntry);
    assertCurrent();
    if (newAccessToken) {
      // port 已把新 token 提交進 session，retry 呼叫的 requireAuth 區塊會
      // 透過 getSession() 讀到新值並設定新的 Authorization header。
      return fetchRequest(url, {
        method,
        body,
        headers,
        requireAuth,
        signal,
        skipAuthRetry,
        isCurrent,
        baseUrl,
        timeoutMs,
        __retried: true,
      } as InternalRequestOptions<TBody>);
    }
    // newAccessToken 為 null：可能是真的 refresh 失敗，也可能是身分已在
    // refresh 期間被換掉（登出、或登出後重新登入的 ABA）——兩種都不該由
    // 這裡處理成錯誤，直接把 401 回傳給呼叫端。
  }

  return data;
}

export async function authenticatedRequest<TBody = unknown>(
  url: string,
  options: Omit<RequestOptions<TBody>, 'requireAuth'> = {},
): Promise<ApiResponse<unknown>> {
  return fetchRequest(url, { ...options, requireAuth: true });
}
