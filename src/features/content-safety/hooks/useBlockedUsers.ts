import { useEffect, useRef, useState } from 'react';
import { getBlockedUsers, unblockUser } from '../api/contentSafetyApi';
import type { BlockedUser } from '../domain/types';
import { captureContentOwner, invalidateContentSafety } from '../store/contentSafetyStore';

export function useBlockedUsers() {
  const [items, setItems] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const request = ++generation.current;
    const current = captureContentOwner();
    const controller = new AbortController();
    const load = async () => {
      try {
        const result = await getBlockedUsers(controller.signal);
        if (current() && request === generation.current) setItems(result);
      } catch {
        if (current() && request === generation.current) setError(true);
      } finally {
        if (current() && request === generation.current) setLoading(false);
      }
    };
    void load();
    return () => { controller.abort(); generation.current = request + 1; };
  }, [attempt]);
  const unblock = async (id: string) => {
    if (busy.current || loading) return;
    const current = captureContentOwner();
    const request = generation.current;
    busy.current = true; setPending(id); setError(false);
    try {
      await unblockUser(id);
      if (!current()) return;
      invalidateContentSafety();
      if (request === generation.current) setItems(previous => previous.filter(item => item.blockId !== id));
    } catch { if (current() && request === generation.current) setError(true); }
    finally { busy.current = false; if (current() && request === generation.current) setPending(null); }
  };
  return { items, loading, error, pending, retry: () => { if (busy.current) return; setLoading(true); setError(false); setAttempt(value => value + 1); }, unblock: (id: string) => void unblock(id) };
}
export type BlockedUsersModel = ReturnType<typeof useBlockedUsers>;
