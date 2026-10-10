import { create } from 'zustand';
import { selectIsLoggedIn, useAuthStore } from '@/features/auth';

/** Epoch fences A → B → A switches; token refresh for the same account is not an account switch. */
export const useContentSafetyStore = create<{ revision: number; ownerEpoch: number }>(() => ({ revision: 0, ownerEpoch: 0 }));
export function invalidateContentSafety(): void {
  useContentSafetyStore.setState(state => ({ revision: state.revision + 1 }));
}
/** Public reads may start anonymously; either login direction invalidates their context. */
export function captureContentContext(): () => boolean {
  const epoch = useContentSafetyStore.getState().ownerEpoch;
  return () => useContentSafetyStore.getState().ownerEpoch === epoch;
}
export function captureContentOwner(): () => boolean {
  const current = captureContentContext();
  return () => current() && selectIsLoggedIn(useAuthStore.getState());
}
useAuthStore.subscribe((next, previous) => {
  if (next.user?._id !== previous.user?._id || selectIsLoggedIn(next) !== selectIsLoggedIn(previous)) {
    useContentSafetyStore.setState(state => ({ ownerEpoch: state.ownerEpoch + 1, revision: state.revision + 1 }));
  }
});
