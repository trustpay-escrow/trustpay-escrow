'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { toast } from 'sonner';
import { useWalletStore } from '@/store/walletStore';
import { CollaborativeScopeProvider, CollaborationStatus, CollaborationUser } from '@/lib/yjs-provider';
import { submitMilestones } from '@/hooks/useMilestonesForm';
import { MilestoneFormData } from '@/lib/validators';

interface ScopeSignoff {
  id: string;
  name: string;
  color: string;
  role?: string;
  signedAt: string;
}

interface MilestoneDraft extends MilestoneFormData {
  id: string;
}

interface RemotePresence {
  clientId: number;
  state: {
    user?: { id?: string; name?: string; color?: string; role?: string };
    field?: string | null;
    selectionStart?: number;
    selectionEnd?: number;
    focused?: boolean;
  } | null;
}

interface CaretSpec {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface CollaborativeScopeBuilderProps {
  projectId?: string;
  roomId?: string;
  onSubmitted?: (milestones: MilestoneFormData[]) => void;
}

const PRESENCE_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#f97316'];

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
}

function shortId(id: string): string {
  if (!id) return 'anon';
  return id.length > 10 ? `${id.slice(0, 5)}…${id.slice(-4)}` : id;
}

function yText(value: unknown, fallback = ''): string {
  if (value instanceof Y.Text) return value.toString();
  return typeof value === 'string' ? value : fallback;
}

function getMilestonesArray(doc: Y.Doc) {
  return doc.getArray<Y.Map<unknown>>('milestones');
}

function getSignoffsMap(doc: Y.Doc) {
  return doc.getMap<ScopeSignoff>('signoffs');
}

function getMetaMap(doc: Y.Doc) {
  return doc.getMap<unknown>('meta');
}

