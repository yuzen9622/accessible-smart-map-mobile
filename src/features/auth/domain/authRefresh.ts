import type { UserDTO } from './types';

/**
 * Single-flight、以 session 身分為範圍的 token refresh 協調層。
 * 逐行移植自 Web `src/lib/authRefresh.ts`（commit f82cda8），不變量（SDD §6.10）：
 *
 * - 同一身分併發請求只有一條 refresh lane；lane 的 join／create 判斷在同一段同步程式碼內完成
 *   （讀 `inFlight` 與安裝 lane 之間沒有 `await`），JS run-to-completion 讓它天然原子。
 * - refresh 進行中身分被換掉（登出、登出後重新登入的 ABA）時，結果一律丟棄、不提交也不清除別人的 session。
 * - `invalidateSession` 是 compare-and-commit：只有目前 session 仍是同一個參照時才清。
 *
 * 與 Web 的差異（見 port-ledger）：
 * - Web 靜態 import `authTransport.requestRefresh`（cookie）；本 repo domain 不得碰網路，transport
 *   連同 state 一起由 `configureAuthState` 注入。
 * - 原生 refresh 走 body 傳 refresh token（後端 B-01，`X-Client: mobile`），且後端會輪替 refresh token，
 *   成功時要把新的 refresh token 一起提交。
 * - Web 的 transport 失敗一律清 session（cookie 還在，重新整理就能恢復）；原生清 session 會連同
 *   Keychain 的 refresh token 一起刪掉，所以把失敗拆成兩種：`rejected`（伺服器明確拒絕 → 照 Web 清除）
 *   與 `unavailable`（斷網、逾時、5xx、限流 → 不動 session，回傳 null，下一個請求再試）。
 */

export interface AuthSession {
  accessToken: string;
  /** 原生管道的 refresh token（B-01）。登入失效後的 `{ accessToken: '' }` 沒有這個欄位。 */
  refreshToken?: string;
}

export type RefreshOutcome =
  | { kind: 'ok'; accessToken: string; refreshToken?: string; user?: UserDTO }
  | { kind: 'rejected' }
  | { kind: 'unavailable' };

export interface AuthStatePort {
  getSession(): AuthSession | null;
  setSession(session: AuthSession): void;
  /** refresh 成功時後端會一併回傳最新的使用者資料；失效時傳 null。 */
  setUser(user: UserDTO | null): void;
  /** 打 refresh 端點；不得經過會觸發 401-refresh 的 `fetchRequest`。 */
  requestRefresh(session: AuthSession | null): Promise<RefreshOutcome>;
}

let authStatePort: AuthStatePort | null = null;

/** 由 auth store 在建立後註冊一次；測試可重新註冊。 */
export function configureAuthState(port: AuthStatePort | null): void {
  authStatePort = port;
}

interface RefreshLane {
  /** 這條 lane 為哪個 session 身分（object reference）而開。 */
  sessionAtStart: AuthSession | null;
  promise: Promise<string | null>;
}

let inFlight: RefreshLane | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (!authStatePort) {
    console.error('[authRefresh] configureAuthState was never called; refreshAccessToken resolving null');
    return null;
  }
  const port = authStatePort;

  for (;;) {
    const existing = inFlight;
    const cur = port.getSession();

    if (!existing) {
      const sessionAtStart = cur;
      const lane: RefreshLane = {
        sessionAtStart,
        promise: runRefresh(port, sessionAtStart),
      };
      inFlight = lane;
      const clearLane = async () => {
        try {
          await lane.promise;
        } catch {
          // runRefresh 不會 reject；這裡只負責清 lane
        }
        if (inFlight === lane) {
          inFlight = null;
        }
      };
      void clearLane();
      return lane.promise;
    }

    if (existing.sessionAtStart === cur) {
      // 與進行中的 lane 同一身分——加入它。
      return existing.promise;
    }

    // 有 lane 在跑，但屬於另一個身分：與我們無關。等它結束（忽略結果）再重新檢查——這讓 N 個新身分
    // 呼叫端在舊 lane 清掉後合併成一條新 lane，等待期間身分又換（B -> C）也由下一次迴圈處理。
    try {
      await existing.promise;
    } catch {
      // 忽略
    }
  }
}

async function runRefresh(port: AuthStatePort, sessionAtStart: AuthSession | null): Promise<string | null> {
  let outcome: RefreshOutcome;
  try {
    outcome = await port.requestRefresh(sessionAtStart);
  } catch {
    outcome = { kind: 'unavailable' };
  }

  if (port.getSession() !== sessionAtStart) {
    // transport 期間身分已變（登出、登出後重新登入的 ABA、或被其他來源換掉）。
    // 不提交也不清除別人的 session；所有等待者都拿到 null。
    return null;
  }

  if (outcome.kind === 'ok') {
    port.setSession({
      accessToken: outcome.accessToken,
      refreshToken: outcome.refreshToken ?? sessionAtStart?.refreshToken,
    });
    if (outcome.user) port.setUser(outcome.user);
    return outcome.accessToken;
  }

  if (outcome.kind === 'unavailable') {
    // 原生專屬：暫時性失敗不清 session（見檔頭）。
    return null;
  }

  // 同一身分、伺服器明確拒絕——對齊 Web：清 session 與 user。
  // 明確清掉 refresh token：store 的 setSession 是合併，不寫就會留著已被伺服器拒絕的舊 token 重送。
  port.setSession({ accessToken: '', refreshToken: undefined });
  port.setUser(null);
  return null;
}

/**
 * Compare-and-invalidate：只有目前 session 仍是傳入的同一個參照才清除。`fetch.ts` 在 retry 後仍 401、
 * 或收到 403（伺服器撤銷）時使用，確保期間被登出／重新登入／其他 refresh 換掉的 session 不會被誤清。
 */
export function invalidateSession(sessionRef: AuthSession | null): void {
  if (!authStatePort) {
    return;
  }
  if (authStatePort.getSession() === sessionRef) {
    authStatePort.setSession({ accessToken: '', refreshToken: undefined });
    authStatePort.setUser(null);
  }
}

/** 測試專用：清掉殘留的 lane。 */
export function resetRefreshLaneForTests(): void {
  inFlight = null;
}
