import { router } from 'expo-router';
import { applyAiRoutePlan, applyComputedRoutes, computeRoute, endRouteSession, getRouteConversationInput, getRouteSessionSnapshot, markRouteTokenInvalid, pinNavigationRoute, replaceNavigationRoute, selectRouteAt } from '@/features/route';
import { getAccessibleRoute } from '@/features/route/api/route';
import { useRouteSessionStore } from '@/features/route/store/routeSessionStore';
import { routePlanFixture } from '../../domain/testing/routePlanFixture';
import { streamChat } from '../../api/aiApi';
import { clearChat, sendChatMessage, stopChatStreaming } from '../chatController';
import { useChatStore } from '../../store/chatStore';

jest.mock('@/features/map', () => jest.requireActual('@/features/navigation/controller/testing/fakeMap').mapModule);
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('../../api/aiApi', () => ({ streamChat: jest.fn() }));
jest.mock('@/features/route/api/route', () => ({ getAccessibleRoute: jest.fn() }));
const request = jest.mocked(streamChat);
const t = (key: string) => key;
const call = { type: 'tool-call' as const, name: 'planAccessibleRoute', callId: 'call-1', args: '{}' };
const result = () => ({ type: 'tool-result' as const, name: call.name, callId: call.callId, summary: '方案摘要', result: routePlanFixture() });

beforeEach(() => { clearChat(); endRouteSession(); jest.clearAllMocks(); });

it('SSE applies one complete plan, retains canonical metadata, and never calls the planner', async () => {
  const observations: unknown[] = [];
  const unsubscribe = useRouteSessionStore.subscribe((state) => observations.push(state));
  request.mockImplementation(async (input, emit) => {
    expect(input.routeContractVersion).toBe(1); expect(input.routeContext).toBeNull();
    emit(call); emit(result()); emit(result()); emit({ type: 'token', text: '搭乘公車' });
  });
  await sendChatMessage('去車站', t); unsubscribe();
  expect(getAccessibleRoute).not.toHaveBeenCalled();
  expect(router.navigate).toHaveBeenCalledTimes(1);
  expect(getRouteSessionSnapshot()).toMatchObject({ planId: 'plan-a', selectedRouteId: 'bus-b', originName: '起站', effectivePreferences: { mode: 'wheelchair', transitPreference: 'bus' } });
  expect(observations).toHaveLength(1);
  expect(JSON.stringify(useChatStore.getState())).not.toContain('token-bus');
  expect(JSON.stringify(useChatStore.getState())).not.toContain('polyline');
});

it.each(['selection', 'clear', 'stop', 'manual'] as const)('discards late SSE after %s', async (action) => {
  applyAiRoutePlan(routePlanFixture());
  request.mockImplementation(async (_input, emit, signal) => {
    emit(call);
    if (action === 'selection') selectRouteAt(0);
    if (action === 'clear') endRouteSession();
    if (action === 'stop') stopChatStreaming();
    if (action === 'manual') { jest.mocked(getAccessibleRoute).mockResolvedValue({ ok: true, status: 'success', code: 200, message: '', data: { ...routePlanFixture(), routes: [] } }); await computeRoute({ origin: { lat: 24, lng: 120 }, destination: { lat: 24.1, lng: 120.1 }, mode: 'normal' }); }
    expect(signal.aborted).toBe(true);
    emit(result()); emit({ type: 'token', text: '晚到回答' });
  });
  await sendChatMessage('規劃', t);
  expect(router.navigate).not.toHaveBeenCalled();
  expect(JSON.stringify(useChatStore.getState())).not.toContain('晚到回答');
});

it('fails closed on old backend and aborts its explanation', async () => {
  request.mockImplementation(async (_input, emit, signal) => {
    emit(call); emit({ ...result(), result: { origin: { lat: 24, lng: 120 }, destination: { lat: 25, lng: 121 } } });
    expect(signal.aborted).toBe(true); emit({ type: 'token', text: '錯誤路線說明' });
  });
  await sendChatMessage('規劃', t);
  expect(getAccessibleRoute).not.toHaveBeenCalled();
  expect(getRouteSessionSnapshot().selectRoute).toBeNull();
  expect(useChatStore.getState().entries.at(-1)?.notice).toBe('nativeAiRouteUnavailable');
});

it('pins active navigation while browsing another candidate and applies only its replacement', () => {
  const plan = routePlanFixture(); applyAiRoutePlan(plan); expect(pinNavigationRoute()).toBe(true);
  selectRouteAt(0);
  const replacement = { ...plan.routes[1], routeVersion: 2, routeToken: 'replacement' };
  expect(replaceNavigationRoute(replacement)).toBe(true);
  expect(getRouteSessionSnapshot().selectRoute?.route).toBe(plan.routes[0]);
  expect(getRouteSessionSnapshot().navigationRoute?.route).toBe(replacement);
  expect(getRouteConversationInput().routeContext).toEqual({ routeToken: plan.routes[0].routeToken });
});

it('manual routes use token without a fabricated plan and invalid tokens clear conversation context', () => {
  const plan = routePlanFixture(); applyComputedRoutes(plan.origin, plan.destination, plan.routes);
  expect(getRouteSessionSnapshot().planId).toBeNull();
  expect(getRouteConversationInput().routeContext).toEqual({ routeToken: plan.routes[0].routeToken });
  markRouteTokenInvalid(plan.routes[0].routeToken!);
  expect(getRouteConversationInput().routeContext).toBeNull(); expect(pinNavigationRoute()).toBe(false);
  expect(getRouteSessionSnapshot().computeRoutes).toEqual(plan.routes);
});

it('voice applies the same complete plan once with no second planning request', () => {
  const { createVoiceBindings } = jest.requireActual<typeof import('@/features/voice/domain/voiceSessionBindings')>('@/features/voice/domain/voiceSessionBindings');
  const { executeAction } = jest.requireActual<typeof import('../actionExecutor')>('../actionExecutor');
  const b = createVoiceBindings({ executeAction, t, publishStatus: jest.fn(), publishTool: jest.fn(), publishTranscripts: jest.fn(), setMicLevel: jest.fn(), getRouteGeneration: () => getRouteSessionSnapshot().selectionGeneration });
  b.onToolEvent({ type: 'call', name: 'plan_route', callId: 'a', turnId: 'turn-a' });
  const event = { type: 'result' as const, name: 'plan_route', callId: 'a', turnId: 'turn-a', ok: true, result: routePlanFixture() };
  b.onToolEvent(event); b.onToolEvent(event);
  expect(getAccessibleRoute).not.toHaveBeenCalled(); expect(router.navigate).toHaveBeenCalledTimes(1);
  expect(getRouteSessionSnapshot().selectedRouteId).toBe('bus-b');
});
