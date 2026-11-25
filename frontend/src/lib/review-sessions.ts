/**
 * Persistent audit trail for milestone review calls (#304).
 *
 * Sessions live in localStorage because review calls are peer-to-peer and do
 * not touch the escrow backend. The project audit log merges these records with
 * on-chain events so a call is always traceable to participants and duration.
 */

import type { ReviewCallRole } from '@/lib/webrtc-signaling';

export const REVIEW_SESSION_STORAGE_KEY = 'trustpay.reviewSessions.v1';
const MAX_STORED_SESSIONS = 100;

export interface ReviewSessionParticipant {
  address: string;
  role: ReviewCallRole;
}

export interface ReviewSessionRecord {
  id: string;
  projectId: string;
  roomId: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  participants: ReviewSessionParticipant[];
  hadScreenShare: boolean;
}

export interface ReviewSessionAuditEvent {
  id: string;
  type: 'session';
  action: string;
  description: string;
  timestamp: string;
  signer?: string;
  verified?: boolean;
}

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem'>;

function safeStorage<T extends ReadStorage | WriteStorage>(): T | undefined {
  try {
    return typeof window !== 'undefined' ? (window.localStorage as unknown as T) : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isParticipant(value: unknown): value is ReviewSessionParticipant {
  return (
    isRecord(value) &&
    typeof value.address === 'string' &&
    value.address.length > 0 &&
    (value.role === 'client' || value.role === 'freelancer')
  );
}

function isReviewSession(value: unknown): value is ReviewSessionRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.projectId === 'string' &&
    typeof value.roomId === 'string' &&
    typeof value.startedAt === 'string' &&
    Array.isArray(value.participants) &&
    value.participants.every(isParticipant) &&
    typeof value.hadScreenShare === 'boolean'
  );
}

export function loadReviewSessions(
  projectId?: string,
  storage: ReadStorage | undefined = safeStorage<ReadStorage>()
): ReviewSessionRecord[] {
  try {
    const raw = storage?.getItem(REVIEW_SESSION_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const sessions = parsed.filter(isReviewSession);
    return projectId ? sessions.filter((session) => session.projectId === projectId) : sessions;
  } catch {
    return [];
  }
}

export function saveReviewSessions(
  sessions: ReviewSessionRecord[],
  storage: WriteStorage | undefined = safeStorage<WriteStorage>()
): void {
  try {
    storage?.setItem(
      REVIEW_SESSION_STORAGE_KEY,
      JSON.stringify(sessions.slice(-MAX_STORED_SESSIONS))
    );
  } catch {
    /* storage unavailable: the audit event still shows for this session */
  }
}

function makeSessionId(now: number): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `review-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Records the moment both participants joined the encrypted call. */
export function beginReviewSession(
  input: {
    projectId: string;
    roomId: string;
    participants: ReviewSessionParticipant[];
    startedAt?: Date;
  },
  storage: (ReadStorage & WriteStorage) | undefined = safeStorage<ReadStorage & WriteStorage>()
): ReviewSessionRecord {
  const startedAt = input.startedAt ?? new Date();
  const session: ReviewSessionRecord = {
    id: makeSessionId(startedAt.getTime()),
    projectId: input.projectId,
    roomId: input.roomId,
    startedAt: startedAt.toISOString(),
    participants: input.participants,
    hadScreenShare: false,
  };
  const sessions = loadReviewSessions(undefined, storage);
  saveReviewSessions([...sessions, session], storage);
  return session;
}

/** Stamps duration and screen-share usage when the call ends. */
export function finishReviewSession(
  id: string,
  updates: { endedAt?: Date; hadScreenShare?: boolean; durationMs?: number } = {},
  storage: (ReadStorage & WriteStorage) | undefined = safeStorage<ReadStorage & WriteStorage>()
): ReviewSessionRecord | null {
  const endedAt = updates.endedAt ?? new Date();
  const sessions = loadReviewSessions(undefined, storage);
  const index = sessions.findIndex((session) => session.id === id);
  if (index === -1) return null;

  const session = sessions[index];
  const startedMs = Date.parse(session.startedAt);
  const durationMs =
    updates.durationMs ??
    (Number.isNaN(startedMs) ? 0 : Math.max(0, endedAt.getTime() - startedMs));

  const finished: ReviewSessionRecord = {
    ...session,
    endedAt: endedAt.toISOString(),
    durationMs,
    hadScreenShare: updates.hadScreenShare ?? session.hadScreenShare,
  };
  sessions[index] = finished;
  saveReviewSessions(sessions, storage);
  return finished;
}

export function formatReviewDuration(ms: number | undefined): string {
  if (ms === undefined || Number.isNaN(ms) || ms < 0) return '—';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${(minutes % 60).toString().padStart(2, '0')}m`;
}

function participantLabel(participants: ReviewSessionParticipant[]): string {
  if (participants.length === 0) return 'no recorded participants';
  return participants.map((participant) => `${participant.role} ${participant.address}`).join(' and ');
}

/** Maps stored sessions to audit-log rows. */
export function reviewSessionsToAuditEvents(sessions: ReviewSessionRecord[]): ReviewSessionAuditEvent[] {
  const events: ReviewSessionAuditEvent[] = [];

  for (const session of sessions) {
    events.push({
      id: `${session.id}-started`,
      type: 'session',
      action: 'Live Review Session Started',
      description: `Encrypted peer-to-peer review call opened between ${participantLabel(session.participants)}.`,
      timestamp: session.startedAt,
      signer: session.participants[0]?.address,
      verified: false,
    });

    if (session.endedAt) {
      const screenShare = session.hadScreenShare ? ' Screen sharing was used.' : '';
      events.push({
        id: `${session.id}-ended`,
        type: 'session',
        action: 'Live Review Session Ended',
        description: `Call duration ${formatReviewDuration(session.durationMs)}.${screenShare}`,
        timestamp: session.endedAt,
        signer: session.participants[0]?.address,
        verified: false,
      });
    }
  }

  return events.sort((a, b) => (Date.parse(a.timestamp) || 0) - (Date.parse(b.timestamp) || 0));
}
