/**
 * 後端尚未上線的端點（SDD §8）。前端已依草案契約實作，但在後端部署前不顯示入口，避免使用者按了
 * 才得到 404（ROADMAP：未完成的功能放在 feature flag 後）。後端上線後把對應旗標改成 true。
 *
 * - `appleSignIn`：B-03 `POST /api/v1/user/auth/apple`（2026-09-29 後端開發中，尚未 merge）
 * - `pushTokens`：B-04 `POST|DELETE /api/v1/user/push-tokens`
 * - `accountDeletion`：B-08 `DELETE /api/v1/user`
 */
export const backendCapabilities = {
  appleSignIn: true,
  pushTokens: false,
  accountDeletion: false,
} as const;
