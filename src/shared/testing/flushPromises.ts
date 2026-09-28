// 僅供測試：排空所有已排程的 promise 回呼。
//
// 以真實（未被 jest fake timers 取代）的 setImmediate 等待：它排在所有 microtask 之後，所以不論
// 非同步鏈有幾層都會跑完。取代「固定跑 N 次 await Promise.resolve()」的寫法——那種寫法在機器忙、
// 或鏈多一層時就會不夠，造成偶發失敗。
const { setImmediate: realSetImmediate } = jest.requireActual<{ setImmediate: (callback: () => void) => unknown }>('timers');

export async function flushPromises(): Promise<void> {
  await new Promise<void>((resolve) => realSetImmediate(resolve));
}
