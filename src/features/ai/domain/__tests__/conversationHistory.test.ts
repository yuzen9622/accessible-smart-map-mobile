import { interpretChatSseEvent, applyToolResult } from '../chatStream';
import { CHAT_HISTORY_LIMIT, VOICE_HISTORY_LIMIT, toChatHistory, toPriorTurns, type HistoryBubble } from '../conversationHistory';

const user = (content: string): HistoryBubble => ({ role: 'user', content });
const assistant = (content: string, summaries: string[] = []): HistoryBubble => ({
  role: 'assistant',
  content,
  toolActivities: summaries.map((summary, i) => ({ name: `tool${i}`, summary, status: 'done' })),
});

describe('toChatHistory', () => {
  it('assistant 帶這一輪的工具摘要，沒有摘要就不帶欄位', () => {
    expect(toChatHistory([user('附近廁所'), assistant('臺北車站 B1', ['{"n":1}']), user('帶我去'), assistant('好')])).toEqual([
      { role: 'user', content: '附近廁所' },
      { role: 'assistant', content: '臺北車站 B1', tool_summaries: [{ name: 'tool0', summary: '{"n":1}' }] },
      { role: 'user', content: '帶我去' },
      { role: 'assistant', content: '好' },
    ]);
  });

  it('丟掉錯誤訊息與空白回覆，但保留只有工具摘要的助理輪', () => {
    const history = toChatHistory([
      user('a'),
      { role: 'assistant', content: '連線失敗', isError: true },
      assistant('   '),
      assistant('', ['s']),
    ]);
    expect(history).toEqual([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: '', tool_summaries: [{ name: 'tool0', summary: 's' }] },
    ]);
  });

  it('只帶最後一段，而且從 user 開頭', () => {
    const bubbles: HistoryBubble[] = [];
    for (let i = 0; i < CHAT_HISTORY_LIMIT; i += 1) bubbles.push(user(`q${i}`), assistant(`a${i}`));
    const history = toChatHistory(bubbles);
    expect(history.length).toBeLessThanOrEqual(CHAT_HISTORY_LIMIT);
    expect(history[0]?.role).toBe('user');
    expect(history[history.length - 1]?.content).toBe(`a${CHAT_HISTORY_LIMIT - 1}`);
  });
});

describe('toPriorTurns', () => {
  it('轉成語音 history 形狀並限制輪數', () => {
    const bubbles: HistoryBubble[] = [];
    for (let i = 0; i < VOICE_HISTORY_LIMIT + 4; i += 1) bubbles.push(user(`q${i}`));
    bubbles.push(assistant('結果', ['摘要']));
    const turns = toPriorTurns(bubbles);
    expect(turns).toHaveLength(VOICE_HISTORY_LIMIT);
    expect(turns[turns.length - 1]).toEqual({ role: 'assistant', text: '結果', tools: [{ name: 'tool0', summary: '摘要' }] });
  });
});

describe('tool_result summary', () => {
  it('SSE 的 summary 會被解析並存到工具活動上', () => {
    const signal = interpretChatSseEvent({ event: 'tool_result', data: JSON.stringify({ name: 'findA11yPlaces', result: { a: 1 }, summary: '{"a":1}' }) });
    expect(signal).toEqual({ type: 'tool-result', name: 'findA11yPlaces', result: { a: 1 }, summary: '{"a":1}' });
    const bubble = applyToolResult({ role: 'assistant', content: '' }, 'findA11yPlaces', { a: 1 }, '{"a":1}');
    expect(bubble.toolActivities?.[0]?.summary).toBe('{"a":1}');
  });

  it('沒有 summary 時不加欄位（舊後端相容）', () => {
    const signal = interpretChatSseEvent({ event: 'tool_result', data: JSON.stringify({ name: 'x', result: 1 }) });
    expect(signal).toEqual({ type: 'tool-result', name: 'x', result: 1 });
  });
});
