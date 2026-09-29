import type { LiveNavigationPort, LiveNavigationSnapshot } from '../domain/liveNavigation';

/** Live Activity 內的文字全部在 App 端組好（widget runtime 沒有 i18n）。 */
export interface LiveActivityTexts {
  distance: (meters: number) => string;
  eta: (arrivalAt: number) => string;
  remaining: (seconds: number) => string;
  rerouting: string;
}

export type CreateLiveNavigationPort = (texts: () => LiveActivityTexts) => LiveNavigationPort;

export type { LiveNavigationSnapshot };
