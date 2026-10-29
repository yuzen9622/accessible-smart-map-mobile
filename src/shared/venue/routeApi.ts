import { fetchRequest } from '@/shared/api';

import { parseVenueRoute } from './parseVenueRoute';
import type { VenueRoute, VenueRouteRequest } from './types';

/** Shared by route planning; no feature UI/store dependency is loaded here. */
export async function planVenueRoute(
  request: VenueRouteRequest & { language?: 'zh-TW' | 'en' },
  signal?: AbortSignal,
): Promise<VenueRoute> {
  const response = await fetchRequest(`/api/v1/a11y/venues/${encodeURIComponent(request.venueId)}/route`, {
    method: 'POST', signal, timeoutMs: 15_000,
    body: {
      fromPlaceId: request.fromPlaceId, toPlaceId: request.toPlaceId, mode: request.mode,
      language: request.language ?? 'zh-TW',
    },
  });
  return parseVenueRoute(response.data, request);
}
