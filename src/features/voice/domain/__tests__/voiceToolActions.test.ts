// 新寫（Web 沒有對應測試）：`createVoiceBindings.onToolEvent` 的 action 分派——
// 同步 action 走 executeAction、compute-route 走獨立的 async sink（SDD §6.6 雙路徑）、close-chat 在語音中略過。
import type { UIAction } from '@/features/ai/domain';

import { t } from '../testing/translate';
import { createVoiceBindings, type BindingSinks } from '../voiceSessionBindings';

const ORIGIN = { lat: 25.04, lng: 121.51 };
const DEST = { lat: 25.03, lng: 121.56 };

function makeSinks(
  computeRoute: BindingSinks['computeRoute'] = () => Promise.resolve(),
  onComputeRouteError?: BindingSinks['onComputeRouteError'],
) {
  return {
    publishTranscripts: jest.fn(),
    publishStatus: jest.fn(),
    publishTool: jest.fn(),
    setMicLevel: jest.fn(),
    executeAction: jest.fn<void, [UIAction]>(),
    computeRoute: jest.fn(computeRoute),
    onComputeRouteError,
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
    expect(sinks.computeRoute).not.toHaveBeenCalled();
  });

  it('a result without a payload (null/undefined) maps nothing', () => {
    const sinks = makeSinks();
    const bindings = createVoiceBindings(sinks);
    bindings.onToolEvent({ type: 'result', name: 'plan_route', result: null });
    bindings.onToolEvent({ type: 'result', name: 'plan_route' });
    expect(sinks.executeAction).not.toHaveBeenCalled();
    expect(sinks.computeRoute).not.toHaveBeenCalled();
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

  it('plan_route without drawable routes: compute-route goes to the async sink, switch-panel to executeAction', () => {
    const sinks = makeSinks();
    const bindings = createVoiceBindings(sinks);
    bindings.onToolEvent({
      type: 'result',
      name: 'plan_route',
      result: { origin: ORIGIN, destination: DEST },
    });
    expect(sinks.computeRoute).toHaveBeenCalledWith(ORIGIN, DEST);
    expect(sinks.executeAction).toHaveBeenCalledTimes(1);
    expect(sinks.executeAction).toHaveBeenCalledWith({ type: 'switch-panel', sheet: 'route' });
  });

  it('plan_route with drawable routes: show-route + switch-panel, no async compute', () => {
    const sinks = makeSinks();
    const bindings = createVoiceBindings(sinks);
    bindings.onToolEvent({
      type: 'result',
      name: 'plan_route',
      result: {
        origin: ORIGIN,
        destination: DEST,
        routes: [{ routeId: 'r1', legs: [{ polyline: [[121.51, 25.04]] }] }],
      },
    });
    expect(sinks.computeRoute).not.toHaveBeenCalled();
    expect(sinks.executeAction.mock.calls.map((c) => c[0].type)).toEqual(['show-route', 'switch-panel']);
  });

  it('a rejected computeRoute is reported to onComputeRouteError instead of escaping', async () => {
    const failure = new Error('route failed');
    const onComputeRouteError = jest.fn();
    const sinks = makeSinks(() => Promise.reject(failure), onComputeRouteError);
    const bindings = createVoiceBindings(sinks);
    bindings.onToolEvent({ type: 'result', name: 'plan_route', result: { origin: ORIGIN, destination: DEST } });
    await Promise.resolve();
    await Promise.resolve();
    expect(onComputeRouteError).toHaveBeenCalledWith(failure);
  });

  it('a rejected computeRoute without onComputeRouteError only warns', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const sinks = makeSinks(() => Promise.reject(new Error('x')));
    const bindings = createVoiceBindings(sinks);
    bindings.onToolEvent({ type: 'result', name: 'plan_route', result: { origin: ORIGIN, destination: DEST } });
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
