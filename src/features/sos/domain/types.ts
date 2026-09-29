/**
 * SOS 型別，移植自 Web `src/types/sos.ts`（commit f82cda8），並補上本 repo 需要的 type guard
 * （禁止 `as` 收窄未驗證的 API 資料）。形狀與後端 `sos-events.ts` `SosSnapshot` 一致。
 */

export type SosType = 'body' | 'trapped' | 'share_location';
export type BindStatus = 'pending' | 'bound';
export type SosStatus = 'active' | 'resolved';

export interface EmergencyContact {
  _id: string;
  name: string;
  bindStatus: BindStatus;
  lineUserId: string | null;
  bindCodeExpiresAt: string | null;
  createdAt: string;
}

export interface CreateEmergencyContactResult {
  contact: EmergencyContact;
  bindUrl: string;
  bindCode: string;
}

export interface CreateSosSessionInput {
  type: SosType;
  lat: number;
  lng: number;
  address?: string;
}

export interface CreateSosSessionResult {
  sessionId: string;
  /** 公開追蹤連結的 key（32 hex）；不是 sessionId（後端 FRONTEND_MIGRATION_SOS_LIFECYCLE.md）。 */
  shareToken: string;
  notifiedCount: number;
}

export interface SosPublicSession {
  type: SosType;
  status: SosStatus;
  lat: number;
  lng: number;
  address: string | null;
  updatedAt: string;
}

export type HandlingStatus = 'notified' | 'acknowledged' | 'claimed' | 'en_route' | 'arrived' | 'resolved';
export type SosActorType = 'victim' | 'system' | 'contact';
export type SosTimelineType = 'created' | 'notified' | 'acknowledged' | 'claimed' | 'status_update' | 'resolved';

export interface SosAcknowledgement {
  lineUserId: string;
  name: string | null;
  at: string;
}

export interface SosTimelineEntry {
  type: SosTimelineType;
  actorType: SosActorType;
  actorName: string | null;
  note: string | null;
  at: string;
}

/** `GET /sessions/:id` 與每個 SSE `update` 事件的完整快照（只有發起者看得到）。 */
export interface SosSnapshot {
  sessionId: string;
  status: SosStatus;
  handlingStatus: HandlingStatus;
  claimedBy: string | null;
  claimedByName: string | null;
  claimedAt: string | null;
  acknowledgements: SosAcknowledgement[];
  timeline: SosTimelineEntry[];
  location: { lat: number; lng: number; address: string | null; updatedAt: string } | null;
  resolvedAt: string | null;
  updatedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const strOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const HANDLING: readonly HandlingStatus[] = ['notified', 'acknowledged', 'claimed', 'en_route', 'arrived', 'resolved'];
const TIMELINE: readonly SosTimelineType[] = ['created', 'notified', 'acknowledged', 'claimed', 'status_update', 'resolved'];
const ACTORS: readonly SosActorType[] = ['victim', 'system', 'contact'];
const SOS_TYPES: readonly SosType[] = ['body', 'trapped', 'share_location'];

function isStatus(v: unknown): v is SosStatus {
  return v === 'active' || v === 'resolved';
}

function isTimelineEntry(v: unknown): v is SosTimelineEntry {
  return (
    isRecord(v) &&
    TIMELINE.some((t) => t === v.type) &&
    ACTORS.some((a) => a === v.actorType) &&
    strOrNull(v.actorName) &&
    strOrNull(v.note) &&
    typeof v.at === 'string'
  );
}

function isAck(v: unknown): v is SosAcknowledgement {
  return isRecord(v) && typeof v.lineUserId === 'string' && strOrNull(v.name) && typeof v.at === 'string';
}

function isSnapshotLocation(v: unknown): v is NonNullable<SosSnapshot['location']> {
  return isRecord(v) && isNum(v.lat) && isNum(v.lng) && strOrNull(v.address) && typeof v.updatedAt === 'string';
}

export function isSosSnapshot(v: unknown): v is SosSnapshot {
  return (
    isRecord(v) &&
    typeof v.sessionId === 'string' &&
    isStatus(v.status) &&
    HANDLING.some((h) => h === v.handlingStatus) &&
    strOrNull(v.claimedBy) &&
    strOrNull(v.claimedByName) &&
    strOrNull(v.claimedAt) &&
    Array.isArray(v.acknowledgements) &&
    v.acknowledgements.every(isAck) &&
    Array.isArray(v.timeline) &&
    v.timeline.every(isTimelineEntry) &&
    (v.location === null || isSnapshotLocation(v.location)) &&
    strOrNull(v.resolvedAt) &&
    typeof v.updatedAt === 'string'
  );
}

export function isCreateSosSessionResult(v: unknown): v is CreateSosSessionResult {
  return isRecord(v) && typeof v.sessionId === 'string' && typeof v.shareToken === 'string' && isNum(v.notifiedCount);
}

export function isSosPublicSession(v: unknown): v is SosPublicSession {
  return (
    isRecord(v) &&
    SOS_TYPES.some((t) => t === v.type) &&
    isStatus(v.status) &&
    isNum(v.lat) &&
    isNum(v.lng) &&
    strOrNull(v.address) &&
    typeof v.updatedAt === 'string'
  );
}

export function isEmergencyContact(v: unknown): v is EmergencyContact {
  return (
    isRecord(v) &&
    typeof v._id === 'string' &&
    typeof v.name === 'string' &&
    (v.bindStatus === 'pending' || v.bindStatus === 'bound') &&
    (v.lineUserId === undefined || strOrNull(v.lineUserId)) &&
    (v.bindCodeExpiresAt === undefined || strOrNull(v.bindCodeExpiresAt)) &&
    (v.createdAt === undefined || typeof v.createdAt === 'string')
  );
}

/** 建立聯絡人的回應不一定帶 `lineUserId`／`createdAt`，補成完整形狀。 */
export function normalizeContact(v: EmergencyContact): EmergencyContact {
  return {
    _id: v._id,
    name: v.name,
    bindStatus: v.bindStatus,
    lineUserId: v.lineUserId ?? null,
    bindCodeExpiresAt: v.bindCodeExpiresAt ?? null,
    createdAt: v.createdAt ?? new Date(0).toISOString(),
  };
}

export function isCreateContactResult(v: unknown): v is CreateEmergencyContactResult {
  return isRecord(v) && isEmergencyContact(v.contact) && typeof v.bindUrl === 'string' && typeof v.bindCode === 'string';
}

export const MAX_EMERGENCY_CONTACTS = 5;
