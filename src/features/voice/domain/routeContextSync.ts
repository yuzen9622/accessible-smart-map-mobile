import type { RouteContextInput } from '@/features/route/domain';

export type RouteSyncState = 'idle' | 'pending' | 'synced' | 'unsupported' | 'error';
export interface RouteContextAck {
  type: 'route.context.ack'; requestId: string; selectionVersion: number; ok: boolean;
  routeId?: string | null; navigationId?: string | null; routeVersion?: number | null; reason?: string;
}

/** One instance per socket. Only the latest matching acknowledgement releases audio. */
export class RouteContextSync {
  private version = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: { requestId: string; selectionVersion: number; clearing: boolean } | null = null;
  state: RouteSyncState = 'idle';
  constructor(private readonly send: (frame: object) => void, private readonly changed: (state: RouteSyncState) => void) {}
  set(context: RouteContextInput, supported: boolean): void {
    this.clearTimer();
    this.pending = null;
    if (!supported) { this.update('unsupported'); return; }
    const selectionVersion = ++this.version;
    const requestId = `selection-${selectionVersion}`;
    this.pending = { requestId, selectionVersion, clearing: context === null };
    this.update('pending');
    this.timer = setTimeout(() => { this.pending = null; this.update('error'); }, 10_000);
    this.send({ type: 'route.context.set', requestId, selectionVersion, routeContext: context });
  }
  ack(value: RouteContextAck): boolean {
    const pending = this.pending;
    if (!pending || value.requestId !== pending.requestId || value.selectionVersion !== pending.selectionVersion) return false;
    this.clearTimer(); this.pending = null;
    const identity = pending.clearing ? value.routeId === null && value.navigationId === null && value.routeVersion === null :
      typeof value.routeId === 'string' && value.routeId.length > 0;
    this.update(value.ok === true && identity ? 'synced' : 'error');
    return true;
  }
  fail(): void { this.clearTimer(); this.pending = null; this.update('error'); }
  dispose(): void { this.clearTimer(); this.pending = null; }
  private clearTimer(): void { if (this.timer) clearTimeout(this.timer); this.timer = undefined; }
  private update(state: RouteSyncState): void { this.state = state; this.changed(state); }
}
