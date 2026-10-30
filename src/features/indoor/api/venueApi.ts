import { ApiError, fetchRequest } from '@/shared/api';
import { parseVenueRoute } from '@/shared/venue';
import { parseVenueDetail, parseVenueSummaries } from '../domain/venueParser';
import type { VenueDetail, VenueRoute, VenueRouteRequest, VenueSummary } from '../types/venue';

const VENUES_PATH = '/api/v1/a11y/venues';

export async function loadVenues(signal?: AbortSignal): Promise<VenueSummary[]> {
  const response = await fetchRequest(VENUES_PATH, { signal });
  return parseVenueSummaries(response.data);
}
export async function loadVenue(venueId: string, signal?: AbortSignal): Promise<VenueDetail> {
  const response = await fetchRequest(`${VENUES_PATH}/${encodeURIComponent(venueId)}`, { signal });
  const detail = parseVenueDetail(response.data);
  if (detail.venueId !== venueId) throw new ApiError('場館資料與目前選擇不符，請重新載入。', 502, 'INVALID_BACKEND_DATA');
  return detail;
}
export async function planVenueRoute(request: VenueRouteRequest, signal?: AbortSignal): Promise<VenueRoute> {
  const response = await fetchRequest(`${VENUES_PATH}/${encodeURIComponent(request.venueId)}/route`, {
    method: 'POST', signal, timeoutMs: 15_000,
    body: { fromPlaceId: request.fromPlaceId, toPlaceId: request.toPlaceId, mode: request.mode, language: 'zh-TW' },
  });
  return parseVenueRoute(response.data, request);
}
