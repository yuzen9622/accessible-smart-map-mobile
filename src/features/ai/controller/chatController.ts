import { AccessibilityInfo } from 'react-native';

import { useUserLocationStore } from '@/features/map';
import { logger } from '@/shared/logger';

import { streamChat } from '../api/aiApi';
import { applyStreamSignal, settleBubble, type ChatStreamSignal } from '../domain/chatStream';
import { toChatHistory, toPriorTurns } from '../domain/conversationHistory';
import { mapToolToActions } from '../domain/toolActionMapper';
import type { PriorTurn, Translate, VoiceTurn } from '../domain/types';
import { useChatStore, type ChatEntry } from '../store/chatStore';
import { computeRouteAction, executeAction, openRoutePanel } from './actionExecutor';

/**
 * 聊天路徑的 controller（對應 Web `src/hook/useAIChat.ts` 的 handleSend／stopStreaming／clearAll）。
 *
 * 放在模組層而不是畫面 hook：工具結果會關掉聊天 modal（切到路線面板），串流必須繼續在背景跑完，
 * 使用者再打開聊天時看得到完整回答。
 *
 * 與 Web 的差異：
 * - `compute-route` **await** 結果（SDD §6.6 雙路徑不變量）：成功才關聊天、切路線面板；失敗在該則回覆下附提示。
 *   Web 同時收到的 `switch-panel` 會不等算路結果就關聊天，這裡在有 `compute-route` 時不執行它。
 * - 後端的 `error` 事件會顯示成錯誤訊息（Web 不解析，變成空白回覆）；429 另有「稍後再試」文案。
 * - 不送 system prompt（後端會丟掉，見 `api/aiApi.ts`）。
 */

let inflight: AbortController | null = null;
let nextId = 0;

function newId(): string {
  nextId += 1;
  return `m${Date.now().toString(36)}${nextId}`;
}

function updateEntry(id: string, update: (entry: ChatEntry) => ChatEntry): void {
  useChatStore.setState((state) => ({
    entries: state.entries.map((entry) => (entry.id === id ? update(entry) : entry)),
  }));
}

function findEntry(id: string): ChatEntry | undefined {
  return useChatStore.getState().entries.find((entry) => entry.id === id);
}


async function runComputeRoute(
  entryId: string,
  action: { origin: { lat: number; lng: number }; destination: { lat: number; lng: number } },
  signal: AbortSignal,
  t: Translate,
) {
  try {
    const result = await computeRouteAction(action.origin, action.destination);
    // 使用者已停止／清除對話（含登出）：路線照樣留在 session，但不再關聊天、跳頁或附提示
    if (signal.aborted) return;
    if (result.ok) {
      openRoutePanel();
      return;
    }
    // superseded＝使用者之後又自己規劃了別條路，不是失敗
    if (result.failure === 'superseded') return;
    const notice = t(result.failure === 'too-far' ? 'nativeAiRouteTooFar' : 'nativeAiRouteFailed');
    updateEntry(entryId, (entry) => ({ ...entry, notice }));
    AccessibilityInfo.announceForAccessibility(notice);
  } catch (error) {
    logger.warn('[ai] compute-route failed', error);
    updateEntry(entryId, (entry) => ({ ...entry, notice: t('nativeAiRouteFailed') }));
  }
}

function runToolActions(entryId: string, name: string, result: unknown, signal: AbortSignal, t: Translate): void {
  const entry = findEntry(entryId);
  const args = [...(entry?.toolActivities ?? [])].reverse().find((activity) => activity.name === name)?.args;
  const actions = mapToolToActions(name, result, args, t);
  const computing = actions.some((action) => action.type === 'compute-route');
  for (const action of actions) {
    if (action.type === 'compute-route') {
      void runComputeRoute(entryId, action, signal, t);
    } else if (!(computing && action.type === 'switch-panel')) {
      executeAction(action);
    }
  }
}

type ErrorSignal = Extract<ChatStreamSignal, { type: 'error' }>;

function errorText(signal: ErrorSignal | null, t: Translate): string {
  return signal?.code === 429 ? t('nativeAiErrorRateLimit') : t('nativeAiError');
}

