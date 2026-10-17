import type { ApiResponse } from '@/shared/api';

import { rotateSosShareToken } from '../sosApi';

const mockAuthenticatedRequest = jest.fn();

jest.mock('@/shared/api', () => {
  class MockApiError extends Error {
    code: number;

    constructor(message: string, status: number) {
      super(message);
      this.code = status;
    }
  }
  return {
    ApiError: MockApiError,
    authenticatedRequest: (...args: unknown[]) => mockAuthenticatedRequest(...args),
  fetchRequest: jest.fn(),
  getAccessToken: jest.fn(),
    streamSse: jest.fn(),
  };
});

function envelope(data: unknown): ApiResponse<unknown> {
  return { ok: true, status: 'success', code: 200, message: 'ok', data };
}

beforeEach(() => mockAuthenticatedRequest.mockReset());

describe('SOS share-token API', () => {
  it('posts to the owner-only rotation endpoint and returns the new token', async () => {
    mockAuthenticatedRequest.mockResolvedValue(
      envelope({ sessionId: 'session / 1', shareToken: 'ab'.repeat(16) }),
    );

    await expect(rotateSosShareToken('session / 1')).resolves.toEqual({
      sessionId: 'session / 1',
      shareToken: 'ab'.repeat(16),
    });
    expect(mockAuthenticatedRequest).toHaveBeenCalledWith(
      '/api/v1/sos/sessions/session%20%2F%201/share-token',
      { method: 'POST' },
    );
  });
});
