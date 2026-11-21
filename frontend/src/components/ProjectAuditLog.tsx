'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Project } from '@/types';
import { fetchProjectAuditEvents, ProjectAuditEventRecord } from '@/lib/api';
import { getStellarExplorerUrl } from '@/lib/soroban';
import { CryptoId } from '@/components/ui/CryptoId';

export type AuditEventType = 'project' | 'milestone' | 'proposal' | 'dispute';
export type AuditFilter = 'all' | AuditEventType;

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  action: string;
  description?: string;
  timestamp: string;
  signer?: string;
  txHash?: string;
  ledger?: number | string;
  verified?: boolean;
}

export interface ProjectAuditLogProps {
  project?: Project;
  events?: AuditEvent[];
  className?: string;
}

const FILTERS: Array<{ value: AuditFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'dispute', label: 'Dispute' },
];

const EVENT_ICONS: Record<AuditEventType, string> = {
  project: '🏗️',
  milestone: '📦',
  proposal: '🤝',
  dispute: '⚖️',
};

const AVATAR_STYLES = [
  'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  'bg-amber-500/20 text-amber-300 border-amber-500/40',
  'bg-rose-500/20 text-rose-300 border-rose-500/40',
  'bg-sky-500/20 text-sky-300 border-sky-500/40',
  'bg-violet-500/20 text-violet-300 border-violet-500/40',
];

function toAuditEvent(record: ProjectAuditEventRecord): AuditEvent {
  const type = (['project', 'milestone', 'proposal', 'dispute'].includes(record.type)
    ? record.type
    : 'project') as AuditEventType;
  return {
    id: record.id,
    type,
    action: record.action,
    description: record.description,
    timestamp: record.timestamp,
    signer: record.signer,
    txHash: record.txHash,
    ledger: record.ledger,
    verified: record.verified ?? Boolean(record.txHash),
  };
}