export async function sendChatMessage(rawText: string, t: Translate): Promise<void> {
  const text = rawText.trim();
  const { entries, isLoading } = useChatStore.getState();
  if (!text || isLoading) return;

  executeAction({ type: 'clear-markers' });
  const userEntry: ChatEntry = { id: newId(), role: 'user', content: text };
  const assistant: ChatEntry = { id: newId(), role: 'assistant', content: '', isStreaming: true, toolActivities: [] };
  // 純文字的 user／assistant，assistant 附工具摘要（工具由後端執行，原始結果不回傳）
  const messages = toChatHistory([...entries, userEntry]);
  useChatStore.setState({ entries: [...entries, userEntry, assistant], isLoading: true });

  const controller = new AbortController();
  inflight = controller;
  const startedAt = Date.now();
  const position = useUserLocationStore.getState().position;
  // 放在物件裡：在 callback 內賦值的 `let` 會被 TS 窄化成初始的 null
  const outcome: { error: ErrorSignal | null; failed: boolean } = { error: null, failed: false };

  try {
    await streamChat(
      {
        messages,
        temperature: 0.7,
        ...(position ? { userLocation: { latitude: position.lat, longitude: position.lng } } : {}),
      },
      (signal) => {
        if (controller.signal.aborted) return;
        if (signal.type === 'error') {
          outcome.error = signal;
          logger.warn('[ai] backend stream error', signal.code, signal.message);
          return;
        }
        if (signal.type === 'done') return;
        updateEntry(assistant.id, (entry) => ({ ...entry, ...applyStreamSignal(entry, signal) }));
        if (signal.type !== 'tool-result') return;
        // 地圖／面板動作失敗不能中斷串流：回答文字還在路上
        try {
          runToolActions(assistant.id, signal.name, signal.result, controller.signal, t);
        } catch (error) {
          logger.warn('[ai] tool action failed', signal.name, error);
        }
      },
      controller.signal,
    );
  } catch (error) {
    // 取消：保留已收到的部分（對齊 Web：AbortError 仍走 finally 收尾）
    if (!controller.signal.aborted) {
      outcome.failed = true;
      logger.warn('[ai] chat stream failed', error);
    }
  } finally {
    if (inflight === controller) inflight = null;
    const current = findEntry(assistant.id);
    if (current) {
      const empty = current.content.trim().length === 0;
      const broken = (outcome.failed || outcome.error !== null) && !controller.signal.aborted;
      const showError = broken && empty;
      updateEntry(assistant.id, (entry) => ({
        ...entry,
        ...settleBubble(entry, Date.now(), startedAt, showError ? { content: errorText(outcome.error, t) } : undefined),
        isError: showError,
        // 已經有部分回答時不蓋掉文字，改在下方提示可能不完整
        ...(broken && !empty ? { notice: t('nativeAiIncomplete') } : {}),
      }));
    }
    // 清除對話會換掉整個列表；只有這次請求仍是目前的才解除載入狀態
    if (inflight === null) useChatStore.setState({ isLoading: false });
  }
}

/**
 * 語音對話結束：把這段逐字稿接到文字對話後面，之後打字時 AI 接得上剛才講的內容（文字請求會帶整段歷史）。
 * 工具摘要掛在助理那一輪的 `toolActivities`，列表上顯示成已完成的查詢。
 */
export function appendVoiceTurns(turns: VoiceTurn[]): void {
  const added = turns
    .filter((turn) => turn.content.trim().length > 0 || turn.tools.length > 0)
    .map(
      (turn): ChatEntry => ({
        id: newId(),
        role: turn.role,
        content: turn.content,
        source: 'voice',
        ...(turn.tools.length > 0
          ? {
              toolActivities: turn.tools.map((tool) => ({
                name: tool.name,
                args: tool.args,
                result: tool.result,
                summary: tool.summary,
                status: 'done' as const,
              })),
            }
          : {}),
      }),
    );
  if (added.length === 0) return;
  useChatStore.setState((state) => ({ entries: [...state.entries, ...added] }));
}

/** 開語音前的對話脈絡（`session.start.history`）：使用者剛才打字聊過的內容。 */
export function getVoiceHistory(): PriorTurn[] {
  return toPriorTurns(useChatStore.getState().entries);
}

/** 停止產生：保留已顯示的部分（Web `stopStreaming`）。 */
export function stopChatStreaming(): void {
  inflight?.abort();
}

/** 清除對話（Web `clearAll`）：中止進行中的請求並清掉地圖上的 AI 結果。登出時也要呼叫。 */
export function clearChat(): void {
  inflight?.abort();
  inflight = null;
  useChatStore.setState({ entries: [], isLoading: false });
  executeAction({ type: 'clear-markers' });
}
