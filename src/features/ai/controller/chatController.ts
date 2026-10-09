import { AccessibilityInfo } from 'react-native';

import { useUserLocationStore } from '@/features/map';
import { logger } from '@/shared/logger';

import { getRouteSessionSnapshot, subscribeRouteSession, invalidateRouteConversations } from '@/features/route';
import { getRouteConversationRequest } from './routeConversation';
import { isRouteTool } from '../domain/routePlan';
import { streamChat } from '../api/aiApi';
import { applyStreamSignal, settleBubble, type ChatStreamSignal } from '../domain/chatStream';
import { toChatHistory, toPriorTurns } from '../domain/conversationHistory';
import { mapToolToActions } from '../domain/toolActionMapper';
import type { PriorTurn, Translate, VoiceTurn } from '../domain/types';
import { useChatStore, type ChatEntry } from '../store/chatStore';
import { executeAction } from './actionExecutor';

/**
 * 聊天路徑的 controller（對應 Web `src/hook/useAIChat.ts` 的 handleSend／stopStreaming／clearAll）。
 *
 * 放在模組層而不是畫面 hook：工具結果會關掉聊天 modal（切到路線面板），串流必須繼續在背景跑完，
 * 使用者再打開聊天時看得到完整回答。
 *
 * 與 Web 的差異：
 * - AI 路線只套用已驗證的後端結果；換選或取消後中止舊回覆。
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
  let applying = false;
  // 這一輪自己認定「目前正確」的 generation：每次這一輪自己成功套用路線工具結果後都會同步更新。
  // 一輪對話常常連續發兩個路線工具呼叫（例如先查附近地點、再規劃到其中一個候選站）；比對時要拿
  // 「即時讀出來的 generation」跟這個值比，而不是跟某個工具呼叫當下捕捉到的舊值比——不然前一個
  // 工具結果套用時自己推進的 generation，會把後一個呼叫誤判成「被使用者從外面打斷」而判定過期。
  // 只有這一輪以外的變動（使用者另外選了路線、清除、手動算路）才算真的過期，那種情況下面的
  // `subscribeRouteSession` 會在 `!applying` 時直接中止整個串流；這裡的比對只是第二層防線。
  let ownGeneration = getRouteSessionSnapshot().selectionGeneration;
  const calls = new Map<string, { name: string; args: string }>();
  const applied = new Set<string>();
  const unsubscribe = subscribeRouteSession((state, previous) => {
    if (!applying && state.selectionGeneration !== previous.selectionGeneration) controller.abort();
  });
  const failRoute = () => {
    const notice = t('nativeAiRouteUnavailable');
    updateEntry(assistant.id, (entry) => ({ ...entry, notice }));
    AccessibilityInfo.announceForAccessibility(notice);
    controller.abort();
  };
  const position = useUserLocationStore.getState().position;
  // 放在物件裡：在 callback 內賦值的 `let` 會被 TS 窄化成初始的 null
  const outcome: { error: ErrorSignal | null; failed: boolean } = { error: null, failed: false };

  try {
    await streamChat(
      {
        messages,
        ...getRouteConversationRequest(),
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
        if (signal.type === 'tool-call' && signal.callId && !calls.has(signal.callId)) {
          calls.set(signal.callId, { name: signal.name, args: signal.args });
        }
        if (signal.type === 'tool-result') {
          if (signal.callId && applied.has(signal.callId)) return;
          const call = signal.callId ? calls.get(signal.callId) : undefined;
          if (isRouteTool(signal.name) && (!call || call.name !== signal.name || getRouteSessionSnapshot().selectionGeneration !== ownGeneration)) {
            failRoute(); return;
          }
          try {
            applying = true;
            for (const action of mapToolToActions(signal.name, signal.result, call?.args, t)) {
              if (!executeAction(action).ok) { failRoute(); return; }
            }
            if (signal.callId) applied.add(signal.callId);
            // 這次套用如果是路線工具，自己的 generation 會往前推一格；同步基準值，
            // 這樣同一輪後面的路線工具呼叫才不會被自己剛才的套用誤判成過期。
            ownGeneration = getRouteSessionSnapshot().selectionGeneration;
          } catch {
            failRoute(); return;
          } finally { applying = false; }
        }
        updateEntry(assistant.id, (entry) => ({ ...entry, ...applyStreamSignal(entry, signal) }));
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
    unsubscribe();
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
                args: isRouteTool(tool.name) ? undefined : tool.args,
                result: isRouteTool(tool.name) ? undefined : tool.result,
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
  invalidateRouteConversations();
}

/** 清除對話（Web `clearAll`）：中止進行中的請求並清掉地圖上的 AI 結果。登出時也要呼叫。 */
export function clearChat(): void {
  inflight?.abort();
  invalidateRouteConversations();
  inflight = null;
  useChatStore.setState({ entries: [], isLoading: false });
  executeAction({ type: 'clear-markers' });
}
