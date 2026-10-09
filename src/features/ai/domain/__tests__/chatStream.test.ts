// 新寫：SSE event 解讀與 bubble reducer。bubble 語意對照 Web `useAIChat.ts` 的 onChunk／onToolCall／finally。
import {
  applyStreamSignal,
  applyToken,
  applyToolCall,
  applyToolResult,
  interpretChatSseEvent,
  settleBubble,
} from '../chatStream';
import type { ChatBubble } from '../types';

const ev = (event: string, data: string) => interpretChatSseEvent({ event, data });

describe('interpretChatSseEvent（後端標準 SSE）', () => {
  it('token', () => {
    expect(ev('token', JSON.stringify({ text: '你好' }))).toEqual({ type: 'token', text: '你好' });
  });

  it('tool_call：args 物件 → JSON 字串；字串原樣', () => {
    expect(ev('tool_call', JSON.stringify({ name: 'webSearch', args: { query: '電梯' } }))).toEqual({
      type: 'tool-call',
      name: 'webSearch',
      args: '{"query":"電梯"}',
    });
    expect(ev('tool_call', JSON.stringify({ name: 'webSearch', args: '{"query":"a"}' }))).toEqual({
      type: 'tool-call',
      name: 'webSearch',
      args: '{"query":"a"}',
    });
  });

  it('tool_result 保留 result 原樣', () => {
    expect(ev('tool_result', JSON.stringify({ name: 'trackBuses', result: { ok: true, count: 2 } }))).toEqual({
      type: 'tool-result',
      name: 'trackBuses',
      result: { ok: true, count: 2 },
    });
  });

  it('error：有 code 與 message；缺 code 為 null', () => {
    expect(ev('error', JSON.stringify({ code: 429, message: '太多請求' }))).toEqual({
      type: 'error',
      code: 429,
      message: '太多請求',
    });
    expect(ev('error', JSON.stringify({ message: 'boom' }))).toEqual({ type: 'error', code: null, message: 'boom' });
  });

  it('done', () => {
    expect(ev('done', 'done')).toEqual({ type: 'done' });
  });

  it('壞掉的 JSON、缺欄位、未知 event → null', () => {
    expect(ev('token', '{壞')).toBeNull();
    expect(ev('token', JSON.stringify({ text: 1 }))).toBeNull();
    expect(ev('token', JSON.stringify({}))).toBeNull();
    expect(ev('tool_call', JSON.stringify({ args: {} }))).toBeNull();
    expect(ev('tool_result', JSON.stringify({ result: 1 }))).toBeNull();
    // 錯誤事件的 data 不是 JSON 也不能丟掉：原文當訊息回報
    expect(ev('error', 'plain text')).toEqual({ type: 'error', code: null, message: 'plain text' });
    expect(ev('ping', '')).toBeNull();
  });
});

describe('interpretChatSseEvent（Web 舊格式容錯，event 為 message）', () => {
  it('[DONE] 與 done', () => {
    expect(ev('message', '[DONE]')).toEqual({ type: 'done' });
    expect(ev('message', 'done')).toEqual({ type: 'done' });
  });

  it('{text}', () => {
    expect(ev('message', JSON.stringify({ text: '嗨' }))).toEqual({ type: 'token', text: '嗨' });
  });

  it('{name,args} → tool-call；{name,result} → tool-result；{name,arguments} → tool-call', () => {
    expect(ev('message', JSON.stringify({ name: 'a', args: { x: 1 } }))).toEqual({
      type: 'tool-call',
      name: 'a',
      args: '{"x":1}',
    });
    expect(ev('message', JSON.stringify({ name: 'a', result: [1] }))).toEqual({
      type: 'tool-result',
      name: 'a',
      result: [1],
    });
    expect(ev('message', JSON.stringify({ name: 'a', arguments: '{"y":2}' }))).toEqual({
      type: 'tool-call',
      name: 'a',
      args: '{"y":2}',
    });
  });

  it('OpenAI choices[0].delta.content', () => {
    expect(ev('message', JSON.stringify({ choices: [{ delta: { content: '片段' } }] }))).toEqual({
      type: 'token',
      text: '片段',
    });
    expect(ev('message', JSON.stringify({ choices: [{ delta: {} }] }))).toBeNull();
  });

  it('空 event 名稱視同 message；壞 JSON → null', () => {
    expect(ev('', JSON.stringify({ text: 'x' }))).toEqual({ type: 'token', text: 'x' });
    expect(ev('message', '{壞')).toBeNull();
  });
});

const empty = (): ChatBubble => ({ role: 'assistant', content: '', isStreaming: true, toolActivities: [] });

describe('applyToken', () => {
  it('累加內容、保持串流中，並把所有工具標為完成', () => {
    const bubble: ChatBubble = {
      ...empty(),
      content: '你',
      toolActivities: [{ name: 'a', args: '{}', status: 'running' }],
    };
    expect(applyToken(bubble, '好')).toEqual({
      role: 'assistant',
      content: '你好',
      isStreaming: true,
      toolActivities: [{ name: 'a', args: '{}', status: 'done' }],
    });
  });

  it('沒有 toolActivities 時維持 undefined，且不改動原物件', () => {
    const bubble: ChatBubble = { role: 'assistant', content: '' };
    const next = applyToken(bubble, 'x');
    expect(next.toolActivities).toBeUndefined();
    expect(bubble.content).toBe('');
  });
});

