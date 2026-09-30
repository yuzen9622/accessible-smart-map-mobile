import { ApiError, fetchRequest } from '@/shared/api';
import type { AccessibleRoute } from '@/features/route/domain';

/** `/ai/explain` 回應（Web `src/types/route.ts` `RouteExplanation`）。 */
export interface RouteExplanation {
  summary: string;
  accessibilityHighlights: string[];
  warnings: string[];
  alternatives: string | null;
}

export type ExplainMode = 'wheelchair' | 'elderly' | 'visual_impaired' | 'normal';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isRouteExplanation(value: unknown): value is RouteExplanation {
  if (typeof value !== 'object' || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  return (
    typeof record.summary === 'string' &&
    isStringArray(record.accessibilityHighlights) &&
    isStringArray(record.warnings) &&
    (record.alternatives === null || typeof record.alternatives === 'string')
  );
}

/**
 * 移植自 Web `src/lib/api/ai.ts` `explainRoute`（commit f5027af）。後端 `POST /api/v1/ai/explain`
 * （`optionalAuth`、有 rate limit；body 見 `ai.schema.ts` `ExplainBodySchema`）。
 */
export async function explainRoute(
  route: AccessibleRoute,
  mode: ExplainMode,
  language: 'zh-TW' | 'en',
  signal?: AbortSignal,
): Promise<RouteExplanation> {
  const res = await fetchRequest('/api/v1/ai/explain', { method: 'POST', body: { route, mode, language }, signal });
  const ok = res.ok === true || res.success === true || res.status === 'success';
  if (!ok || !isRouteExplanation(res.data)) throw new ApiError(res.message, res.code);
  return res.data;
}
