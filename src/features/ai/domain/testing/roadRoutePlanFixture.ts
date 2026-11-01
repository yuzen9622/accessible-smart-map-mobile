import type { DriveLeg } from '@/features/route/domain';
import { routePlanFixture } from './routePlanFixture';

export function roadRoutePlanFixture(type: DriveLeg['type']): ReturnType<typeof routePlanFixture> {
  const plan = routePlanFixture();
  const leg: DriveLeg = {
    type, from: { lat: plan.origin.lat, lng: plan.origin.lng },
    to: { lat: plan.destination.lat, lng: plan.destination.lng },
    distanceM: 1500, durationMin: 4, polyline: [[120, 24], [120.1, 24.1]],
  };
  return { ...plan, effectivePreferences: { ...plan.effectivePreferences,
    travelMode: type === 'DRIVE' ? 'drive' : 'motorcycle',
  }, routes: plan.routes.map((route) => ({ ...route, legs: [{ ...leg }] })) };
}
