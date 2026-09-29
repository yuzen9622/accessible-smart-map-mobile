/**
 * 發起者自己的進行中 SOS：跨重啟保存 session id，移植自 Web `src/lib/sosSession.ts`（commit f82cda8）。
 *
 * 只存 id（與原生新增的 shareToken），開機時一定以 `GET /sessions/:id` 重新驗證——**是否仍進行中以伺服器為準**
 * （SDD §6.8 必守不變量）；超過 12 小時的舊紀錄不再復原。
 * 差異：Web 讀寫 localStorage；本 repo domain 不碰原生模組，儲存與時鐘由呼叫端注入（MMKV）。
 */

export const SOS_STORAGE_KEY = 'sos.activeSession';
export const SOS_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface SosStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): boolean | void;
}

export interface StoredSos {
  sessionId: string;
  shareToken: string | null;
  /** 發起者帳號；同一台裝置換帳號登入時不得拿別人的 session 去復原（會 403）。 */
  ownerId: string | null;
  /** 使用者按了解除但沒送到伺服器：下次啟動重送，否則家人會一直看到求救中。 */
  resolvePending: boolean;
  savedAt: number;
}

export function saveActiveSos(
  storage: SosStorage,
  sessionId: string,
  shareToken: string | null,
  ownerId: string | null,
  now: number = Date.now(),
): void {
  try {
    const payload: StoredSos = { sessionId, shareToken, ownerId, resolvePending: false, savedAt: now };
    storage.set(SOS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 儲存失敗時只是不能復原
  }
}

export function loadActiveSos(storage: SosStorage, now: number = Date.now()): StoredSos | null {
  try {
    const raw = storage.getString(SOS_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.sessionId !== 'string' || !record.sessionId) return null;
    const savedAt = typeof record.savedAt === 'number' ? record.savedAt : 0;
    if (now - savedAt > SOS_MAX_AGE_MS) {
      storage.remove(SOS_STORAGE_KEY);
      return null;
    }
    return {
      sessionId: record.sessionId,
      shareToken: typeof record.shareToken === 'string' ? record.shareToken : null,
      ownerId: typeof record.ownerId === 'string' ? record.ownerId : null,
      resolvePending: record.resolvePending === true,
      savedAt,
    };
  } catch {
    return null;
  }
}

/** 解除請求失敗：保留紀錄並標記待重送（`recoverActiveSos` 下次啟動會補送）。 */
export function markResolvePending(storage: SosStorage): void {
  const raw = loadActiveSos(storage);
  if (!raw) return;
  try {
    storage.set(SOS_STORAGE_KEY, JSON.stringify({ ...raw, resolvePending: true }));
  } catch {
    // ignore
  }
}

export function clearActiveSos(storage: SosStorage): void {
  try {
    storage.remove(SOS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export type RecoveryOutcome =
  | { kind: 'snapshot'; status: 'active' | 'resolved' }
  | { kind: 'gone' }
  | { kind: 'transient' }
  | { kind: 'empty' };

/**
 * 對齊 Web `SosDialog` 的復原判斷：仍進行中 → 直接回到進行中畫面（不重新倒數、不建立新 session）；
 * 已解除、404／410 → 清掉本機提示；網路或認證等其他錯誤、或空回應 → 保留，下次啟動再試。
 */
export function recoveryAction(outcome: RecoveryOutcome): 'resume' | 'clear' | 'keep' {
  if (outcome.kind === 'snapshot') return outcome.status === 'active' ? 'resume' : 'clear';
  if (outcome.kind === 'gone') return 'clear';
  return 'keep';
}
