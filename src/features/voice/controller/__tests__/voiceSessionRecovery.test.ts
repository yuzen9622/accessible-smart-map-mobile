import { startVoiceSession, endVoiceSession, dismissVoiceSession } from '@/features/voice/controller/voiceController';
import { useVoiceStore } from '@/features/voice/store/voiceStore';
import { isVoiceSessionActive, shouldShowVoicePill } from '@/features/voice/domain/voiceStatus';
import { registerChatDismiss } from '@/features/ai/controller/actionExecutor';
import { routePlanFixture } from '@/features/ai/domain/testing/routePlanFixture';
import { useAuthStore } from '@/features/auth';
import { appendVoiceTurns } from '@/features/ai';
import { configureAuthState, refreshAccessToken, resetRefreshLaneForTests } from '@/features/auth/domain/authRefresh';
import type { VoiceSocket } from '@/features/voice/domain/voiceSession';

const mockSockets: (VoiceSocket & { sent: (string | ArrayBuffer)[] })[] = [];
const mockNavigate = jest.fn();
const mockDismiss = jest.fn();
const mockApply = jest.fn();
const mockCaptureStop = jest.fn();
let mockCaptureFrame: (frame: ArrayBuffer) => void;
const mockPlayback = { play: jest.fn(), clear: jest.fn(), dispose: jest.fn(), resume: jest.fn(async () => true), onBlocked: jest.fn(), setMuted: jest.fn(), isPlaying: jest.fn(() => false), onDrained: jest.fn() };
const mockRouteState = { selectionGeneration: 1, selectRoute: null, navigationRoute: null, isLoading: false, invalidRouteTokens: [] };
const mockRouteListeners: ((state: typeof mockRouteState, previous: typeof mockRouteState) => void)[] = [];
const mockRefresh = jest.fn(async () => 'token-refreshed');
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-router', () => ({ router: { navigate: (...args: unknown[]) => mockNavigate(...args) } }));
jest.mock('@/features/auth', () => {
  const { create } = jest.requireActual('zustand');
  return { useAuthStore: create(() => ({ user: { _id: 'user-a' }, session: { accessToken: 'token-a' }, remoteConfig: null })) };
});
jest.mock('@/features/map', () => {
  const { create } = jest.requireActual('zustand');
  return { useUserLocationStore: create(() => ({ position: { lat: 25, lng: 121 } })), mapCamera: { flyTo: jest.fn(), fitBounds: jest.fn() } };
});
jest.mock('@/features/route', () => ({
  getRouteSessionSnapshot: () => mockRouteState,
  subscribeRouteSession: (listener: (state: typeof mockRouteState, previous: typeof mockRouteState) => void) => { mockRouteListeners.push(listener); return () => {}; }, invalidateRouteConversations: jest.fn(), markRouteTokenInvalid: jest.fn(),
  applyAiRoutePlan: (...args: unknown[]) => mockApply(...args), applyComputedRoutes: jest.fn(), fitSelectedRoute: jest.fn(),
}));
jest.mock('@/features/ai', () => ({
  ...jest.requireActual('@/features/ai/controller/actionExecutor'),
  appendVoiceTurns: jest.fn(), getVoiceHistory: () => [],
  getRouteConversationRequest: () => ({ routeContractVersion: 1, routeContext: null }),
}));
jest.mock('@/shared/api', () => ({ getAuthPort: () => ({ getSession: () => jest.requireMock('@/features/auth').useAuthStore.getState().session, refresh: () => mockRefresh() }) }));
jest.mock('@/shared/i18n', () => ({ __esModule: true, default: { on: jest.fn() }, getAppLanguage: () => 'zh-TW' }));
jest.mock('@/features/voice/audio/audioCapture', () => ({ createCapture: async (onFrame: (frame: ArrayBuffer) => void) => { mockCaptureFrame = onFrame; return { stop: mockCaptureStop }; } }));
jest.mock('@/features/voice/audio/audioPlayback', () => ({ createPlayback: () => mockPlayback }));
jest.mock('@/features/voice/audio/audioSession', () => ({ beginVoiceAudio: jest.fn(), releaseVoiceAudio: jest.fn() }));
jest.mock('@/features/voice/store/voiceLevels', () => ({ voiceLevels: { mic: { set: jest.fn() }, model: { set: jest.fn() } } }));
jest.mock('@/features/voice/controller/voiceNavigationBridge', () => ({
  armCurrentRoute: jest.fn(), getVoiceNavigationResumeState: () => null, handleVoiceNavigationEvent: jest.fn(),
  installVoiceNavigationBridge: jest.fn(), onVoiceSessionTerminal: jest.fn(), setBridgeTranslate: jest.fn(),
}));
jest.mock('@/features/voice/transport/voiceSocket', () => ({
  voiceWsUrl: () => 'wss://voice.test/voice',
  createVoiceSocket: () => {
    const s = { sent: [] as (string | ArrayBuffer)[], send(data: string | ArrayBuffer) { this.sent.push(data); }, close: jest.fn(), onopen: null, onmessage: null, onclose: null, onerror: null };
    mockSockets.push(s); return s;
  },
}));

