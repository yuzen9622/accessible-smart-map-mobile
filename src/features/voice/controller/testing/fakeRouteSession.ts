import { create } from 'zustand';

import type { AccessibleRoute } from '@/features/route/domain';

type FakeRoute = { route: Pick<AccessibleRoute, 'navigationId' | 'routeVersion' | 'routeToken'> & Partial<AccessibleRoute> };

export interface FakeRouteState {
  selectRoute: FakeRoute | null;
  navigationRoute: FakeRoute | null;
  computeRoutes?: FakeRoute['route'][] | null;
}

export const fakeRouteStore = create<FakeRouteState>(() => ({ selectRoute: null, navigationRoute: null }));

export const routeModule = {
  getRouteSessionSnapshot: () => fakeRouteStore.getState(),
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
