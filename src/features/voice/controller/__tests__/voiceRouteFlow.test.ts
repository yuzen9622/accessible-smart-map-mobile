import { executeAction } from '@/features/ai/controller/actionExecutor';
import { roadRoutePlanFixture } from '@/features/ai/domain/testing/roadRoutePlanFixture';
import { indoorRoutePlanFixture, mixedRoutePlanFixture, routePlanFixture } from '@/features/ai/domain/testing/routePlanFixture';
import { getAccessibleRoute } from '@/features/route/api/route';
import { endRouteSession, getRouteConversationInput, getRouteSessionSnapshot, selectRouteAt, subscribeRouteSession } from '@/features/route';
import { createVoiceBindings } from '../../domain/voiceSessionBindings';
import { VoiceSessionController, type VoiceSocket } from '../../domain/voiceSession';

jest.mock('@/features/map', () => jest.requireActual('@/features/navigation/controller/testing/fakeMap').mapModule);
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('@/features/route/api/route', () => ({ getAccessibleRoute: jest.fn() }));

function harness() {
  const sent: (string | ArrayBuffer)[] = [];
  const socket: VoiceSocket = {
    send: data => { sent.push(data); }, close: jest.fn(),
    onopen: null, onmessage: null, onclose: null, onerror: null,
  };
  const onRouteError = jest.fn();
  const binding = createVoiceBindings({
    executeAction, t: key => key, onRouteError,
    getRouteGeneration: () => getRouteSessionSnapshot().selectionGeneration,
    publishTranscripts: jest.fn(), publishStatus: jest.fn(), publishTool: jest.fn(), setMicLevel: jest.fn(),
  });
  const navigation = jest.fn();
  const controller = new VoiceSessionController({
    wsUrl: 'wss://fixture.test/voice', createSocket: () => socket,
    refreshAuth: async () => 'token', getToken: () => 'token', getAuthIdentity: () => 'user', getUserLocation: () => null,
    getRouteConversation: getRouteConversationInput,
    createCapture: async () => ({ stop: jest.fn() }),
    createPlayback: () => ({ play: jest.fn(), clear: jest.fn(), dispose: jest.fn(), resume: async () => true, onBlocked: jest.fn(), isPlaying: () => false }),
    onStatusChange: binding.onStatusChange, onToolEvent: binding.onToolEvent,
    onTranscript: binding.onTranscript, onNavigationEvent: navigation,
    onTurnComplete: binding.onTurnComplete,
  });
  const off = subscribeRouteSession((state, previous) => {
    if (state.selectRoute?.route !== previous.selectRoute?.route) controller.syncRouteContext();
  });
  const event = (value: object) => socket.onmessage?.({ data: JSON.stringify(value) });
  controller.start(); socket.onopen?.();
  event({ type: 'session.ready', capabilities: { aiRouteContractVersion: 1, routeContextSync: true } });
  event({ type: 'route.context.ack', requestId: 'selection-1', selectionVersion: 1, ok: true, routeId: null, navigationId: null, routeVersion: null });
  const frames = () => sent.filter((v): v is string => typeof v === 'string').map(v => JSON.parse(v));
  return { event, controller, navigation, onRouteError, frames, dispose: () => { off(); controller.end(); } };
}

beforeEach(() => { endRouteSession(); jest.clearAllMocks(); });
afterEach(() => endRouteSession());

it('applies both correlated plans through the real route port without a second planning API request', () => {
  const h = harness();
  try {
    const first = routePlanFixture();
    const second = { ...routePlanFixture(), planId: 'second-plan' };
    for (const callId of ['a', 'b']) h.event({ type: 'tool_call', name: 'planAccessibleRoute', callId, turnId: 't' });
    h.event({ type: 'tool_result', name: 'planAccessibleRoute', callId: 'a', turnId: 't', ok: true, result: first });
    h.event({ type: 'tool_result', name: 'planAccessibleRoute', callId: 'b', turnId: 't', ok: true, result: second });
    expect(getRouteSessionSnapshot().planId).toBe('second-plan');
    expect(getRouteSessionSnapshot().selectRoute?.route.routeToken).toBe(second.routes[1].routeToken);
    expect(h.onRouteError).not.toHaveBeenCalled();
    expect(getAccessibleRoute).not.toHaveBeenCalled();
    expect(h.navigation).not.toHaveBeenCalled();
    expect(h.frames().filter(f => f.type === 'route.context.set')).toHaveLength(1);
    h.event({ type: 'turn.complete' });
    expect(h.frames().filter(f => f.type === 'route.context.set')).toHaveLength(2);
  } finally { h.dispose(); }
});

it('does not switch routes from a candidate proposal or confirmation tool result', () => {
  const h = harness();
  try {
    for (const name of ['proposeNavigationCandidate', 'confirmNavigationCandidateSwitch']) {
      h.event({ type: 'tool_call', name, callId: name, turnId: 't' });
      h.event({ type: 'tool_result', name, callId: name, turnId: 't', ok: true, result: routePlanFixture() });
    }
    expect(getRouteSessionSnapshot().selectRoute).toBeNull();
    expect(getAccessibleRoute).not.toHaveBeenCalled();
  } finally { h.dispose(); }
});

