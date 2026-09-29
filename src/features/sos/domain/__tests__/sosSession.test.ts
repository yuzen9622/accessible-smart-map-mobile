import { createMemoryStorage } from '@/shared/storage';

import { buildSosShareUrl, handlingSummary, parseShareToken } from '../sosDisplay';
import {
  SOS_MAX_AGE_MS,
  SOS_STORAGE_KEY,
  clearActiveSos,
  loadActiveSos,
  markResolvePending,
  recoveryAction,
  saveActiveSos,
} from '../sosSession';
import { isSosSnapshot, type SosSnapshot } from '../types';

describe('active SOS persistence (recovery hint only)', () => {
  it('round-trips the session id and share token', () => {
    const storage = createMemoryStorage();
    saveActiveSos(storage, 's1', 'a'.repeat(32), 'u1', 1000);
    expect(loadActiveSos(storage, 2000)).toEqual({
      sessionId: 's1',
      shareToken: 'a'.repeat(32),
      ownerId: 'u1',
      resolvePending: false,
      savedAt: 1000,
    });
  });

  it('marks a failed resolve as pending so the next launch retries it', () => {
    const storage = createMemoryStorage();
    saveActiveSos(storage, 's1', null, 'u1');
    markResolvePending(storage);
    expect(loadActiveSos(storage)?.resolvePending).toBe(true);
  });

  it('drops (and deletes) entries older than 12h', () => {
    const storage = createMemoryStorage();
    saveActiveSos(storage, 's1', null, null, 0);
    expect(loadActiveSos(storage, SOS_MAX_AGE_MS + 1)).toBeNull();
    expect(storage.getString(SOS_STORAGE_KEY)).toBeUndefined();
  });

  it('keeps an entry exactly 12h old', () => {
    const storage = createMemoryStorage();
    saveActiveSos(storage, 's1', null, null, 0);
    expect(loadActiveSos(storage, SOS_MAX_AGE_MS)?.sessionId).toBe('s1');
  });

  it('ignores garbage and clears', () => {
    const storage = createMemoryStorage({ [SOS_STORAGE_KEY]: '{bad' });
    expect(loadActiveSos(storage)).toBeNull();
    saveActiveSos(storage, 's2', null, null);
    clearActiveSos(storage);
    expect(loadActiveSos(storage)).toBeNull();
  });
});

describe('recoveryAction — the server is the source of truth', () => {
  it('resumes only when the server says active', () => {
    expect(recoveryAction({ kind: 'snapshot', status: 'active' })).toBe('resume');
    expect(recoveryAction({ kind: 'snapshot', status: 'resolved' })).toBe('clear');
  });

  it('clears on 404/410, keeps on transient failures so the next launch retries', () => {
    expect(recoveryAction({ kind: 'gone' })).toBe('clear');
    expect(recoveryAction({ kind: 'transient' })).toBe('keep');
    expect(recoveryAction({ kind: 'empty' })).toBe('keep');
  });
});

const base: SosSnapshot = {
  sessionId: 's',
  status: 'active',
  handlingStatus: 'claimed',
  claimedBy: 'U1',
  claimedByName: '媽媽',
  claimedAt: null,
  acknowledgements: [{ lineUserId: 'U1', name: '媽媽', at: 'x' }],
  timeline: [{ type: 'claimed', actorType: 'contact', actorName: '媽媽', note: null, at: 'x' }],
  location: { lat: 25, lng: 121, address: null, updatedAt: 'x' },
  resolvedAt: null,
  updatedAt: 'x',
};

describe('display helpers', () => {
  it('summarises handler, then acknowledgements, then sharing', () => {
    expect(handlingSummary(base)).toEqual({ kind: 'handler', name: '媽媽', statusKey: 'sosHandlingClaimed' });
    expect(handlingSummary({ ...base, claimedByName: null })).toEqual({ kind: 'acks', count: 1 });
    expect(handlingSummary({ ...base, claimedByName: null, acknowledgements: [] })).toEqual({ kind: 'sharing' });
    expect(handlingSummary(null)).toEqual({ kind: 'sharing' });
  });

  it('builds share links with the share token, not the session id', () => {
    expect(buildSosShareUrl('https://map.yuzen.dev/', 'zh-TW', 'ab'.repeat(16))).toBe(`https://map.yuzen.dev/zh-TW?sos=${'ab'.repeat(16)}`);
  });

  it('accepts only 32-hex share tokens', () => {
    expect(parseShareToken('AB'.repeat(16))).toBe('ab'.repeat(16));
    expect(parseShareToken('65f0c0ffee')).toBeNull();
    expect(parseShareToken(undefined)).toBeNull();
  });

  it('validates snapshots from the wire', () => {
    expect(isSosSnapshot(base)).toBe(true);
    expect(isSosSnapshot({ ...base, handlingStatus: 'lost' })).toBe(false);
    expect(isSosSnapshot({ ...base, location: null })).toBe(true);
  });
});