describe('applyToolCall', () => {
  it('新工具：加入 running 活動', () => {
    expect(applyToolCall(empty(), 'a', '{"q":1}').toolActivities).toEqual([
      { name: 'a', args: '{"q":1}', result: undefined, status: 'running' },
    ]);
  });

  it('新呼叫會把先前仍在跑的活動標為完成', () => {
    const b1 = applyToolCall(empty(), 'a', '1');
    const b2 = applyToolCall(b1, 'b', '2');
    expect(b2.toolActivities?.map((x) => [x.name, x.status])).toEqual([
      ['a', 'done'],
      ['b', 'running'],
    ]);
  });

  it('同名且 running：更新 args，不新增', () => {
    const b1 = applyToolCall(empty(), 'a', '1');
    const b2 = applyToolCall(b1, 'a', '2');
    expect(b2.toolActivities).toHaveLength(1);
    expect(b2.toolActivities?.[0]).toMatchObject({ args: '2', status: 'running' });
  });

  it('同名但已完成：視為新的一次呼叫', () => {
    const b1 = applyToolResult(applyToolCall(empty(), 'a', '1'), 'a', { ok: true });
    const b2 = applyToolCall(b1, 'a', '2');
    expect(b2.toolActivities?.map((x) => x.status)).toEqual(['done', 'running']);
  });
});

describe('applyToolResult', () => {
  it('對到同名 running：補 result、標完成、沿用 args', () => {
    const b = applyToolResult(applyToolCall(empty(), 'a', '{"q":1}'), 'a', { ok: true });
    expect(b.toolActivities).toEqual([{ name: 'a', args: '{"q":1}', result: { ok: true }, status: 'done' }]);
  });

  it('對不到（沒有 tool_call）：新增已完成活動，args 為空字串，先前的活動標完成', () => {
    const b = applyToolResult(applyToolCall(empty(), 'x', '1'), 'a', 7);
    expect(b.toolActivities).toEqual([
      { name: 'x', args: '1', result: undefined, status: 'done' },
      { name: 'a', args: '', result: 7, status: 'done' },
    ]);
  });

  it('活動已被 token 標完成後才收到 result：沿用同名最近一次的 args（Web 的 customToolArgsMap）', () => {
    const b = applyToolResult(applyToken(applyToolCall(empty(), 'a', '{"q":1}'), '嗨'), 'a', 'r');
    expect(b.toolActivities?.[1]).toEqual({ name: 'a', args: '{"q":1}', result: 'r', status: 'done' });
  });
});

describe('settleBubble', () => {
  it('結束串流、活動全部完成、記錄耗時', () => {
    const b = applyToolCall({ ...empty(), content: '答' }, 'a', '1');
    expect(settleBubble(b, 5200, 1000)).toEqual({
      role: 'assistant',
      content: '答',
      isStreaming: false,
      toolActivities: [{ name: 'a', args: '1', result: undefined, status: 'done' }],
      thinkingMs: 4200,
    });
  });

  it('可覆寫 content（出錯時的預設文案）', () => {
    expect(settleBubble(empty(), 10, 0, { content: '抱歉' })).toMatchObject({ content: '抱歉', isStreaming: false });
  });
});

describe('applyStreamSignal', () => {
  it('依訊號類型分派；error／done 不改 bubble', () => {
    const b = empty();
    expect(applyStreamSignal(b, { type: 'token', text: 'x' }).content).toBe('x');
    expect(applyStreamSignal(b, { type: 'tool-call', name: 'a', args: '' }).toolActivities).toHaveLength(1);
    expect(applyStreamSignal(b, { type: 'tool-result', name: 'a', result: 1 }).toolActivities).toHaveLength(1);
    expect(applyStreamSignal(b, { type: 'done' })).toBe(b);
    expect(applyStreamSignal(b, { type: 'error', code: null, message: '' })).toBe(b);
  });
});

it('correlates concurrent same-name calls by callId and retains only route summaries', () => {
  let bubble: ChatBubble = { role: 'assistant', content: '' };
  bubble = applyToolCall(bubble, 'plan_route', '{"origin":"A"}', 'a');
  bubble = applyToolCall(bubble, 'plan_route', '{"origin":"B"}', 'b');
  bubble = applyToolResult(bubble, 'plan_route', { routeToken: 'secret' }, 'B summary', 'b');
  bubble = applyToolResult(bubble, 'plan_route', { routeToken: 'secret' }, 'A summary', 'a');
  expect(bubble.toolActivities).toMatchObject([{ callId: 'a', summary: 'A summary' }, { callId: 'b', summary: 'B summary' }]);
  expect(JSON.stringify(bubble)).not.toContain('secret');
});
