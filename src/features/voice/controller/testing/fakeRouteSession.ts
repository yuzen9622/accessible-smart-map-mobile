import { create } from 'zustand';

/** `@/features/route` 的最小替身：只有語音導航橋接會讀的 selectRoute 身分與 token。 */
export interface FakeRouteState {
  selectRoute: { route: { navigationId?: string; routeVersion?: number; routeToken?: string } } | null;
}

export const fakeRouteStore = create<FakeRouteState>(() => ({ selectRoute: null }));

export const routeModule = {
  getRouteSessionSnapshot: () => fakeRouteStore.getState(),
  subscribeRouteSession: (listener: (state: FakeRouteState, previous: FakeRouteState) => void) => fakeRouteStore.subscribe(listener),
};
