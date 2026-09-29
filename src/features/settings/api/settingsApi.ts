import { authenticatedRequest } from '@/shared/api';

import { parseServerA11yProfile, type ServerA11yProfile } from '../domain/a11yProfileSync';
import type { RemoteConfigPatch } from '../domain/remoteConfig';

/** 移植自 Web `src/lib/api/user.ts` `updateConfig`（commit f82cda8）；a11y-profile 為原生新增。 */

/** 回應的 `data` 就是 Config 本身（不在 `config` 底下）。不得送 `user_id`（後端 `.strict()`）。 */
export async function updateRemoteConfig(patch: RemoteConfigPatch): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await authenticatedRequest('/api/v1/user/config/update', { method: 'POST', body: patch });
}

export async function getServerA11yProfile(): Promise<ServerA11yProfile | null> {
  const res = await authenticatedRequest('/api/v1/user/a11y-profile', { method: 'GET' });
  return res.ok === true || res.success === true ? parseServerA11yProfile(res.data) : null;
}

export async function putServerA11yProfile(profile: Partial<ServerA11yProfile>): Promise<void> {
  await authenticatedRequest('/api/v1/user/a11y-profile', { method: 'PUT', body: profile });
}
