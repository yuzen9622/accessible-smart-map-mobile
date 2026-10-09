import type { NavInstruction } from '@/features/route/domain';

import type { LiveNavigationPort, LiveNavigationSnapshot } from '../../domain/liveNavigation';
import { useNavStore } from '../../store/navStore';
import { startLiveNavigationDriver } from '../liveNavigationDriver';

function step(text: string, relativeDirection: NavInstruction['relativeDirection'] = '右側'): NavInstruction {
  return { text, type: 'turn', bearing: null, relativeDirection, distanceM: 50, streetName: null, legType: 'WALK', polylineIndex: 0 };
}

function fakePort() {
  const calls: { kind: 'start' | 'update' | 'end'; snapshot?: LiveNavigationSnapshot }[] = [];
  const port: LiveNavigationPort = {
    start: (snapshot) => calls.push({ kind: 'start', snapshot }),
    update: (snapshot) => calls.push({ kind: 'update', snapshot }),
    end: () => calls.push({ kind: 'end' }),
  };
  return { port, calls };
}

beforeEach(() => {
  useNavStore.getState().setIsNavigating(false);
  useNavStore.getState().reset();
});

describe('startLiveNavigationDriver', () => {
  it('does nothing until navigation starts, then starts once with the current step', () => {
    const { port, calls } = fakePort();
    const stop = startLiveNavigationDriver(port, () => 0);
    expect(calls).toHaveLength(0);
    useNavStore.getState().setInstructions([step('右轉進入忠孝東路')]);
    useNavStore.getState().setIsNavigating(true);
    expect(calls.map((c) => c.kind)).toEqual(['start']);
    expect(calls[0]?.snapshot).toMatchObject({ instruction: '右轉進入忠孝東路', icon: 'cornerUpRight', rerouting: false });
    stop();
  });

  it('throttles small distance changes but sends turn changes immediately', () => {
    let t = 0;
    const { port, calls } = fakePort();
    useNavStore.getState().setInstructions([step('A'), step('B', '左側')]);
    useNavStore.getState().setDistanceToNextM(100);
    useNavStore.getState().setIsNavigating(true);
    const stop = startLiveNavigationDriver(port, () => t);
    t = 500;
    useNavStore.getState().setDistanceToNextM(95); // <2 s → dropped
    t = 3000;
    useNavStore.getState().setDistanceToNextM(94); // <10 m → dropped
    t = 3100;
    useNavStore.getState().setCurrentStepIndex(1); // turn change → sent now
    expect(calls.map((c) => c.kind)).toEqual(['start', 'update']);
    expect(calls[1]?.snapshot?.instruction).toBe('B');
    stop();
  });

  it('switches the lock screen to rerouting immediately', () => {
    const { port, calls } = fakePort();
    useNavStore.getState().setInstructions([step('A')]);
    useNavStore.getState().setIsNavigating(true);
    const stop = startLiveNavigationDriver(port, () => 0);
    useNavStore.getState().setReroutePending();
    expect(calls.at(-1)).toMatchObject({ kind: 'update', snapshot: { rerouting: true } });
    stop();
  });

  it('ends immediately on arrival and on stop, only once', () => {
    const { port, calls } = fakePort();
    useNavStore.getState().setInstructions([step('A')]);
    useNavStore.getState().setIsNavigating(true);
    const stop = startLiveNavigationDriver(port, () => 0);
    useNavStore.getState().setArrived(true);
    expect(calls.map((c) => c.kind)).toEqual(['start', 'end']);
    stop();
    expect(calls.filter((c) => c.kind === 'end')).toHaveLength(1);
  });

  it('ends when navigation is stopped', () => {
    const { port, calls } = fakePort();
    useNavStore.getState().setInstructions([step('A')]);
    useNavStore.getState().setIsNavigating(true);
    const stop = startLiveNavigationDriver(port, () => 0);
    useNavStore.getState().setIsNavigating(false);
    expect(calls.map((c) => c.kind)).toEqual(['start', 'end']);
    stop();
  });
});

it('removes stale lock-screen guidance when the token expires', () => {
  const { port, calls } = fakePort();
  useNavStore.getState().setInstructions([step('A')]);
  useNavStore.getState().setIsNavigating(true);
  const stop = startLiveNavigationDriver(port);
  useNavStore.setState({ instructionError: 'expired' });
  expect(calls.map((call) => call.kind)).toEqual(['start', 'end']);
  stop();
});
