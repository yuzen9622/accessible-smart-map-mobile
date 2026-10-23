import { executeAction } from '@/features/ai/controller/actionExecutor';
import { routePlanFixture } from '@/features/ai/domain/testing/routePlanFixture';
import { getAccessibleRoute } from '@/features/route/api/route';
import { endRouteSession, getRouteConversationInput, getRouteSessionSnapshot, subscribeRouteSession } from '@/features/route';
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