const socket = () => mockSockets[mockSockets.length - 1];
const event = (data: object | ArrayBuffer) => socket().onmessage?.({ data: data instanceof ArrayBuffer ? data : JSON.stringify(data) });
const frame = (type: string) => socket().sent.filter((v): v is string => typeof v === 'string').map(v => JSON.parse(v)).filter(v => v.type === type);
const state = () => ({ status: useVoiceStore.getState().status.status, visible: isVoiceSessionActive(useVoiceStore.getState().status.status), sentEnd: frame('session.end').length > 0, dismissed: mockDismiss.mock.calls.length > 0, navigated: mockNavigate.mock.calls.length > 0, routeSync: useVoiceStore.getState().routeSyncState });
async function ready() {
  socket().onopen?.();
  event({ type: 'session.ready', capabilities: { aiRouteContractVersion: 1, routeContextSync: true } });
  const context = frame('route.context.set').at(-1);
  event({ ...context, type: 'route.context.ack', ok: true, routeId: null, navigationId: null, routeVersion: null });
  await Promise.resolve(); await Promise.resolve();
}
async function speaking() {
  startVoiceSession(key => key); await ready(); event(new ArrayBuffer(480));
  expect(state()).toMatchObject({ status: 'model-speaking', visible: true, sentEnd: false, dismissed: false });
}
function toolCall() { event({ type: 'tool_call', name: 'planAccessibleRoute', callId: 'call-a', turnId: 'turn-a' }); }
function toolResult(result: unknown, extra = {}) { event({ type: 'tool_result', name: 'planAccessibleRoute', callId: 'call-a', turnId: 'turn-a', ok: true, result, ...extra }); }
let unregister: () => void;
beforeEach(() => {
  dismissVoiceSession(); jest.clearAllMocks(); mockSockets.length = 0; mockRouteState.selectionGeneration = 1; mockRouteState.selectRoute = null;
  useAuthStore.setState({ user: { _id: 'user-a' } as never, session: { accessToken: 'token-a' } });
  unregister = registerChatDismiss(mockDismiss); jest.useFakeTimers();
});
afterEach(() => { endVoiceSession(); unregister(); configureAuthState(null); resetRefreshLaneForTests(); jest.clearAllTimers(); jest.useRealTimers(); });

