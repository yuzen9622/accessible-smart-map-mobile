import type { ApiResponse } from '@/shared/api';

import {
  clearMemories,
  createMemory,
  deleteMemory,
  getMemorySettings,
  isUserMemory,
  listMemories,
  updateMemory,
  updateMemorySettings,
} from '../memoryApi';

const mockRequest = jest.fn();
jest.mock('@/shared/api', () => ({
  authenticatedRequest: (...args: unknown[]) => mockRequest(...args),
  ApiError: class ApiError extends Error {
    code: number;
    constructor(message: string, code: number) {
      super(message);
      this.code = code;
    }
  },
}));

const memory = {
  id: 'm1',
  content: '偏好電梯',
  category: 'preference',
  sensitivity: 'low',
  source: 'explicit_user',
  createdAt: '2026-09-30T00:00:00.000Z',
  updatedAt: '2026-09-30T00:00:00.000Z',
  expiresAt: null,
};

function success(data: unknown): ApiResponse<unknown> {
  return { ok: true, status: 'success', code: 200, message: 'ok', data };
}
function failure(): ApiResponse<unknown> {
  return { ok: false, status: 'error', code: 500, message: 'boom', data: null };
}

beforeEach(() => mockRequest.mockReset());

describe('memory api', () => {
  it('isUserMemory rejects unknown enums and missing fields', () => {
    expect(isUserMemory(memory)).toBe(true);
    expect(isUserMemory({ ...memory, category: 'x' })).toBe(false);
    expect(isUserMemory({ ...memory, expiresAt: undefined })).toBe(false);
    expect(isUserMemory(null)).toBe(false);
  });

  it('reads and patches settings', async () => {
    mockRequest.mockResolvedValueOnce(success({ memoryEnabled: true }));
    expect(await getMemorySettings()).toBe(true);
    expect(mockRequest).toHaveBeenLastCalledWith('/api/v1/ai/memories/settings', { method: 'GET' });
    mockRequest.mockResolvedValueOnce(success({ memoryEnabled: false }));
    expect(await updateMemorySettings(false)).toBe(false);
    expect(mockRequest).toHaveBeenLastCalledWith('/api/v1/ai/memories/settings', { method: 'PATCH', body: { memoryEnabled: false } });
    mockRequest.mockResolvedValueOnce(success({ memoryEnabled: 'yes' }));
    await expect(getMemorySettings()).rejects.toThrow('ok');
  });

  it('lists only well-formed memories and throws on failure', async () => {
    mockRequest.mockResolvedValueOnce(success({ memories: [memory, { id: 1 }] }));
    expect(await listMemories()).toEqual([memory]);
    mockRequest.mockResolvedValueOnce(success({}));
    await expect(listMemories()).rejects.toThrow();
    mockRequest.mockResolvedValueOnce(failure());
    await expect(listMemories()).rejects.toThrow('boom');
  });

  it('creates, updates, deletes and clears', async () => {
    mockRequest.mockResolvedValueOnce(success({ memory }));
    expect(await createMemory({ content: 'a', category: 'place' })).toEqual(memory);
    mockRequest.mockResolvedValueOnce(success({ memory: { id: 'x' } }));
    await expect(updateMemory('m1', { content: 'b' })).rejects.toThrow();
    mockRequest.mockResolvedValueOnce(success({ deleted: true }));
    await deleteMemory('a/b');
    expect(mockRequest).toHaveBeenLastCalledWith('/api/v1/ai/memories/a%2Fb', { method: 'DELETE' });
    mockRequest.mockResolvedValueOnce(success({ deletedCount: 3 }));
    expect(await clearMemories()).toBe(3);
    mockRequest.mockResolvedValueOnce(failure());
    await expect(clearMemories()).rejects.toThrow('boom');
  });
});
