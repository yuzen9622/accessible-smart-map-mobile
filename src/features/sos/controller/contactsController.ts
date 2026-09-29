import { create } from 'zustand';

import { ApiError } from '@/shared/api';
import { appStateVisibility, createPoller, type Poller } from '@/shared/polling';

import { createEmergencyContact, deleteEmergencyContact, getEmergencyContacts } from '../api/sosApi';
import { MAX_EMERGENCY_CONTACTS, type CreateEmergencyContactResult } from '../domain/types';
import { useSosStore } from '../store/sosStore';

/**
 * 緊急聯絡人管理，對齊 Web `EmergencyContactsManager.tsx`（commit f82cda8）：
 * - 上限 5 人；姓名 1–50 字。
 * - 建立後只在當下拿得到綁定連結與綁定碼（之後的列表不回傳）；刪除該聯絡人時一併清掉。
 * - 還有「待綁定」的聯絡人時每 5 秒重抓，全部綁定後停止（原生以 AppState 感知的 poller，背景不打 API）。
 * 列表寫進 `useSosStore.contacts`，SOS 進行中畫面顯示「已通知」名單時共用同一份。
 */

export const CONTACTS_POLL_MS = 5000;

interface ContactsUiState {
  loading: boolean;
  submitting: boolean;
  error: string | null;
  justCreated: CreateEmergencyContactResult | null;
}

export const useContactsUiStore = create<ContactsUiState>(() => ({
  loading: false,
  submitting: false,
  error: null,
  justCreated: null,
}));

async function fetchContacts(signal?: AbortSignal): Promise<void> {
  const contacts = await getEmergencyContacts();
  if (signal?.aborted) return;
  useSosStore.setState({ contacts });
}

export async function loadContacts(): Promise<void> {
  useContactsUiStore.setState({ loading: true, error: null });
  try {
    await fetchContacts();
  } catch (error) {
    useContactsUiStore.setState({ error: error instanceof Error ? error.message : 'error' });
  } finally {
    useContactsUiStore.setState({ loading: false });
  }
}

let poller: Poller | null = null;

/** 有待綁定的聯絡人就開始輪詢，否則停止。畫面離開時呼叫 `stopContactsPolling`。 */
export function syncContactsPolling(): void {
  const pending = useSosStore.getState().contacts.some((c) => c.bindStatus === 'pending');
  if (pending && !poller) {
    poller = createPoller({
      intervalMs: CONTACTS_POLL_MS,
      visibility: appStateVisibility,
      task: async ({ signal, first }) => {
        if (first) return; // 剛載入過，不必立即再抓
        await fetchContacts(signal);
      },
    });
    poller.start();
  } else if (!pending && poller) {
    stopContactsPolling();
  }
}

export function stopContactsPolling(): void {
  poller?.stop();
  poller = null;
}

export type AddContactResult = { ok: true } | { ok: false; reason: 'empty' | 'limit' | 'failed'; message?: string };

export async function addContact(rawName: string): Promise<AddContactResult> {
  const name = rawName.trim();
  if (!name || name.length > 50) return { ok: false, reason: 'empty' };
  if (useSosStore.getState().contacts.length >= MAX_EMERGENCY_CONTACTS) return { ok: false, reason: 'limit' };
  useContactsUiStore.setState({ submitting: true });
  try {
    const created = await createEmergencyContact(name);
    useSosStore.setState((s) => ({ contacts: [created.contact, ...s.contacts] }));
    useContactsUiStore.setState({ justCreated: created });
    syncContactsPolling();
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.reason === 'CONTACT_LIMIT_REACHED') return { ok: false, reason: 'limit' };
    return { ok: false, reason: 'failed', message: error instanceof Error ? error.message : undefined };
  } finally {
    useContactsUiStore.setState({ submitting: false });
  }
}

export async function removeContact(id: string): Promise<boolean> {
  try {
    await deleteEmergencyContact(id);
    useSosStore.setState((s) => ({ contacts: s.contacts.filter((c) => c._id !== id) }));
    if (useContactsUiStore.getState().justCreated?.contact._id === id) useContactsUiStore.setState({ justCreated: null });
    syncContactsPolling();
    return true;
  } catch {
    // 刪除失敗：重新同步列表，避免畫面與伺服器不一致（對齊 Web）
    await loadContacts();
    return false;
  }
}

export function dismissJustCreated(): void {
  useContactsUiStore.setState({ justCreated: null });
}
