import { describe, expect, it } from 'vitest';
import {
  REVIEW_SESSION_STORAGE_KEY,
  beginReviewSession,
  finishReviewSession,
  formatReviewDuration,
  loadReviewSessions,
  reviewSessionsToAuditEvents,
  saveReviewSessions,
} from './review-sessions';

function memoryStorage() {
  const data: Record<string, string> = {};
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
  };
}

const participants = [
  { address: 'GCLIENT', role: 'client' as const },
  { address: 'GFREELANCER', role: 'freelancer' as const },
];

describe('review session audit trail (#304)', () => {
  it('records participants, duration and screen-share usage', () => {
    const storage = memoryStorage();
    const startedAt = new Date('2026-11-25T10:00:00.000Z');

    const session = beginReviewSession(
      { projectId: 'project-1', roomId: 'project-1-review', participants, startedAt },
      storage
    );

    expect(session.endedAt).toBeUndefined();
    expect(loadReviewSessions('project-1', storage)).toHaveLength(1);
    expect(loadReviewSessions('other-project', storage)).toHaveLength(0);

    const finished = finishReviewSession(
      session.id,
      {
        endedAt: new Date('2026-11-25T10:12:30.000Z'),
        hadScreenShare: true,
      },
      storage
    );

    expect(finished).toMatchObject({
      durationMs: 12 * 60_000 + 30_000,
      hadScreenShare: true,
      endedAt: '2026-11-25T10:12:30.000Z',
    });
    expect(loadReviewSessions('project-1', storage)[0].durationMs).toBe(750_000);
  });

  it('returns null when finishing an unknown session', () => {
    expect(finishReviewSession('missing', {}, memoryStorage())).toBeNull();
  });

  it('maps sessions to start and end audit events', () => {
    const storage = memoryStorage();
    const startedAt = new Date('2026-11-25T10:00:00.000Z');
    const session = beginReviewSession(
      { projectId: 'project-1', roomId: 'room', participants, startedAt },
      storage
    );
    finishReviewSession(
      session.id,
      { endedAt: new Date('2026-11-25T10:05:00.000Z'), hadScreenShare: true },
      storage
    );

    const events = reviewSessionsToAuditEvents(loadReviewSessions('project-1', storage));
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: 'session',
      action: 'Live Review Session Started',
      signer: 'GCLIENT',
      timestamp: '2026-11-25T10:00:00.000Z',
    });
    expect(events[0].description).toContain('client GCLIENT');
    expect(events[0].description).toContain('freelancer GFREELANCER');
    expect(events[1]).toMatchObject({
      type: 'session',
      action: 'Live Review Session Ended',
      timestamp: '2026-11-25T10:05:00.000Z',
    });
    expect(events[1].description).toContain('5m 00s');
    expect(events[1].description).toContain('Screen sharing was used.');
  });

  it('ignores corrupt storage and invalid records', () => {
    const storage = memoryStorage();
    storage.setItem(REVIEW_SESSION_STORAGE_KEY, '{not json');
    expect(loadReviewSessions(undefined, storage)).toEqual([]);

    storage.setItem(
      REVIEW_SESSION_STORAGE_KEY,
      JSON.stringify([{ id: 1 }, { ...beginReviewSession(
        { projectId: 'p', roomId: 'r', participants, startedAt: new Date('2026-11-25T10:00:00Z') },
        storage
      ) }])
    );
    // The second entry is valid and was persisted by beginReviewSession itself.
    expect(loadReviewSessions(undefined, storage)).toHaveLength(1);
  });

  it('caps the stored session list', () => {
    const storage = memoryStorage();
    const sessions = Array.from({ length: 120 }, (_, index) => ({
      id: `session-${index}`,
      projectId: 'project-1',
      roomId: 'room',
      startedAt: new Date(2026, 0, 1, 0, index).toISOString(),
      participants,
      hadScreenShare: false,
    }));
    saveReviewSessions(sessions, storage);
    const stored = loadReviewSessions(undefined, storage);
    expect(stored).toHaveLength(100);
    expect(stored[0].id).toBe('session-20');
    expect(stored[99].id).toBe('session-119');
  });

  it('formats duration for the summary', () => {
    expect(formatReviewDuration(undefined)).toBe('—');
    expect(formatReviewDuration(12_000)).toBe('0m 12s');
    expect(formatReviewDuration(3_750_000)).toBe('1h 02m');
  });
});
