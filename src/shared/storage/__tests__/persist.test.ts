import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createMemoryStorage } from '../keyValue';
import { createPersistStorage } from '../persist';

interface CounterState {
  count: number;
  increment: () => void;
}

function createCounterStore(storage: ReturnType<typeof createMemoryStorage>) {
  return create<CounterState>()(
    persist(
      (set) => ({ count: 0, increment: () => set((state) => ({ count: state.count + 1 })) }),
      { name: 'counter', storage: createPersistStorage<CounterState>(storage) },
    ),
  );
}

describe('createPersistStorage', () => {
  it('寫入同步儲存，並在新 store 建立時同步 hydrate（不需等待）', () => {
    const storage = createMemoryStorage();
    const first = createCounterStore(storage);
    first.getState().increment();
    first.getState().increment();
    expect(JSON.parse(storage.getString('counter') ?? '{}')).toMatchObject({ state: { count: 2 } });

    const second = createCounterStore(storage);
    expect(second.persist.hasHydrated()).toBe(true);
    expect(second.getState().count).toBe(2);
  });
});
