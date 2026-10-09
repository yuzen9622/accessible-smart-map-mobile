import { getRouteConversationInput, getRouteSessionSnapshot } from '@/features/route';
import { useOnboardingStore } from '@/features/onboarding';
import type { RoutingPreferences } from '@/features/route/domain';

/** Defaults only; the server keeps the selected route's canonical request authoritative. */
export function getRouteConversationRequest() {
  const state = getRouteSessionSnapshot();
  const profile = useOnboardingStore.getState().profile;
  const preferences = state.planningPreferences;
  const routingPreferences: RoutingPreferences = {
    mode: state.routeMode ?? profile.routeMode,
    ...(preferences ? { transitPreference: preferences.transitPreference } : {}),
    ...(preferences?.departureTime ? { departureTime: preferences.departureTime } : {}),
    ...((preferences?.avoidStairs ?? profile.avoidStairs) ? { avoidStairs: true } : {}),
    ...((preferences?.requireElevator ?? profile.requireElevator) ? { requireElevator: true } : {}),
  };
  return { ...getRouteConversationInput(), routingPreferences };
}
