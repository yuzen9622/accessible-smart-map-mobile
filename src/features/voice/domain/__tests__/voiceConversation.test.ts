import { buildVoiceTurns, toolMarkOf, voiceTurnsToPriorTurns } from '../voiceConversation';

describe('toolMarkOf', () => {
  it('只記成功且有摘要的結果', () => {
    expect(toolMarkOf({ type: 'call', name: 'a' }, 0)).toBeNull();
    expect(toolMarkOf({ type: 'result', name: 'a', ok: false, summary: 's' }, 0)).toBeNull();
    expect(toolMarkOf({ type: 'result', name: 'a', ok: true, summary: '  ' }, 0)).toBeNull();
    expect(toolMarkOf({ type: 'result', name: 'a', ok: true, summary: 's', result: { r: 1 } }, 2)).toEqual({
      at: 2,
      name: 'a',
      summary: 's',
      args: undefined,
      result: { r: 1 },
    });
  });
});

describe('buildVoiceTurns', () => {
  it('連續同一方的句子併成一輪，工具掛到之後第一則助理回答', () => {
    const turns = buildVoiceTurns(
      [
        { role: 'user', text: '附近有' },
        { role: 'user', text: '無障礙廁所嗎' },
        { role: 'model', text: '最近的是臺北車站 B1。' },
        { role: 'model', text: '要帶你去嗎？' },
      ],
      [{ at: 2, name: 'findA11yPlaces', summary: 's', result: { r: 1 } }],
    );
    expect(turns).toEqual([
      { role: 'user', content: '附近有 無障礙廁所嗎', tools: [] },
      {
        role: 'assistant',
        content: '最近的是臺北車站 B1。 要帶你去嗎？',
        tools: [{ name: 'findA11yPlaces', summary: 's', args: undefined, result: { r: 1 } }],
      },
    ]);
  });

  it('查完沒有回答就結束：工具自成一則助理輪', () => {
    const turns = buildVoiceTurns([{ role: 'user', text: '查公車' }], [{ at: 1, name: 'getBusArrival', summary: 's' }]);
    expect(turns).toEqual([
      { role: 'user', content: '查公車', tools: [] },
      { role: 'assistant', content: '', tools: [{ name: 'getBusArrival', summary: 's', args: undefined, result: undefined }] },
    ]);
  });

  it('助理先說「我查一下」、查完沒再開口，使用者接著問：工具掛回前一個助理輪，不掛到下一題的回答', () => {
    const turns = buildVoiceTurns(
      [
        { role: 'user', text: '查 307' },
        { role: 'model', text: '我查一下' },
        { role: 'user', text: '那 262 呢' },
        { role: 'model', text: '262 還要 5 分鐘' },
      ],
      [{ at: 2, name: 'getBusArrival', summary: '307' }],
    );
    expect(turns[1]).toEqual({
      role: 'assistant',
      content: '我查一下',
      tools: [{ name: 'getBusArrival', summary: '307', args: undefined, result: undefined }],
    });
    expect(turns[3]?.tools).toEqual([]);
  });

  it('空白句子略過', () => {
    expect(buildVoiceTurns([{ role: 'model', text: '  ' }], [])).toEqual([]);
  });
});

it('沒有摘要但有結果（舊後端）也記下，給聊天顯示結果卡', () => {
  expect(toolMarkOf({ type: 'result', name: 'a', ok: true, result: { r: 1 } }, 0)?.summary).toBe('');
});

describe('voiceTurnsToPriorTurns', () => {
  it('文字裁到後端上限、空摘要不送', () => {
    const [turn] = voiceTurnsToPriorTurns([{ role: 'assistant', content: 'x'.repeat(5000), tools: [{ name: 'a', summary: '' }] }]);
    expect(turn?.text).toHaveLength(4000);
    expect(turn).not.toHaveProperty('tools');
  });

  it('只帶摘要，不帶原始結果', () => {
    expect(
      voiceTurnsToPriorTurns([{ role: 'assistant', content: '好', tools: [{ name: 'a', summary: 's', result: { big: true } }] }]),
    ).toEqual([{ role: 'assistant', text: '好', tools: [{ name: 'a', summary: 's' }] }]);
  });
});
