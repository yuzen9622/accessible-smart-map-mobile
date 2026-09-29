// 移植自 Web `src/lib/route/__tests__/routeSession.test.ts`（commit 5eadc71），案例逐一保留。
import { hasRouteSession, routeResumeTarget, sheetModeFromPath, shouldShowRoutePill } from '../routeSession';

const EMPTY = {
  computeRoutes: null,
  selectRoute: null,
  destination: null,
};

describe('hasRouteSession', () => {
  it('is false when nothing route-shaped is on the map', () => {
    expect(hasRouteSession(EMPTY)).toBe(false);
  });

  it('is true on destination alone — the pin the old clear lists all forgot', () => {
    expect(hasRouteSession({ ...EMPTY, destination: { lat: 25, lng: 121 } })).toBe(true);
  });

  it('is true with results but no selection yet', () => {
    expect(hasRouteSession({ ...EMPTY, computeRoutes: [] })).toBe(true);
  });

  it('is true with a selected route', () => {
    expect(hasRouteSession({ ...EMPTY, selectRoute: { index: 0 } })).toBe(true);
  });
});

describe('routeResumeTarget', () => {
  it('returns to the results list when routes came back', () => {
    expect(routeResumeTarget([{}, {}])).toBe('route');
  });

  it('returns to the planning form when only a destination was picked', () => {
    expect(routeResumeTarget(null)).toBe('plan');
  });

  it('treats an empty result array as nothing to show', () => {
    expect(routeResumeTarget([])).toBe('plan');
  });
});

describe('shouldShowRoutePill', () => {
  const base = {
    hasSession: true,
    sheetMode: 'home' as const,
    isNavigating: false,
    chatOpen: false,
  };

  it('shows once the user has left the route flow', () => {
    expect(shouldShowRoutePill(base)).toBe(true);
    expect(shouldShowRoutePill({ ...base, sheetMode: 'place' })).toBe(true);
    expect(shouldShowRoutePill({ ...base, sheetMode: 'station' })).toBe(true);
  });

  it('stays hidden while the user is already inside the route flow', () => {
    expect(shouldShowRoutePill({ ...base, sheetMode: 'plan' })).toBe(false);
    expect(shouldShowRoutePill({ ...base, sheetMode: 'route' })).toBe(false);
  });

  it("stays hidden during navigation — the HUD is the route's presence there", () => {
    expect(shouldShowRoutePill({ ...base, sheetMode: 'navigation', isNavigating: true })).toBe(false);
    // sheetMode 還沒跟上 isNavigating 時也一樣。
    expect(shouldShowRoutePill({ ...base, isNavigating: true })).toBe(false);
  });

  it('shows over the AI assistant even though sheetMode still says route', () => {
    expect(shouldShowRoutePill({ ...base, sheetMode: 'route', chatOpen: true })).toBe(true);
    expect(shouldShowRoutePill({ ...base, sheetMode: 'plan', chatOpen: true })).toBe(true);
  });

  it('stays hidden during navigation even with the chat open', () => {
    expect(shouldShowRoutePill({ ...base, isNavigating: true, chatOpen: true })).toBe(false);
  });

  it('stays hidden with no session', () => {
    expect(shouldShowRoutePill({ ...base, hasSession: false })).toBe(false);
    expect(shouldShowRoutePill({ ...base, hasSession: false, chatOpen: true })).toBe(false);
  });
});

describe('sheetModeFromPath', () => {
  it('maps the sheet routes to the Web SheetMode the pill rule expects', () => {
    expect(sheetModeFromPath('/plan')).toBe('plan');
    expect(sheetModeFromPath('/routes')).toBe('route');
    expect(sheetModeFromPath('/routes/0')).toBe('route');
    expect(sheetModeFromPath('/navigation')).toBe('navigation');
    expect(sheetModeFromPath('/place/osm:node:1')).toBe('place');
    expect(sheetModeFromPath('/bus')).toBe('home');
    expect(sheetModeFromPath('/explore')).toBe('home');
  });

  it('keeps the pill visible on non-route panels such as the bus panel', () => {
    expect(
      shouldShowRoutePill({ hasSession: true, sheetMode: sheetModeFromPath('/bus'), isNavigating: false, chatOpen: false }),
    ).toBe(true);
    expect(
      shouldShowRoutePill({ hasSession: true, sheetMode: sheetModeFromPath('/routes/1'), isNavigating: false, chatOpen: false }),
    ).toBe(false);
  });
});