export function buildProjectAuditEvents(project: Project): AuditEvent[] {
  const createdAt = project.created_at || new Date().toISOString();
  const baseTime = Date.parse(createdAt) || Date.now();
  const shifted = (days: number) => new Date(baseTime + days * 86_400_000).toISOString();
  const events: AuditEvent[] = [
    {
      id: `${project.id}-created`,
      type: 'project',
      action: 'Project Created',
      description: `Escrow project "${project.title}" was initialized with a ${project.budget} ${project.token || 'USDC'} budget.`,
      timestamp: createdAt,
      signer: project.client_address,
      txHash: project.tx_hash,
      verified: Boolean(project.tx_hash),
    },
  ];

  if (project.freelancer_address || project.status !== 'open') {
    events.push({
      id: `${project.id}-proposal-accepted`,
      type: 'proposal',
      action: 'Proposal Accepted',
      description: project.freelancer_address
        ? 'The freelancer was assigned to the project.'
        : 'A freelancer proposal was accepted for this project.',
      timestamp: shifted(1),
      signer: project.freelancer_address || project.client_address,
      txHash: project.tx_hash,
      verified: Boolean(project.tx_hash),
    });
  }

  (project.milestones || []).forEach((milestone, index) => {
    const label = `Milestone ${milestone.milestone_index || index + 1}`;

    if (milestone.status !== 'pending') {
      events.push({
        id: `${milestone.id || index}-submitted`,
        type: 'milestone',
        action: `${label} Submitted`,
        description: milestone.title,
        timestamp: milestone.submitted_at || shifted(index + 2),
        signer: project.freelancer_address,
      });
    }

    if (milestone.status === 'approved') {
      events.push({
        id: `${milestone.id || index}-approved`,
        type: 'milestone',
        action: `${label} Approved`,
        description: `${milestone.amount} ${project.token || 'USDC'} released to the freelancer.`,
        timestamp: milestone.auto_release_at || shifted(index + 3),
        signer: project.client_address,
      });
    }

    if (milestone.status === 'disputed') {
      events.push({
        id: `${milestone.id || index}-disputed`,
        type: 'dispute',
        action: `${label} Disputed`,
        description: milestone.revision_note || 'Milestone payment was disputed and frozen for arbitration.',
        timestamp: shifted(index + 4),
        signer: project.client_address || project.freelancer_address,
      });
    }
  });

  if (project.status === 'disputed') {
    events.push({
      id: `${project.id}-dispute-opened`,
      type: 'dispute',
      action: 'Dispute Opened',
      description: 'Project funds were frozen pending arbiter ruling.',
      timestamp: shifted(5),
      signer: project.client_address || project.freelancer_address,
      txHash: project.tx_hash,
      verified: Boolean(project.tx_hash),
    });
  }

  return events.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

function avatarStyle(address: string): string {
  const hash = Array.from(address).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_STYLES[hash % AVATAR_STYLES.length];
}


function formatTimestamp(timestamp: string): string {
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? timestamp : new Date(parsed).toLocaleString();
}

export function ProjectAuditLog({ project, events, className = '' }: ProjectAuditLogProps) {
  const [remoteEvents, setRemoteEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState<AuditFilter>('all');

  const shouldFetch = events === undefined;
  useEffect(() => {
    let active = true;
    const projectId = project?.id;
    if (!shouldFetch || !projectId) return;

    async function loadEvents() {
      const records = await fetchProjectAuditEvents(projectId as string);
      if (active) setRemoteEvents(records.map(toAuditEvent));
    }

    void loadEvents();
    return () => {
      active = false;
    };
  }, [project?.id, shouldFetch]);

  const allEvents = useMemo(() => {
    const derived = project ? buildProjectAuditEvents(project) : [];
    const provided = events || remoteEvents;
    const byId = new Map<string, AuditEvent>();
    derived.forEach((event) => byId.set(event.id, event));
    provided.forEach((event) => byId.set(event.id, event));
    return Array.from(byId.values()).sort(
      (a, b) => (Date.parse(a.timestamp) || 0) - (Date.parse(b.timestamp) || 0)
    );
  }, [project, events, remoteEvents]);

  const filteredEvents = filter === 'all' ? allEvents : allEvents.filter((event) => event.type === filter);
  const verifiedCount = allEvents.filter((event) => event.verified || event.txHash).length;

  return (
    <section
      id="audit-log"
      data-testid="project-audit-log"
      className={`rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl sm:p-7 ${className}`}
    >
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Activity Audit Log</h2>
          <p className="mt-1 text-xs text-slate-400">
            Verified chronology of project, proposal, milestone, and dispute events.
          </p>
          <p className="mt-2 text-[11px] text-emerald-400">
            {verifiedCount} of {allEvents.length} events linked to a Stellar ledger hash
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter audit events">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              data-testid={`audit-filter-${option.value}`}
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === option.value
                  ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300'
                  : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No audit events match this filter.</p>
      ) : (
        <ol className="mt-6 space-y-0">
          {filteredEvents.map((event, index) => {
            const verified = Boolean(event.verified || event.txHash);
            return (
              <li key={event.id} data-testid="audit-event" className="relative flex gap-4 pb-6 last:pb-0">
                {index < filteredEvents.length - 1 && (
                  <span className="absolute left-[15px] top-9 h-full w-px bg-slate-800" aria-hidden="true" />
                )}
                <span
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm ${
                    event.type === 'dispute'
                      ? 'border-red-500/40 bg-red-500/15'
                      : event.type === 'milestone'
                      ? 'border-indigo-500/40 bg-indigo-500/15'
                      : event.type === 'proposal'
                      ? 'border-emerald-500/40 bg-emerald-500/15'
                      : 'border-slate-600 bg-slate-800'
                  }`}
                  aria-hidden="true"
                >
                  {EVENT_ICONS[event.type]}
                </span>

                <div className="min-w-0 flex-1 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">{event.action}</p>
                      {event.description && (
                        <p className="mt-0.5 break-words text-xs text-slate-400">{event.description}</p>
                      )}
                      <p className="mt-1 text-[11px] text-slate-500">{formatTimestamp(event.timestamp)}</p>
                    </div>

                    {verified && event.txHash ? (
                      <a
                        data-testid="audit-verified-badge"
                        href={getStellarExplorerUrl(event.txHash, 'tx')}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Verify transaction ${event.txHash} on Stellar Expert`}
                        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400 transition-colors hover:bg-emerald-500/20"
                      >
                        <span aria-hidden="true">✓</span> Verified ↗
                      </a>
                    ) : (
                      <span className="self-start rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                        Unverified
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-800/80 pt-3">
                    {event.signer ? (
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold ${avatarStyle(event.signer)}`}
                          aria-hidden="true"
                        >
                          {event.signer.slice(2, 4).toUpperCase()}
                        </span>
                        <CryptoId
                          value={event.signer}
                          head={6}
                          tail={4}
                          title={event.signer}
                          className="text-slate-300"
                        />
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500">Signer unavailable</span>
                    )}

                    {event.txHash && (
                      <span className="text-xs text-slate-500">
                        Tx <CryptoId value={event.txHash} head={6} tail={4} />
                        {event.ledger !== undefined ? ` • Ledger ${event.ledger}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default ProjectAuditLog;
