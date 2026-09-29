import { deleteAccount, loginWithApple, loginWithEmail, loginWithGoogle, type DeleteAccountResult, type LoginResult } from './api/authApi';
import { getAppleCredential, getGoogleIdToken } from './api/nativeSignIn';
import { signOut } from './signOut';
import { useAuthStore } from './store/authStore';

/**
 * 刪除帳號流程（後端 `FRONTEND_MIGRATION_ACCOUNT_DELETION.md`）：
 * - Apple 帳號：必須當場重新 Apple 登入取得 `authorizationCode`（單次、5 分鐘內），新 session 同時滿足「5 分鐘內登入」。
 * - 其他帳號：先直接刪；回 `REAUTH_REQUIRED` 才重新登入（Google／密碼），再立刻重試一次。refresh 不算重新登入。
 * - 重新登入拿到的若是另一個帳號（例如選錯 Google 帳號），不提交 session、不刪除。
 */
export type DeleteAccountOutcome =
  | 'deleted'
  | 'cancelled'
  | 'needsPassword'
  | 'wrongAccount'
  | 'appleAuthorizationInvalid'
  | 'appleUnavailable'
  | 'failed';

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?._id;
}

/** 提交重新登入的 session；若不是目前帳號則回傳 false。 */
function commitIfSameAccount(result: LoginResult): 'ok' | 'wrongAccount' | 'failed' {
  if (result.kind !== 'ok') return 'failed';
  const expected = currentUserId();
  if (expected && result.session.user._id !== expected) return 'wrongAccount';
  useAuthStore.getState().commitSession(result.session);
  return 'ok';
}

function toOutcome(result: DeleteAccountResult): DeleteAccountOutcome {
  switch (result.kind) {
    case 'deleted':
      signOut();
      return 'deleted';
    case 'appleAuthorizationRequired':
    case 'appleAuthorizationInvalid':
      return 'appleAuthorizationInvalid';
    case 'appleUnavailable':
      return 'appleUnavailable';
    default:
      return 'failed';
  }
}

async function deleteWithApple(): Promise<DeleteAccountOutcome> {
  const credential = await getAppleCredential();
  if (!credential) return 'cancelled';
  if (!credential.authorizationCode) return 'failed';
  const committed = commitIfSameAccount(await loginWithApple(credential));
  if (committed !== 'ok') return committed;
  return toOutcome(await deleteAccount(credential.authorizationCode));
}

/** 回傳 `null` 代表重新登入成功（session 已更新）；否則是要回報給 UI 的結果。 */
async function reauthenticate(password: string | undefined): Promise<DeleteAccountOutcome | null> {
  const user = useAuthStore.getState().user;
  if (!user) return 'failed';
  if (user.authProviders.includes('google')) {
    const idToken = await getGoogleIdToken();
    if (!idToken) return 'cancelled';
    const committed = commitIfSameAccount(await loginWithGoogle(idToken));
    return committed === 'ok' ? null : committed;
  }
  if (!password) return 'needsPassword';
  const committed = commitIfSameAccount(await loginWithEmail(user.email, password));
  return committed === 'ok' ? null : committed === 'failed' ? 'needsPassword' : committed;
}

export async function runAccountDeletion(options: { password?: string } = {}): Promise<DeleteAccountOutcome> {
  const user = useAuthStore.getState().user;
  if (!user) return 'failed';
  if (user.authProviders.includes('apple')) return deleteWithApple();

  const first = await deleteAccount();
  if (first.kind !== 'reauthRequired') return toOutcome(first);
  const blocked = await reauthenticate(options.password);
  if (blocked) return blocked;
  return toOutcome(await deleteAccount());
}