// Keep the real controller wiring: mocking onRouteError hides the original hangup bug.
describe('voice session recovery through the production controller', () => {
  it.each([
    ['missing GPS', { ok: false, error: 'Location required' }, {}],
    ['invalid arguments', { ok: false, reason: 'INVALID_ROUTE_ARGUMENTS' }, {}],
    ['tool execution failure', undefined, { ok: false }],
  ])('%s allows the assistant to explain and the user to continue', async (_label, result, extra) => {
    await speaking(); toolCall(); mockPlayback.clear.mockClear();
    toolResult(result, extra);
    expect(state()).toMatchObject({ status: 'model-speaking', visible: true, sentEnd: false, dismissed: false, routeSync: 'synced' });
    expect(useVoiceStore.getState().activeTool).toMatchObject({ type: 'result', ok: false, result: undefined, args: undefined });
    expect(mockApply).not.toHaveBeenCalled();
    expect(mockPlayback.clear).not.toHaveBeenCalled();
    event({ type: 'transcript', role: 'model', text: 'Please tell me your starting point.', final: true });
    event(new ArrayBuffer(480));
    expect(mockPlayback.play).toHaveBeenCalledTimes(2);
    event({ type: 'turn.complete' });
    const input = new ArrayBuffer(480);
    mockCaptureFrame(input);
    expect(socket().sent).toContain(input);
    expect(state()).toMatchObject({ status: 'listening', visible: true, sentEnd: false });
    toolResult(result, extra); // a duplicate must not apply or terminate
    expect(state().visible).toBe(true);
  });
  it('only an explicit end returns the panel to text chat', async () => {
    await speaking(); endVoiceSession();
    expect(state()).toMatchObject({ status: 'ended', visible: false, sentEnd: true });
  });
  it.each([
    ['missing result', undefined, {}],
    ['wrong turn', routePlanFixture(), { turnId: 'different-turn' }],
    ['invalid success shape', { ok: true, routes: [] }, {}],
  ])('%s stops unsafe output but keeps an actionable voice error visible', async (_label, result, extra) => {
    await speaking(); toolCall(); toolResult(result, extra);
    expect(state()).toMatchObject({ status: 'error', visible: true, sentEnd: false, dismissed: false });
    expect(mockPlayback.clear).toHaveBeenCalled();
    expect(useVoiceStore.getState().status.code).toBe('ROUTE_RESPONSE_INVALID');
    expect(useVoiceStore.getState().activeTool).toBeNull();
    expect(mockApply).not.toHaveBeenCalled();
    mockPlayback.play.mockClear(); event(new ArrayBuffer(480));
    expect(mockPlayback.play).not.toHaveBeenCalled();
    startVoiceSession(key => key); await ready();
    expect(state()).toMatchObject({ status: 'listening', visible: true, routeSync: 'synced' });
  });
  it('accepts a later valid route after a failed request without restarting voice', async () => {
    await speaking(); toolCall(); toolResult({ ok: false, error: 'Starting point required' });
    event({ type: 'turn.complete' });
    event({ type: 'tool_call', name: 'planAccessibleRoute', callId: 'call-b', turnId: 'turn-b' });
    toolResult(routePlanFixture(), { callId: 'call-b', turnId: 'turn-b' });
    expect(mockApply).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({ visible: true, sentEnd: false });
    expect(mockSockets).toHaveLength(1);
  });
  it('never treats an uncorrelated failure as a safe continuation', async () => {
    await speaking(); toolResult({ ok: false, error: 'Starting point required' });
    expect(state()).toMatchObject({ status: 'error', visible: true, sentEnd: false });
    expect(mockApply).not.toHaveBeenCalled();
  });
  it('selection changes published through the real subscription suppress stale results without hanging up', async () => {
    await speaking(); toolCall();
    const previous = { ...mockRouteState };
    mockRouteState.selectionGeneration++; mockRouteState.selectRoute = { route: routePlanFixture().routes[0] } as never;
    mockRouteListeners.forEach(listener => listener(mockRouteState, previous));
    toolResult(routePlanFixture());
    expect(state()).toMatchObject({ status: 'model-speaking', visible: true, sentEnd: false, routeSync: 'pending' });
    expect(mockApply).not.toHaveBeenCalled();
  });
  it('valid result immediately dismisses chat while audio is still speaking', async () => {
    await speaking(); toolCall(); toolResult(routePlanFixture());
    expect(state()).toMatchObject({ status: 'model-speaking', visible: true, sentEnd: false, dismissed: true, navigated: true });
    expect(mockNavigate).toHaveBeenCalledWith('/routes');
    expect(shouldShowVoicePill(useVoiceStore.getState().status.status, false, 'panel')).toBe(true);
  });
  it('ordinary failed non-route tool does not close voice', async () => {
    await speaking(); event({ type: 'tool_result', name: 'getWeather', ok: false });
    expect(state()).toMatchObject({ status: 'model-speaking', visible: true, sentEnd: false, dismissed: false });
  });
  it.each(['LIVE_SESSION_ENDED', 'LIVE_CONNECT_FAILED'])('%s without socket close stops audio and keeps a recoverable error visible', async code => {
    await speaking(); event({ type: 'error', code }); await jest.advanceTimersByTimeAsync(60_000);
    expect(state()).toMatchObject({ status: 'error', visible: true, sentEnd: false });
    expect(mockCaptureStop).toHaveBeenCalled();
    expect(mockPlayback.dispose).toHaveBeenCalled();
    startVoiceSession(key => key); await ready();
    expect(state()).toMatchObject({ status: 'listening', visible: true });
    expect(mockSockets).toHaveLength(2);
  });
  it.each([[1000, '', 'error', true], [1000, 'live-session-ended', 'error', true], [1006, '', 'reconnecting', true], [1011, '', 'error', true], [4409, '', 'error', true]])('socket close %s/%s produces %s', async (code, reason, status, visible) => {
    await speaking(); socket().onclose?.({ code: code as number, reason: reason as string });
    expect(state()).toMatchObject({ status, visible, sentEnd: false, dismissed: false });
  });
  it('same user token/config updates do not close voice', async () => {
    await speaking();
    useAuthStore.setState({ session: { accessToken: 'new-token' } });
    useAuthStore.setState({ user: { _id: 'user-a' } as never, remoteConfig: { language: 'en' } });
    expect(state()).toMatchObject({ status: 'model-speaking', visible: true, sentEnd: false });
  });
  it('identity removal stops audio and shows the login requirement', async () => {
    await speaking();
    event({ type: 'transcript', role: 'user', text: 'Private previous conversation', final: true });
    jest.mocked(appendVoiceTurns).mockClear();
    useAuthStore.setState({ user: null });
    expect(state()).toMatchObject({ status: 'needs-login', visible: true, sentEnd: true });
    expect(useVoiceStore.getState().transcripts).toEqual([]);
    expect(appendVoiceTurns).not.toHaveBeenCalled();
  });
  it.each(['ok', 'unavailable', 'rejected'] as const)('real auth refresh outcome %s propagates through the voice identity subscription', async kind => {
    await speaking();
    configureAuthState({
      getSession: () => useAuthStore.getState().session,
      setSession: session => useAuthStore.setState({ session }),
      setUser: user => useAuthStore.setState({ user }),
      requestRefresh: async () => kind === 'ok' ? { kind, accessToken: 'new', user: { _id: 'user-a' } as never } : { kind },
    });
    await refreshAccessToken();
    expect(state()).toMatchObject(kind === 'rejected' ? { status: 'needs-login', visible: true, sentEnd: true } : { status: 'model-speaking', visible: true, sentEnd: false });
  });
  it('ordinary conversation stays visible across many turns and 20 minutes without terminal events', async () => {
    await speaking();
    for (let i = 0; i < 20; i++) {
      event({ type: 'transcript', role: 'user', text: 'fixture', final: true });
      event(new ArrayBuffer(480)); event({ type: 'turn.complete' });
      await jest.advanceTimersByTimeAsync(60_000);
    }
    expect(state()).toMatchObject({ status: 'listening', visible: true, sentEnd: false, dismissed: false });
  });
  it('turn completion and interruption keep the voice panel visible', async () => {
    await speaking(); event({ type: 'turn.complete' });
    expect(state()).toMatchObject({ status: 'listening', visible: true, sentEnd: false });
    event(new ArrayBuffer(480)); event({ type: 'interrupted' });
    expect(state()).toMatchObject({ status: 'listening', visible: true, sentEnd: false });
  });
  it('route context acknowledgement failure blocks audio but does not close the panel', async () => {
    startVoiceSession(key => key); socket().onopen?.();
    event({ type: 'session.ready', capabilities: { aiRouteContractVersion: 1, routeContextSync: true } });
    await Promise.resolve(); await Promise.resolve();
    await jest.advanceTimersByTimeAsync(10_001);
    expect(state()).toMatchObject({ status: 'listening', visible: true, sentEnd: false, routeSync: 'error' });
  });
});
