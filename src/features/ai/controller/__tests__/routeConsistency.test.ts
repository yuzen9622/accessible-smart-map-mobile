import { changeAppLanguage } from '@/shared/i18n';
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

it('applies a second route tool call in the same turn after the first one already advanced the generation', async () => {
  // 先查附近地點再規劃路線：同一輪對話裡兩個路線工具呼叫，第一個套用時會自己把 selectionGeneration
  // 往前推一格；第二個不該被這個「自己造成的」變動誤判成過期（真實案例：使用者回報規劃路線一直失敗）。
  const call2 = { type: 'tool-call' as const, name: 'planAccessibleRoute', callId: 'call-2', args: '{}' };
  const plan2 = { ...routePlanFixture(), planId: 'plan-b', destination: { name: '大慶', lat: 24.2, lng: 120.2 } };
  const result2 = { type: 'tool-result' as const, name: call2.name, callId: call2.callId, summary: '方案摘要 2', result: plan2 };
  request.mockImplementation(async (_input, emit) => {
    emit(call); emit(call2); emit(result()); emit(result2);
  });
  await sendChatMessage('目前位置到最近車站', t);
  expect(getRouteSessionSnapshot().planId).toBe('plan-b');
  expect(useChatStore.getState().entries.at(-1)?.notice).toBeUndefined();
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


it('sends the active UI language with each chat request even when the input and history are Chinese', async () => {
  request.mockImplementation(async (_input, emit) => { emit({ type: 'token', text: '您好' }); });
  try {
    await changeAppLanguage('zh-TW'); await sendChatMessage('我要去車站', t);
    expect(request.mock.calls.at(-1)?.[0].language).toBe('zh-TW');
    await changeAppLanguage('en'); await sendChatMessage('車站在哪裡？', t);
    expect(request.mock.calls.at(-1)?.[0]).toMatchObject({ language: 'en' });
    expect(JSON.stringify(request.mock.calls.at(-1)?.[0].messages)).toContain('我要去車站');
  } finally { await changeAppLanguage('zh-TW'); }
});
