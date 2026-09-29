import { fetch as expoFetchMock } from 'expo/fetch';

import { createSseParser, streamSse, type SseEvent } from '../sse';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

const mockExpoFetch = expoFetchMock as unknown as jest.MockedFunction<typeof expoFetchMock>;

/** `expo/fetch` 的 Response 型別有一堆內部實作欄位；測試只用得到 `.body`。 */
type ExpoFetchResponse = Awaited<ReturnType<typeof expoFetchMock>>;

describe('createSseParser', () => {
  it('reassembles a single event whose lines are split arbitrarily across feed calls', () => {
    const parser = createSseParser();
    const chunks = ['ev', 'ent: tok', 'en\nda', 'ta: hel', 'lo\n\n'];
    const events = chunks.flatMap((chunk) => parser.feed(chunk));
    expect(events).toEqual([{ event: 'token', data: 'hello', id: undefined }]);
  });

  it('joins multiple data: lines with \\n per the SSE spec', () => {
    const parser = createSseParser();
    const events = parser.feed('data: line1\ndata: line2\n\n');
    expect(events).toEqual([{ event: 'message', data: 'line1\nline2', id: undefined }]);
  });

  it('defaults event to "message" when no event: field is given', () => {
    const parser = createSseParser();
    const events = parser.feed('data: hi\n\n');
    expect(events).toEqual([{ event: 'message', data: 'hi', id: undefined }]);
  });

  it('carries the id: field through to the dispatched event', () => {
    const parser = createSseParser();
    const events = parser.feed('id: 42\nevent: done\ndata: {}\n\n');
    expect(events).toEqual([{ event: 'done', data: '{}', id: '42' }]);
  });

  it('handles CRLF line endings, including a boundary split mid CRLF across feed calls', () => {
    const parser = createSseParser();
    const events: SseEvent[] = [];
    events.push(...parser.feed('event: token\r\ndata: hi\r'));
    events.push(...parser.feed('\n\r\n'));
    expect(events).toEqual([{ event: 'token', data: 'hi', id: undefined }]);
  });

  it('ignores comment lines starting with a colon', () => {
    const parser = createSseParser();
    const events = parser.feed(': keep-alive\ndata: hi\n\n');
    expect(events).toEqual([{ event: 'message', data: 'hi', id: undefined }]);
  });

  it('does not dispatch on consecutive blank lines with no pending fields', () => {
    const parser = createSseParser();
    const events = parser.feed('\n\ndata: hi\n\n');
    expect(events).toEqual([{ event: 'message', data: 'hi', id: undefined }]);
  });

  it('dispatches multiple events fed in one chunk', () => {
    const parser = createSseParser();
    const events = parser.feed('data: one\n\ndata: two\n\n');
    expect(events).toEqual([
      { event: 'message', data: 'one', id: undefined },
      { event: 'message', data: 'two', id: undefined },
    ]);
  });

  it('reconstructs a UTF-8 multi-byte character split across chunk boundaries when decoded in stream mode', () => {
    // 驗證 sse.ts 選用 `TextDecoder({ stream: true })` 的原因：多位元組字元的
    // bytes 若剛好被切在兩個 network chunk 中間，decoder 必須在 stream 模式下
    // 緩住不完整的位元組序列，而不是把半個字元丟給 parser。
    const parser = createSseParser();
    const decoder = new TextDecoder();
    const encoded = new TextEncoder().encode('data: 你好\n\n');
    // "data: " 是 6 個 ASCII bytes；「你」以 UTF-8 編碼為 3 bytes
    // （E4 BD A0）。在第 7 個 byte（「你」的第一個 byte）之後切斷，讓這個
    // 多位元組字元被硬生生切成兩半。
    const splitPoint = 7;
    const first = encoded.slice(0, splitPoint);
    const second = encoded.slice(splitPoint);

    const events: SseEvent[] = [];
    events.push(...parser.feed(decoder.decode(first, { stream: true })));
    events.push(...parser.feed(decoder.decode(second, { stream: true })));

    expect(events).toEqual([{ event: 'message', data: '你好', id: undefined }]);
  });
});

describe('streamSse', () => {
  beforeEach(() => {
    mockExpoFetch.mockReset();
  });

  function makeStreamResponse(chunks: string[]): ExpoFetchResponse {
    const encoder = new TextEncoder();
    let index = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (index < chunks.length) {
          controller.enqueue(encoder.encode(chunks[index]));
          index += 1;
        } else {
          controller.close();
        }
      },
    });
    return { body } as unknown as ExpoFetchResponse;
  }

  it('emits parsed events for each chunk read from the stream', async () => {
    mockExpoFetch.mockResolvedValueOnce(makeStreamResponse(['data: hello\n\n', 'data: world\n\n']));

    const received: SseEvent[] = [];
    await streamSse(
      'http://test.local/api/v1/ai/chat',
      { method: 'POST', body: '{}', headers: { Authorization: 'Bearer token' } },
      { onEvent: (event) => received.push(event) },
    );

    expect(mockExpoFetch).toHaveBeenCalledWith(
      'http://test.local/api/v1/ai/chat',
      expect.objectContaining({ method: 'POST', body: '{}' }),
    );
    expect(received).toEqual([
      { event: 'message', data: 'hello', id: undefined },
      { event: 'message', data: 'world', id: undefined },
    ]);
  });

  it('stops reading and propagates cancellation when the AbortSignal fires mid-stream', async () => {
    const controller = new AbortController();
    const abortError = new DOMException('Aborted', 'AbortError');
    const encoder = new TextEncoder();
    let pullCount = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(streamController) {
        pullCount += 1;
        if (pullCount === 1) {
          streamController.enqueue(encoder.encode('data: first\n\n'));
          return;
        }
        // 模擬 abort 後續讀取被取消：第二次 pull 直接以 AbortError reject，
        // 對應 expo/fetch 的 ReadableStream 在 signal abort 時的行為。
        controller.abort();
        streamController.error(abortError);
      },
    });
    mockExpoFetch.mockResolvedValueOnce({ body } as unknown as ExpoFetchResponse);

    const received: SseEvent[] = [];

    await expect(
      streamSse(
        'http://test.local/api/v1/ai/chat',
        { method: 'POST' },
        { onEvent: (event) => received.push(event), signal: controller.signal },
      ),
    ).rejects.toThrow('Aborted');

    expect(received).toEqual([{ event: 'message', data: 'first', id: undefined }]);
    expect(mockExpoFetch).toHaveBeenCalledWith(
      'http://test.local/api/v1/ai/chat',
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('returns immediately without reading when the response has no body', async () => {
    mockExpoFetch.mockResolvedValueOnce({ body: null } as unknown as ExpoFetchResponse);

    const received: SseEvent[] = [];
    await streamSse('http://test.local/api/v1/ai/chat', {}, { onEvent: (event) => received.push(event) });

    expect(received).toEqual([]);
  });
});
