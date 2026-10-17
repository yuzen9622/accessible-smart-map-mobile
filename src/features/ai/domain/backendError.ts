import type { Translate } from './types';

const REASON_KEYS: Record<string, string> = {
  AI_EMPTY_RESPONSE: 'nativeAiError',
  AI_REQUEST_FAILED: 'nativeAiError',
  AI_RATE_LIMITED: 'nativeAiErrorRateLimit',
  NO_ROUTE: 'routeErrorNoRoute',
  NO_ACCESSIBLE_ROUTE: 'routeErrorNoAccessibleRoute',
  OUT_OF_RANGE: 'routeTooFar',
  OUT_OF_COVERAGE: 'routeTooFar',
};

/** reason is a business identifier; numeric HTTP codes must not be used as dictionary keys. */
export function backendErrorText(reason: string | undefined, message: string | undefined, t: Translate): string | undefined {
  const key = reason && Object.hasOwn(REASON_KEYS, reason) ? REASON_KEYS[reason] : undefined;
  return key ? t(key) : message?.trim() || undefined;
}
