import { signOutGoogle } from './api/nativeSignIn';
import { useAuthStore } from './store/authStore';

/** 使用者按「登出」：同步清除 session（並撤銷 refresh token），再清掉 Google SDK 的本機帳號。 */
export function signOut(): void {
  useAuthStore.getState().logout();
  void signOutGoogle();
}