function createMilestoneMap(doc: Y.Doc, milestone: Partial<MilestoneFormData>, index: number): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  const id = `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  map.set('id', id);

  const title = new Y.Text();
  title.insert(0, milestone.title || '');
  map.set('title', title);

  const description = new Y.Text();
  description.insert(0, milestone.description || '');
  map.set('description', description);

  map.set('amount', String(milestone.amount ?? 0));
  map.set('due_date', milestone.due_date || '');
  map.set('milestone_index', milestone.milestone_index ?? index);
  map.set('revision_limit', milestone.revision_limit ?? 0);
  map.set('deliverable_type', milestone.deliverable_type || 'GitHub Repository');
  map.set('status', 'pending');
  return map;
}

function snapshotMilestones(doc: Y.Doc): MilestoneDraft[] {
  return getMilestonesArray(doc).toArray().map((item, index) => {
    const map = item instanceof Y.Map ? item : new Y.Map<unknown>();
    return {
      id: String(map.get('id') || `milestone-${index}`),
      title: yText(map.get('title')),
      description: yText(map.get('description')),
      amount: Number(map.get('amount')) || 0,
      due_date: String(map.get('due_date') || ''),
      milestone_index: Number(map.get('milestone_index')) || index,
      revision_limit: Number(map.get('revision_limit')) || 0,
      deliverable_type: String(map.get('deliverable_type') || 'GitHub Repository'),
    };
  });
}

function snapshotSignoffs(doc: Y.Doc): Record<string, ScopeSignoff> {
  const result: Record<string, ScopeSignoff> = {};
  getSignoffsMap(doc).forEach((value, key) => {
    if (value && typeof value === 'object') {
      result[key] = value;
    }
  });
  return result;
}

function applyTextDiff(text: Y.Text, nextValue: string) {
  const current = text.toString();
  if (current === nextValue) return;

  let start = 0;
  const minLength = Math.min(current.length, nextValue.length);
  while (start < minLength && current[start] === nextValue[start]) start += 1;

  let currentEnd = current.length;
  let nextEnd = nextValue.length;
  while (currentEnd > start && nextEnd > start && current[currentEnd - 1] === nextValue[nextEnd - 1]) {
    currentEnd -= 1;
    nextEnd -= 1;
  }

  text.doc?.transact(() => {
    if (currentEnd > start) text.delete(start, currentEnd - start);
    if (nextEnd > start) text.insert(start, nextValue.slice(start, nextEnd));
  });
}

function getCaretOffset(textarea: HTMLTextAreaElement, value: string, position: number) {
  const mirror = document.createElement('div');
  const style = window.getComputedStyle(textarea);
  const rect = textarea.getBoundingClientRect();

  Object.assign(mirror.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    width: `${textarea.offsetWidth}px`,
    boxSizing: 'border-box',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflow: 'hidden',
    font: style.font,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    padding: style.padding,
    border: style.border,
    borderRadius: style.borderRadius,
  });

  const before = document.createElement('span');
  before.textContent = value.slice(0, Math.max(0, Math.min(position, value.length)));
  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  const after = document.createElement('span');
  after.textContent = value.slice(Math.max(0, Math.min(position, value.length)));

  mirror.appendChild(before);
  mirror.appendChild(marker);
  mirror.appendChild(after);
  textarea.parentElement?.appendChild(mirror);

  const markerRect = marker.getBoundingClientRect();
  mirror.remove();

  return {
    left: markerRect.left - rect.left,
    top: markerRect.top - rect.top,
  };
}

function CollaborativeTextarea({
  value,
  onValueChange,
  onPresence,
  onPresenceBlur,
  carets,
  disabled,
  placeholder,
  rows = 4,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onPresence?: (start: number, end: number) => void;
  onPresenceBlur?: () => void;
  carets: CaretSpec[];
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [coords, setCoords] = useState<Array<{ id: string; left: number; top: number }>>([]);
  const caretsSignature = carets.map((caret) => `${caret.id}:${caret.position}`).join('|');

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setCoords([]);
      return;
    }
    const next = carets.map((caret) => ({
      id: caret.id,
      ...getCaretOffset(textarea, value, caret.position),
    }));
    setCoords(next);
    // caretsSignature captures remote caret movement without depending on a new array identity each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caretsSignature, value]);

  const reportSelection = () => {
    const textarea = textareaRef.current;
    if (textarea) onPresence?.(textarea.selectionStart ?? 0, textarea.selectionEnd ?? 0);
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        onFocus={reportSelection}
        onSelect={reportSelection}
        onKeyUp={reportSelection}
        onClick={reportSelection}
        onBlur={onPresenceBlur}
        className="w-full px-3.5 py-3 bg-[#111113] border border-[#333338] rounded-xl text-sm text-white placeholder-[#52525b] focus:outline-none focus:border-blue-500 transition-colors resize-y disabled:opacity-60"
      />
      {coords.map((coord) => {
        const caret = carets.find((item) => item.id === coord.id);
        if (!caret) return null;
        return (
          <div
            key={coord.id}
            className="pointer-events-none absolute z-10"
            style={{ left: coord.left, top: coord.top }}
            title={`${caret.name} is editing here`}
          >
            <div className="w-[2px] h-5 rounded-full" style={{ backgroundColor: caret.color }} />
          </div>
        );
      })}
    </div>
  );
}

function PresenceHint({ people }: { people: Array<{ name: string; color: string }> }) {
  if (people.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold">
      {people.slice(0, 3).map((person) => (
        <span
          key={person.name}
          className="px-1.5 py-0.5 rounded-full border"
          style={{ color: person.color, borderColor: `${person.color}55`, backgroundColor: `${person.color}14` }}
        >
          {person.name}
        </span>
      ))}
    </span>
  );
}

export function CollaborativeScopeBuilder({ projectId, roomId, onSubmitted }: CollaborativeScopeBuilderProps) {
  const { address, walletName } = useWalletStore();
  const resolvedRoomId = roomId || projectId || 'scope-draft';
  const doc = useMemo(() => new Y.Doc({ guid: `trustpay-scope-${resolvedRoomId}` }), [resolvedRoomId]);

  const user = useMemo<CollaborationUser>(() => {
    const id = address || 'anonymous';
    return {
      id,
      name: walletName || (address ? shortId(address) : 'Anonymous'),
      color: colorForId(id),
      role: 'participant',
    };
  }, [address, walletName]);

  const providerRef = useRef<CollaborativeScopeProvider | null>(null);
  const [status, setStatus] = useState<CollaborationStatus>('disconnected');
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([]);
  const [signoffs, setSignoffs] = useState<Record<string, ScopeSignoff>>({});
  const [locked, setLocked] = useState(false);
  const [remoteStates, setRemoteStates] = useState<RemotePresence[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [submitting, setSubmitting] = useState(false);

  const refreshSnapshots = useCallback(() => {
    setMilestones(snapshotMilestones(doc));
    setSignoffs(snapshotSignoffs(doc));
    setLocked(getMetaMap(doc).get('locked') === true);
  }, [doc]);

  useEffect(() => {
    const provider = new CollaborativeScopeProvider({
      roomId: resolvedRoomId,
      doc,
      user,
      onStatusChange: setStatus,
    });
    providerRef.current = provider;
    provider.connect();

    const syncAwareness = () => {
      const states: RemotePresence[] = [];
      provider.awareness.getStates().forEach((state, clientId) => {
        if (clientId !== provider.awareness.clientID) {
          states.push({ clientId, state: state as RemotePresence['state'] });
        }
      });
      setRemoteStates(states);
    };

    queueMicrotask(refreshSnapshots);
    const onDocUpdate = () => refreshSnapshots();
    doc.on('update', onDocUpdate);
    provider.awareness.on('change', syncAwareness);
    syncAwareness();

    return () => {
      doc.off('update', onDocUpdate);
      provider.awareness.off('change', syncAwareness);
      provider.destroy();
      providerRef.current = null;
    };
  }, [doc, resolvedRoomId, refreshSnapshots, user]);

  useEffect(() => {
    const provider = providerRef.current;
    if (!provider) return;
    provider.awareness.setLocalStateField('field', activeField);
    provider.awareness.setLocalStateField('selectionStart', selection.start);
    provider.awareness.setLocalStateField('selectionEnd', selection.end);
    provider.awareness.setLocalStateField('focused', activeField !== null);
  }, [activeField, selection, status]);

  const remoteForField = useCallback(
    (fieldId: string) =>
      remoteStates
        .filter((remote) => remote.state?.field === fieldId && remote.state?.focused !== false)
        .map((remote) => ({
          name: remote.state?.user?.name || shortId(remote.state?.user?.id || String(remote.clientId)),
          color: remote.state?.user?.color || colorForId(String(remote.clientId)),
        })),
    [remoteStates]
  );

  const descriptionCarets = useCallback(
    (index: number): CaretSpec[] =>
      remoteStates
        .filter((remote) => remote.state?.field === `milestone-${index}-description`)
        .map((remote) => ({
          id: String(remote.clientId),
          name: remote.state?.user?.name || shortId(remote.state?.user?.id || String(remote.clientId)),
          color: remote.state?.user?.color || colorForId(String(remote.clientId)),
          position: Number(remote.state?.selectionStart) || 0,
        })),
    [remoteStates]
  );

  const setPresence = (fieldId: string | null, start = 0, end = start) => {
    setActiveField(fieldId);
    setSelection({ start, end });
  };

  const presenceProps = (fieldId: string) => ({
    onFocus: () => setPresence(fieldId),
    onSelect: (event: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setPresence(fieldId, event.currentTarget.selectionStart ?? 0, event.currentTarget.selectionEnd ?? 0),
    onKeyUp: (event: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setPresence(fieldId, event.currentTarget.selectionStart ?? 0, event.currentTarget.selectionEnd ?? 0),
    onClick: (event: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setPresence(fieldId, event.currentTarget.selectionStart ?? 0, event.currentTarget.selectionEnd ?? 0),
    onBlur: () => setPresence(null),
  });

  const milestoneMapAt = (index: number) => {
    const array = getMilestonesArray(doc);
    const item = array.get(index);
    return item instanceof Y.Map ? item : null;
  };

  const updateScalar = (index: number, key: string, value: string | number) => {
    doc.transact(() => {
      milestoneMapAt(index)?.set(key, value);
    });
  };

  const updateText = (index: number, key: 'title' | 'description', nextValue: string) => {
    doc.transact(() => {
      const map = milestoneMapAt(index);
      if (!map) return;
      const existing = map.get(key);
      if (existing instanceof Y.Text) {
        applyTextDiff(existing, nextValue);
      } else {
        const text = new Y.Text();
        text.insert(0, nextValue);
        map.set(key, text);
      }
    });
  };

  const addMilestone = () => {
    doc.transact(() => {
      const array = getMilestonesArray(doc);
      array.push([createMilestoneMap(doc, { title: '', description: '', amount: 0, due_date: '', milestone_index: array.length, revision_limit: 0, deliverable_type: 'GitHub Repository' }, array.length)]);
      array.forEach((item, index) => {
        if (item instanceof Y.Map) item.set('milestone_index', index);
      });
    });
    toast.success('Milestone added to shared scope');
  };

  const removeMilestone = (index: number) => {
    doc.transact(() => {
      const array = getMilestonesArray(doc);
      array.delete(index, 1);
      array.forEach((item, milestoneIndex) => {
        if (item instanceof Y.Map) item.set('milestone_index', milestoneIndex);
      });
    });
  };

  const signoffCount = Object.keys(signoffs).length;
  const hasSigned = Boolean(signoffs[user.id]);
  const isLocked = locked && signoffCount >= 2;

  const handleLockAndSign = () => {
    if (isLocked) return;
    doc.transact(() => {
      const signoffsMap = getSignoffsMap(doc);
      signoffsMap.set(user.id, {
        id: user.id,
        name: user.name,
        color: user.color,
        role: user.role,
        signedAt: new Date().toISOString(),
      });
      let count = 0;
      signoffsMap.forEach(() => {
        count += 1;
      });
      if (count >= 2) {
        getMetaMap(doc).set('locked', true);
      }
    });

    if (!hasSigned) {
      toast.success('Scope signed. Waiting for the counterparty to sign.');
    } else if (signoffCount + 1 >= 2) {
      toast.success('Both parties signed — scope locked for contract initialization.');
    } else {
      toast.info('Scope signed. Waiting for the counterparty to sign.');
    }
  };

  const handleSubmit = async () => {
    if (!projectId) {
      toast.error('Add ?projectId=<id> to this collaborative room before submitting milestones.');
      return;
    }
    if (!isLocked) {
      toast.error('Both parties must sign the scope before submitting milestones.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: MilestoneFormData[] = milestones.map((milestone) => ({
        title: milestone.title,
        description: milestone.description,
        amount: milestone.amount,
        due_date: milestone.due_date,
        milestone_index: milestone.milestone_index,
        revision_limit: milestone.revision_limit,
        deliverable_type: milestone.deliverable_type,
      }));
      const result = await submitMilestones(projectId, payload);
      if (result.success) onSubmitted?.(payload);
    } finally {
      setSubmitting(false);
    }
  };

  const presencePeople = remoteStates.map((remote) => ({
    name: remote.state?.user?.name || shortId(remote.state?.user?.id || String(remote.clientId)),
    color: remote.state?.user?.color || colorForId(String(remote.clientId)),
  }));

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white px-4 py-8 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-2xl border border-[#27272a] bg-[#121214] p-5 sm:p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">Collaborative Scope Builder</h1>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  status === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : status === 'connecting'
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-red-500/10 text-red-300 border-red-500/30'
                }`}>
                  {status === 'connected' ? 'Live' : status === 'connecting' ? 'Connecting' : status === 'error' ? 'Connection error' : 'Offline'}
                </span>
                {isLocked && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                    Scope locked
                  </span>
                )}
              </div>
              <p className="text-sm text-[#a1a1aa] mt-1">
                Room <span className="font-mono text-[#e4e4e7]">{resolvedRoomId}</span>
                {projectId ? ` • Project ${shortId(projectId)}` : ' • Draft room (add ?projectId= to submit)'}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center -space-x-2">
                <div
                  className="w-8 h-8 rounded-full border-2 border-[#121214] flex items-center justify-center text-[10px] font-black"
                  style={{ backgroundColor: user.color, color: '#0b0b0d' }}
                  title={user.name}
                >
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                {presencePeople.map((person, index) => (
                  <div
                    key={`${person.name}-${index}`}
                    className="w-8 h-8 rounded-full border-2 border-[#121214] flex items-center justify-center text-[10px] font-black"
                    style={{ backgroundColor: person.color, color: '#0b0b0d' }}
                    title={person.name}
                  >
                    {person.name.slice(0, 1).toUpperCase()}
                  </div>
                ))}
              </div>
              {(status === 'disconnected' || status === 'error') && (
                <button
                  type="button"
                  onClick={() => providerRef.current?.reconnect()}
                  className="px-3 py-2 rounded-xl bg-[#1f2937] hover:bg-[#273449] text-xs font-bold border border-[#334155]"
                >
                  Reconnect
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {milestones.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#333338] bg-[#121214]/60 p-8 text-center text-sm text-[#a1a1aa]">
              No milestones yet. Add the first milestone to start the shared scope.
            </div>
          )}

          {milestones.map((milestone, index) => (
            <div key={milestone.id} className="rounded-2xl border border-[#27272a] bg-[#121214] p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-black flex items-center justify-center">
                    {index + 1}
                  </span>
                  <h2 className="text-sm font-bold text-white">Milestone {index + 1}</h2>
                  <PresenceHint people={remoteForField(`milestone-${index}-title`)} />
                </div>
                {!isLocked && milestones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMilestone(index)}
                    className="text-xs font-bold text-red-300 hover:text-red-200"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#d4d4d8]">Title</label>
                <input
                  value={milestone.title}
                  disabled={isLocked}
                  onChange={(event) => updateText(index, 'title', event.target.value)}
                  placeholder="Milestone title"
                  {...presenceProps(`milestone-${index}-title`)}
                  className="w-full px-3.5 py-2.5 bg-[#111113] border border-[#333338] rounded-xl text-sm text-white placeholder-[#52525b] focus:outline-none focus:border-blue-500 disabled:opacity-60"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#d4d4d8]">Description</label>
                  <PresenceHint people={remoteForField(`milestone-${index}-description`)} />
                </div>
                <CollaborativeTextarea
                  value={milestone.description || ''}
                  disabled={isLocked}
                  carets={descriptionCarets(index)}
                  placeholder="Describe deliverables, acceptance criteria, and handoff notes..."
                  onValueChange={(value) => updateText(index, 'description', value)}
                  onPresence={(start, end) => setPresence(`milestone-${index}-description`, start, end)}
                  onPresenceBlur={() => setPresence(null)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#d4d4d8]">Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={milestone.amount || ''}
                    disabled={isLocked}
                    onChange={(event) => updateScalar(index, 'amount', event.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#111113] border border-[#333338] rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#d4d4d8]">Due date</label>
                  <input
                    type="date"
                    value={milestone.due_date || ''}
                    disabled={isLocked}
                    onChange={(event) => updateScalar(index, 'due_date', event.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#111113] border border-[#333338] rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#d4d4d8]">Deliverable</label>
                  <input
                    value={milestone.deliverable_type || ''}
                    disabled={isLocked}
                    onChange={(event) => updateScalar(index, 'deliverable_type', event.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#111113] border border-[#333338] rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#d4d4d8]">Revisions</label>
                  <input
                    type="number"
                    min="0"
                    value={milestone.revision_limit || 0}
                    disabled={isLocked}
                    onChange={(event) => updateScalar(index, 'revision_limit', Number(event.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-[#111113] border border-[#333338] rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[#27272a] bg-[#121214] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white">Mutual sign-off</h3>
            <p className="text-xs text-[#a1a1aa] mt-1">
              {isLocked
                ? 'Both parties signed. The scope is locked and ready for contract initialization.'
                : hasSigned
                  ? `You signed. Waiting for ${Math.max(0, 2 - signoffCount)} more signature${signoffCount === 0 ? '' : 's'}.`
                  : 'Both the client and contractor must sign before milestones can be submitted.'}
            </p>
            <div className="flex items-center gap-2 mt-3">
              {Object.values(signoffs).map((signoff) => (
                <span
                  key={signoff.id}
                  className="px-2.5 py-1 rounded-full text-[11px] font-bold border"
                  style={{ color: signoff.color, borderColor: `${signoff.color}55`, backgroundColor: `${signoff.color}14` }}
                >
                  ✓ {signoff.name}
                </span>
              ))}
              {signoffCount === 0 && <span className="text-[11px] text-[#71717a]">No signatures yet</span>}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {!isLocked && (
              <button
                type="button"
                onClick={addMilestone}
                className="px-4 py-2.5 rounded-xl bg-[#1f2937] hover:bg-[#273449] text-sm font-bold border border-[#334155]"
              >
                + Add milestone
              </button>
            )}
            {!isLocked && (
              <button
                type="button"
                onClick={handleLockAndSign}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-black"
              >
                {hasSigned ? 'Confirm & Lock Scope' : 'Lock & Sign Scope'}
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isLocked || submitting || milestones.length === 0}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-[#27272a] disabled:text-[#52525b] text-white text-sm font-bold"
            >
              {submitting ? 'Submitting…' : 'Submit Milestones'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
