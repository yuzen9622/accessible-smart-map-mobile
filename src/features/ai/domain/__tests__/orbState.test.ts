// 新寫：工具 → orb 狀態對照。
import { toolToOrbState } from '../orbState';

describe('toolToOrbState', () => {
  it.each([
    [null, 'composing'],
    [undefined, 'composing'],
    ['findA11yPlaces', 'searching'],
    ['webSearch', 'searching'],
    ['planAccessibleRoute', 'solving'],
    ['saveMemory', 'shaping'],
    ['getBusArrival', 'working'],
    ['someNewTool', 'working'],
  ])('%s → %s', (name, expected) => {
    expect(toolToOrbState(name)).toBe(expected);
  });
});
