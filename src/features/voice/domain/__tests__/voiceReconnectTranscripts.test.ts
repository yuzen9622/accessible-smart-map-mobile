// 新寫（Web 沒有）：協定 §3.5「斷線時整個清空 utteranceId 對照表」——重連後 `u1` 重新編號不得誤併進舊氣泡。
import { appendFragment, applyCorrection, detachUtteranceIds, emptyAggState } from '../transcriptAggregator';
import { t } from '../testing/translate';
import { createVoiceBindings, type BindingSinks } from '../voiceSessionBindings';
import type { AggEntry } from '../transcriptAggregator';

describe('detachUtteranceIds', () => {
  it('seals every entry and drops utteranceId, keeping text and ids', () => {
    let s = appendFragment(emptyAggState(), { role: 'user', text: '你好', final: true, utteranceId: 'u1' });
    s = appendFragment(s, { role: 'model', text: '哈囉' });
    const next = detachUtteranceIds(s);
    expect(next.entries.map((e) => [e.id, e.text, e.sealed, e.utteranceId])).toEqual([
      [0, '你好', true, undefined],
      [1, '哈囉', true, undefined],
    ]);
  });

  it('a new-session u1 starts a new bubble and a stale correction is ignored', () => {
    let s = appendFragment(emptyAggState(), { role: 'user', text: '舊的一句', final: true, utteranceId: 'u1' });
    s = detachUtteranceIds(s);
    s = appendFragment(s, { role: 'user', text: '新的一句', utteranceId: 'u1' });
    expect(s.entries.map((e) => e.text)).toEqual(['舊的一句', '新的一句']);
    const corrected = applyCorrection(s, { text: '改', utteranceId: 'u1' });
    expect(corrected.entries.map((e) => e.text)).toEqual(['舊的一句', '改']);
  });
});

describe('bindings on reconnect', () => {
  it('entering reconnecting detaches utteranceIds; interrupted alone does not', () => {
    const published: AggEntry[][] = [];
    const sinks: BindingSinks = {
      publishTranscripts: (entries) => published.push(entries),
      publishStatus: () => {},
      publishTool: () => {},
      setMicLevel: () => {},
      executeAction: () => {},
      computeRoute: () => Promise.resolve(),
      t,
    };
    const bindings = createVoiceBindings(sinks);
    bindings.onStatusChange({ status: 'listening' });
    bindings.onTranscript({ role: 'user', text: '被打斷的一句', final: true, utteranceId: 'u1' });
    bindings.onInterrupted();
    bindings.onTranscriptCorrection({ text: '校正後', utteranceId: 'u1' });
    expect(published.at(-1)?.[0]?.text).toBe('校正後');

    bindings.onStatusChange({ status: 'reconnecting' });
    bindings.onStatusChange({ status: 'connecting' });
    bindings.onStatusChange({ status: 'listening' });
    bindings.onTranscript({ role: 'user', text: '重連後', final: true, utteranceId: 'u1' });
    expect(published.at(-1)?.map((e) => e.text)).toEqual(['校正後', '重連後']);
  });
});