it.each([
  ['planIndoorRoute', indoorRoutePlanFixture],
  ['planAccessibleRoute', mixedRoutePlanFixture],
  ['planAccessibleRoute', routePlanFixture],
] as const)('voice assistant applies %s through the same journey port without replanning', (name, fixture) => {
  const h = harness();
  try {
    const plan = fixture();
    h.event({ type: 'tool_call', name, callId: 'journey', turnId: 'turn' });
    h.event({ type: 'tool_result', name, callId: 'journey', turnId: 'turn', ok: true, result: plan });
    expect(getRouteSessionSnapshot()).toMatchObject({ planId: plan.planId,
      originVenuePlace: plan.originVenuePlace ?? null, destinationVenuePlace: plan.destinationVenuePlace ?? null,
      indoorRoute: plan.journeyKind === 'indoor' ? plan.indoorRoute : null,
      venueLeg: plan.journeyKind === 'mixed' ? plan.venueLeg : null,
    });
    expect(h.onRouteError).not.toHaveBeenCalled();
    expect(getAccessibleRoute).not.toHaveBeenCalled();
  } finally { h.dispose(); }
});

it('rejects a late indoor result after the user cleared the journey', () => {
  const h = harness();
  try {
    h.event({ type: 'tool_call', name: 'planIndoorRoute', callId: 'late', turnId: 'turn' });
    endRouteSession();
    h.event({ type: 'tool_result', name: 'planIndoorRoute', callId: 'late', turnId: 'turn', ok: true, result: indoorRoutePlanFixture() });
    expect(getRouteSessionSnapshot().indoorRoute).toBeNull();
  } finally { h.dispose(); }
});

it('sends manual confirmation with the active navigation identity and original step index', () => {
  const h = harness();
  try {
    h.controller.advanceNavigationStep(2, 'indoor-nav', 4);
    expect(h.frames()).toContainEqual({ type: 'nav.advance', fromStepIndex: 2, navigationId: 'indoor-nav', routeVersion: 4 });
  } finally { h.dispose(); }
});


it.each([
  ['normal', 'DRIVE'], ['elderly', 'DRIVE'],
  ['normal', 'MOTORCYCLE'], ['elderly', 'MOTORCYCLE'],
] as const)('applies a %s %s preview with coordinate endpoints without starting navigation', (mode, type) => {
  const h = harness();
  try {
    const base = roadRoutePlanFixture(type);
    const plan = { ...base, effectivePreferences: { ...base.effectivePreferences, mode } };
    const args = { mode, travelMode: plan.effectivePreferences.travelMode, startNavigation: false };
    h.event({ type: 'tool_call', name: 'planAccessibleRoute', callId: 'road-preview', turnId: 'road', args });
    h.event({ type: 'tool_result', name: 'planAccessibleRoute', callId: 'road-preview', turnId: 'road', ok: true, result: plan });
    h.event({ type: 'turn.complete' });
    const state = getRouteSessionSnapshot();
    expect(state).toMatchObject({ routeMode: mode, travelMode: args.travelMode, effectivePreferences: plan.effectivePreferences });
    expect(state.computeRoutes).toEqual(plan.routes);
    expect(state.selectRoute?.route.legs[0]).toMatchObject({ type, from: { lat: 24, lng: 120 }, to: { lat: 24.1, lng: 120.1 } });
    expect(h.frames().at(-1)).toMatchObject({ type: 'route.context.set', routeContext: { routeToken: plan.routes[1].routeToken } });
    expect(h.frames().some(frame => frame.type === 'nav.start')).toBe(false);
    expect(h.navigation).not.toHaveBeenCalled();
    expect(h.onRouteError).not.toHaveBeenCalled();
    expect(getAccessibleRoute).not.toHaveBeenCalled();
  } finally { h.dispose(); }
});

it('replaces a stopped driving plan with the latest motorcycle candidates and synchronizes a manual selection', () => {
  const h = harness();
  try {
    function publish(type: 'DRIVE' | 'MOTORCYCLE', id: string) {
      const base = roadRoutePlanFixture(type);
      const routes = base.routes.map((route, index) => ({ ...route, routeId: `${id}-${index}`, routeToken: `${id}-token-${index}`, navigationId: `${id}-nav-${index}` }));
      const plan = { ...base, planId: id, routes, selectedRouteId: routes[1].routeId };
      h.event({ type: 'tool_call', name: 'planAccessibleRoute', callId: id, turnId: id });
      h.event({ type: 'tool_result', name: 'planAccessibleRoute', callId: id, turnId: id, ok: true, result: plan });
      h.event({ type: 'turn.complete' });
      const sync = h.frames().filter(frame => frame.type === 'route.context.set').at(-1);
      h.event({ type: 'route.context.ack', requestId: sync.requestId, selectionVersion: sync.selectionVersion, ok: true, routeId: routes[1].routeId, navigationId: routes[1].navigationId, routeVersion: 1 });
      return plan;
    }
    const drive = publish('DRIVE', 'drive');
    expect(getRouteSessionSnapshot().selectRoute?.route.routeToken).toBe(drive.routes[1].routeToken);
    h.controller.cancelNavigation();
    h.event({ type: 'nav.stop', reason: 'user_voice' });
    const motorcycle = publish('MOTORCYCLE', 'motorcycle');
    expect(getRouteSessionSnapshot().computeRoutes).toEqual(motorcycle.routes);
    selectRouteAt(0);
    const selected = getRouteSessionSnapshot().selectRoute!.route;
    expect(selected.routeToken).toBe(motorcycle.routes[0].routeToken);
    expect(h.frames().at(-1)).toMatchObject({ type: 'route.context.set', routeContext: { routeToken: selected.routeToken } });
    h.controller.startNavigation(selected.routeToken!);
    expect(h.frames().slice(-2)).toEqual([
      { type: 'nav.setRoute', routeToken: motorcycle.routes[0].routeToken },
      { type: 'nav.start' },
    ]);
    expect(getRouteConversationInput().routeContext).toEqual({ routeToken: motorcycle.routes[0].routeToken });
    expect(h.onRouteError).not.toHaveBeenCalled();
    expect(getAccessibleRoute).not.toHaveBeenCalled();
  } finally { h.dispose(); }
});
