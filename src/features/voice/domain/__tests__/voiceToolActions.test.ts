// 新寫（Web 沒有對應測試）：`createVoiceBindings.onToolEvent` 的 action 分派——
// 路線直接套用後端結果；close-chat 在語音中略過。
import { routePlanFixture } from '@/features/ai/domain/testing/routePlanFixture';
import type { UIAction } from '@/features/ai/domain';

import { t } from '../testing/translate';
import { createVoiceBindings, type BindingSinks } from '../voiceSessionBindings';

const ORIGIN = { lat: 25.04, lng: 121.51 };
const DEST = { lat: 25.03, lng: 121.56 };

function makeSinks() {
  return {
    publishTranscripts: jest.fn(),
    publishStatus: jest.fn(),
    publishTool: jest.fn(),
    setMicLevel: jest.fn(),
    executeAction: jest.fn<void, [UIAction]>(),
    onRouteError: jest.fn(),
    t,
  } satisfies BindingSinks;
}

describe('voiceSessionBindings onToolEvent action routing', () => {
  it('always publishes the tool event, even when it maps to no action', () => {
    const sinks = makeSinks();
    const bindings = createVoiceBindings(sinks);
    bindings.onToolEvent({ type: 'call', name: 'findA11yPlaces' });
    bindings.onToolEvent({ type: 'result', name: 'unknownTool', result: { ok: true } });
    expect(sinks.publishTool).toHaveBeenCalledTimes(2);
    expect(sinks.executeAction).not.toHaveBeenCalled();
  });

  it('a result without a payload (null/undefined) maps nothing', () => {
    const sinks = makeSinks();
    const bindings = createVoiceBindings(sinks);
    bindings.onToolEvent({ type: 'result', name: 'plan_route', result: null });
    bindings.onToolEvent({ type: 'result', name: 'plan_route' });
    expect(sinks.executeAction).not.toHaveBeenCalled();
  });

  it('findA11yPlaces result goes through executeAction as show-markers', () => {
    const sinks = makeSinks();
    const bindings = createVoiceBindings(sinks);
    bindings.onToolEvent({
      type: 'result',
      name: 'findA11yPlaces',
      result: { ok: true, places: { nearbyBathroom: [{ _id: 'b1', name: '公園廁所', latitude: 25.03, longitude: 121.53 }] } },
    });
    expect(sinks.executeAction).toHaveBeenCalledTimes(1);
    expect(sinks.executeAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'show-markers' }));
  });

  it('rejects the old summary without calling the planner or opening a panel', () => {
    const sinks = makeSinks();
    const b = createVoiceBindings(sinks);
    b.onToolEvent({ type: 'result', name: 'plan_route', result: { origin: ORIGIN, destination: DEST } });
    expect(sinks.executeAction).not.toHaveBeenCalled();
    expect(sinks.onRouteError).toHaveBeenCalledTimes(1);
  });
  it('applies once, correlates call and turn, and keeps capabilities out of history', () => {
    const sinks = makeSinks(); const b = createVoiceBindings(sinks);
    b.onToolEvent({ type: 'call', name: 'plan_route', callId: '1', turnId: 'turn-1' });
    const event = { type: 'result' as const, name: 'plan_route', callId: '1', turnId: 'turn-1', result: routePlanFixture(), summary: '摘要' };
    b.onToolEvent(event); b.onToolEvent(event);
    expect(sinks.executeAction.mock.calls.map(([a]) => a.type)).toEqual(['show-route']);
    expect(sinks.publishTool).toHaveBeenLastCalledWith(expect.objectContaining({ summary: '摘要', result: undefined }));
  });
  it('applies two concurrent route results without mistaking its own first update for a user selection', () => {
    let generation = 1;
    const sinks = { ...makeSinks(), getRouteGeneration: () => generation };
    sinks.executeAction.mockImplementation(() => { generation++; });
    const b = createVoiceBindings(sinks);
    b.onToolEvent({ type: 'call', name: 'planAccessibleRoute', callId: 'a', turnId: 't' });
    b.onToolEvent({ type: 'call', name: 'planAccessibleRoute', callId: 'b', turnId: 't' });
    b.onToolEvent({ type: 'result', name: 'planAccessibleRoute', callId: 'a', turnId: 't', ok: true, result: routePlanFixture() });
    b.onToolEvent({ type: 'result', name: 'planAccessibleRoute', callId: 'b', turnId: 't', ok: true, result: routePlanFixture() });
    expect(sinks.executeAction).toHaveBeenCalledTimes(2);
    expect(sinks.onRouteError).not.toHaveBeenCalled();
  });

  it('rejects a result after selection changes and a mismatched turn', () => {
    let generation = 1;
    const sinks = { ...makeSinks(), getRouteGeneration: () => generation };
    const b = createVoiceBindings(sinks);
    b.onToolEvent({ type: 'call', name: 'plan_route', callId: '1', turnId: 'a' });
    generation++;
    b.onToolEvent({ type: 'result', name: 'plan_route', callId: '1', turnId: 'a', result: routePlanFixture() });
    expect(sinks.executeAction).not.toHaveBeenCalled();
    expect(sinks.onRouteError).toHaveBeenCalled();
  });
  it('pairs concurrent calls by id and keeps the remaining query visible', () => {
    const sinks = makeSinks(); const b = createVoiceBindings(sinks);
    b.onToolEvent({ type: 'call', name: 'findGooglePlaces', callId: 'a', turnId: 'turn', args: { query: 'A' } });
    b.onToolEvent({ type: 'call', name: 'findGooglePlaces', callId: 'b', turnId: 'turn', args: { query: 'B' } });
    const result = { ok: true, places: [{ name: 'A', geometry: { location: { lat: 25, lng: 121 } } }] };
    b.onToolEvent({ type: 'result', name: 'findGooglePlaces', callId: 'a', turnId: 'turn', ok: true, result });
    expect(sinks.publishTool).toHaveBeenCalledWith(expect.objectContaining({ type: 'result', callId: 'a', args: { query: 'A' }, result }));
    expect(sinks.publishTool).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'call', callId: 'b' }));
    b.onToolEvent({ type: 'result', name: 'findGooglePlaces', callId: 'a', turnId: 'turn', ok: true, result });
    expect(sinks.executeAction).toHaveBeenCalledTimes(1);
  });

  it.each([
    [false, { ok: true, places: [] }],
    [true, { ok: false, error: 'failed', places: [] }],
    [true, { status: 'ZERO_RESULTS', places: [] }],
    [true, { error: 'not available', places: [] }],
  ])('does not apply outer/inner failed results %s %j', (ok, result) => {
    const sinks = makeSinks(); const b = createVoiceBindings(sinks);
    b.onToolEvent({ type: 'call', name: 'findGooglePlaces', callId: 'a', turnId: 'turn' });
    b.onToolEvent({ type: 'result', name: 'findGooglePlaces', callId: 'a', turnId: 'turn', ok, result });
    expect(sinks.executeAction).not.toHaveBeenCalled();
    expect(sinks.publishTool).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'result', ok: false }));
  });

  it.each(['onInterrupted', 'onTurnComplete'] as const)('%s cancels pending calls and ignores their late results', boundary => {
    const clearTool = jest.fn();
    const sinks = { ...makeSinks(), clearTool }; const b = createVoiceBindings(sinks);
    b.onToolEvent({ type: 'call', name: 'findGooglePlaces', callId: 'a', turnId: 'turn' });
    b[boundary]();
    expect(clearTool).toHaveBeenCalled();
    b.onToolEvent({ type: 'result', name: 'findGooglePlaces', callId: 'a', turnId: 'turn', ok: true, result: { ok: true, places: [] } });
    expect(sinks.executeAction).not.toHaveBeenCalled();
    expect(sinks.onRouteError).not.toHaveBeenCalled();
  });

  it('ignores an unpaired or mismatched non-route result', () => {
    const sinks = makeSinks(); const b = createVoiceBindings(sinks);
    b.onToolEvent({ type: 'result', name: 'findGooglePlaces', callId: 'missing', turnId: 't', result: { ok: true, places: [] } });
    b.onToolEvent({ type: 'call', name: 'findGooglePlaces', callId: 'a', turnId: 't' });
    b.onToolEvent({ type: 'result', name: 'findA11yPlaces', callId: 'a', turnId: 't', result: { ok: true, places: {} } });
    expect(sinks.executeAction).not.toHaveBeenCalled();
  });

  it('stops the route response when applying it throws', () => {
    const sinks = makeSinks();
    sinks.executeAction.mockImplementation(() => { throw new Error('Cannot open route'); });
    const b = createVoiceBindings(sinks);
    b.onToolEvent({ type: 'call', name: 'plan_route', callId: '1', turnId: 'a' });
    sinks.publishTool.mockClear();
    expect(() => b.onToolEvent({ type: 'result', name: 'plan_route', callId: '1', turnId: 'a', result: routePlanFixture() })).not.toThrow();
    expect(sinks.onRouteError).toHaveBeenCalledTimes(1);
    expect(sinks.publishTool).not.toHaveBeenCalled();
  });
});
