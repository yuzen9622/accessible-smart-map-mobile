/**
 * `AuthPort`：`shared/api` 對外的認證注入介面（SDD §4.3 AuthPort 列）。
 *
 * Web 版 `fetch.ts` 直接耦合 `useAuthStore`／`authRefresh.ts`（single-flight
 * refresh coordinator）；本 repo 依 ADR-01／§4.1 規則，`shared/api` 不得
 * import feature 內部檔案，因此把「拿 session」「觸發 refresh」「登出
 * （compare-and-commit）」三個動作抽成 port，由 `features/auth` 在 Phase 3
 * 實作並以 `configureAuthPort` 注入。single-flight 協調（同一身分併發請求
 * 只觸發一次 refresh）留在 auth feature 內實作，`shared/api/fetch.ts` 只負責
 * 呼叫 `port.refresh(captured)` 並信任回傳結果。
 */

export interface AuthSession {
  accessToken: string;
}

export interface AuthPort {
  /** 目前的 session（object identity 用於下面兩個方法的 compare-and-commit）。 */
  getSession(): AuthSession | null;
  /**
   * 觸發一次 token 更新。`captured` 是呼叫端在發起這次 refresh 之前擷取的
   * session 參照，實作可用它判斷身分是否在 refresh 期間被替換（ABA）。
   * 回傳新的 access token；genuine failure 或身分已變動一律回傳 `null`。
   */
  refresh(captured: AuthSession | null): Promise<string | null>;
  /**
   * Compare-and-commit：只有當目前 session 仍與 `captured` 相同（object
   * identity）時才清除，避免清掉已經被別的 refresh／relogin 換掉的 session。
   */
  invalidateSession(captured: AuthSession | null): void;
}

/**
 * 預設的匿名 stub port：沒有 token、refresh 恆回傳 `null`、invalidateSession
 * 為 no-op。在 `configureAuthPort` 被呼叫（Phase 3 由 `features/auth` 注入
 * 真正實作）之前，所有需要驗證的請求都會直接視為未登入。
 */
export const anonymousAuthPort: AuthPort = {
  getSession() {
    return null;
  },
  async refresh() {
    return null;
  },
  invalidateSession() {
    // no-op：沒有 session 可清
  },
};

let currentAuthPort: AuthPort = anonymousAuthPort;

/** 由 `features/auth` 在啟動時呼叫一次，注入真正的 session／refresh 實作。 */
export function configureAuthPort(port: AuthPort): void {
  currentAuthPort = port;
}

/** 測試專用：把 port 還原成匿名 stub，避免測試之間互相汙染全域狀態。 */
export function resetAuthPortForTests(): void {
  currentAuthPort = anonymousAuthPort;
}

export function getAuthPort(): AuthPort {
  return currentAuthPort;
}
