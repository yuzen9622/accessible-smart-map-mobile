// 語音 ⇄ 文字共用同一份對話：語音結束時把逐字稿與工具結果整理成 `VoiceTurn` 併回聊天（ai `appendVoiceTurns`），
// 語音（重新）連線時把聊天紀錄＋這段語音已講的內容當 `session.start.history` 送給後端。
import { TURN_TEXT_LIMIT, clampToolSummary, type PriorTurn, type ToolSummary, type VoiceTurn } from '@/features/ai/domain';

import type { VoiceToolEvent } from './voiceSession';

/** 一筆語音工具結果，`at` 是當下逐字稿的筆數：工具歸到那之後第一則助理回答。 */
export interface VoiceToolMark {
  at: number;
  name: string;
  summary: string;
  args?: unknown;
  result?: unknown;
}

interface TranscriptLike {
  role: 'user' | 'model';
  text: string;
}

/**
 * 只記成功的結果。沒有摘要（舊後端）也照記：`result` 讓聊天列表顯示結果卡；
 * 只是不會進對話歷史（空摘要在 `voiceTurnsToPriorTurns`／`toChatHistory` 會被濾掉）。
 */
export function toolMarkOf(event: VoiceToolEvent, transcriptCount: number): VoiceToolMark | null {
  if (event.type !== 'result' || event.ok === false) return null;
  const summary = typeof event.summary === 'string' ? event.summary.trim() : '';
  if (!summary && event.result === undefined) return null;
  return { at: transcriptCount, name: event.name, summary, args: event.args, result: event.result };
}

/**
 * 逐字稿 → 對話輪：連續同一方的句子併成一輪（語音是逐句送的），工具掛到它之後的第一則助理回答。
 * 在下一句使用者發言之前都沒有助理回答（例如助理先說「我查一下」、查完沒再開口）就掛回前一個助理輪，
 * 沒有前一個助理輪才自成一則只有工具的助理輪——不會跨過使用者的下一個問題，掛到別的回答上。
 */
export function buildVoiceTurns(transcripts: TranscriptLike[], tools: VoiceToolMark[]): VoiceTurn[] {
  const turns: VoiceTurn[] = [];
  const pending = [...tools].sort((a, b) => a.at - b.at);
  const takeTools = (index: number) => {
    const ready: VoiceToolMark[] = [];
    while (pending.length > 0 && (pending[0]?.at ?? Number.POSITIVE_INFINITY) <= index) {
      const mark = pending.shift();
      if (mark) ready.push(mark);
    }
    return ready.map(({ name, summary, args, result }) => ({ name, summary, args, result }));
  };

  const flushToPreviousAssistant = (index: number) => {
    const ready = takeTools(index);
    if (ready.length === 0) return;
    const last = turns[turns.length - 1];
    if (last && last.role === 'assistant') last.tools.push(...ready);
    else turns.push({ role: 'assistant', content: '', tools: ready });
  };

  transcripts.forEach((entry, index) => {
    const text = entry.text.trim();
    const role = entry.role === 'user' ? 'user' : 'assistant';
    if (role === 'user' && text) flushToPreviousAssistant(index);
    const tools = role === 'assistant' ? takeTools(index) : [];
    if (!text && tools.length === 0) return;
    const last = turns[turns.length - 1];
    if (last && last.role === role) {
      last.content = [last.content, text].filter(Boolean).join(' ');
      last.tools.push(...tools);
      return;
    }
    turns.push({ role, content: text, tools });
  });

  flushToPreviousAssistant(Number.POSITIVE_INFINITY);
  return turns;
}

/** `VoiceTurn` → `session.start.history` 的形狀（只帶摘要、裁到後端上限；空摘要不送）。 */
export function voiceTurnsToPriorTurns(turns: VoiceTurn[]): PriorTurn[] {
  return turns.flatMap((turn) => {
    const tools = turn.tools
      .map(({ name, summary }) => clampToolSummary(name, summary))
      .filter((tool): tool is ToolSummary => tool !== null)
      .slice(-8);
    const text = turn.content.slice(0, TURN_TEXT_LIMIT);
    if (!text.trim() && tools.length === 0) return [];
    return [{ role: turn.role, text, ...(tools.length > 0 ? { tools } : {}) }];
  });
}
