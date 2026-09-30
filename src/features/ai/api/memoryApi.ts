import { ApiError, authenticatedRequest } from '@/shared/api';

import type {
  CreateMemoryBody,
  UpdateMemoryBody,
  UserMemory,
} from '../domain/types';

/**
 * 移植自 Web `src/lib/api/memory.ts`。後端契約：`taipei-accessible-backend/src/modules/ai/ai.router.ts`
 * 第 50–90 行；設定用 PATCH（不是 PUT），回應都是 `{ success, data }` 包裝。
 */

const BASE = '/api/v1/ai/memories';

const CATEGORIES: readonly string[] = ['preference', 'place', 'habit', 'context'];
const SENSITIVITIES: readonly string[] = ['low', 'medium', 'high'];
const SOURCES: readonly string[] = ['explicit_user', 'agent_suggested', 'distilled'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function ok(res: { ok?: boolean; success?: boolean }): boolean {
  return res.ok === true || res.success === true;
}

export function isUserMemory(value: unknown): value is UserMemory {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.content === 'string' &&
    typeof value.category === 'string' &&
    CATEGORIES.includes(value.category) &&
    typeof value.sensitivity === 'string' &&
    SENSITIVITIES.includes(value.sensitivity) &&
    typeof value.source === 'string' &&
    SOURCES.includes(value.source) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    (value.expiresAt === null || typeof value.expiresAt === 'string')
  );
}

export async function getMemorySettings(): Promise<boolean> {
  const res = await authenticatedRequest(`${BASE}/settings`, { method: 'GET' });
  if (!ok(res) || !isRecord(res.data) || typeof res.data.memoryEnabled !== 'boolean') throw new ApiError(res.message, res.code);
  return res.data.memoryEnabled;
}

export async function updateMemorySettings(memoryEnabled: boolean): Promise<boolean> {
  const res = await authenticatedRequest(`${BASE}/settings`, { method: 'PATCH', body: { memoryEnabled } });
  if (!ok(res) || !isRecord(res.data) || typeof res.data.memoryEnabled !== 'boolean') throw new ApiError(res.message, res.code);
  return res.data.memoryEnabled;
}

export async function listMemories(limit = 100): Promise<UserMemory[]> {
  const res = await authenticatedRequest(`${BASE}?limit=${limit}`, { method: 'GET' });
  if (!ok(res) || !isRecord(res.data) || !Array.isArray(res.data.memories)) throw new ApiError(res.message, res.code);
  return res.data.memories.filter(isUserMemory);
}

export async function createMemory(body: CreateMemoryBody): Promise<UserMemory> {
  const res = await authenticatedRequest(BASE, { method: 'POST', body });
  if (!ok(res) || !isRecord(res.data) || !isUserMemory(res.data.memory)) throw new ApiError(res.message, res.code);
  return res.data.memory;
}

export async function updateMemory(id: string, body: UpdateMemoryBody): Promise<UserMemory> {
  const res = await authenticatedRequest(`${BASE}/${encodeURIComponent(id)}`, { method: 'PATCH', body });
  if (!ok(res) || !isRecord(res.data) || !isUserMemory(res.data.memory)) throw new ApiError(res.message, res.code);
  return res.data.memory;
}

export async function deleteMemory(id: string): Promise<void> {
  const res = await authenticatedRequest(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!ok(res)) throw new ApiError(res.message, res.code);
}

export async function clearMemories(): Promise<number> {
  const res = await authenticatedRequest(BASE, { method: 'DELETE' });
  if (!ok(res)) throw new ApiError(res.message, res.code);
  return isRecord(res.data) && typeof res.data.deletedCount === 'number' ? res.data.deletedCount : 0;
}
