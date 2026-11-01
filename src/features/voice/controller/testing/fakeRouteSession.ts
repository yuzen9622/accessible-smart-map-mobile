import { create } from 'zustand';

import type { AccessibleRoute, VenueHandoff } from '@/features/route/domain';
import type { VenueRoute } from '@/shared/venue';

type FakeRoute = { route: Pick<AccessibleRoute, 'navigationId' | 'routeVersion' | 'routeToken'> & Partial<AccessibleRoute> };

export interface FakeRouteState {
  selectRoute: FakeRoute | null;
  navigationRoute: FakeRoute | null;
  indoorRoute?: VenueRoute | null;
  navigationVenueHandoff?: VenueHandoff | null;
  computeRoutes?: FakeRoute['route'][] | null;
}

export const fakeRouteStore = create<FakeRouteState>(() => ({ selectRoute: null, navigationRoute: null }));

export const routeModule = {
  getRouteSessionSnapshot: () => fakeRouteStore.getState(),
  getVenueHandoff: () => fakeRouteStore.getState().navigationVenueHandoff ?? null,
  clearNavigationRoute: () => fakeRouteStore.setState({ navigationRoute: null, navigationVenueHandoff: null }),
  pinNavigationRoute: () => {
    const selected = fakeRouteStore.getState().selectRoute;
    if (!selected?.route.routeToken) return false;
    fakeRouteStore.setState({ navigationRoute: selected });
    return true;
  },
  selectRouteAt: (index: number) => {
    const route = fakeRouteStore.getState().computeRoutes?.[index];
    if (route) fakeRouteStore.setState({ selectRoute: { route } });
  },
  subscribeRouteSession: (listener: (state: FakeRouteState, previous: FakeRouteState) => void) => fakeRouteStore.subscribe(listener),
  replaceNavigationRoute: (route: AccessibleRoute) => {
    const state = fakeRouteStore.getState();
    if (!state.navigationRoute?.route.navigationId || state.navigationRoute.route.navigationId !== route.navigationId) return false;
    fakeRouteStore.setState({
      navigationRoute: { route },
      ...(state.selectRoute?.route.navigationId === route.navigationId ? { selectRoute: { route } } : {}),
    });
    return true;
  },
};
