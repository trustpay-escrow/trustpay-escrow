'use client';

import React, { useMemo, useRef, useState } from 'react';
import type { Milestone, RevisionAttachment } from '@/types';
import { useEscapeKey } from '@/hooks/useEscapeKey';

export const MAX_REVISION_SCREENSHOTS = 3;
export const MAX_REVISION_SCREENSHOT_BYTES = 2 * 1024 * 1024;

export interface RevisionRequestPayload {
  milestoneId: string;
  note: string;
  checklist: string[];
  attachments: RevisionAttachment[];
  /** Full note sent to the backend, with the checklist appended. */
  formattedNote: string;
}

export interface RequestRevisionModalProps {
  isOpen: boolean;
  milestone: Milestone | null;
  tokenSymbol?: string;
  isSubmitting?: boolean;
  revisionsRemaining?: number;
  onClose: () => void;
  onSubmit: (payload: RevisionRequestPayload) => void | Promise<void>;
}

export function formatRevisionNote(note: string, checklist: string[]): string {
  const trimmed = note.trim();
  const items = checklist.map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) return trimmed;
  const checklistBlock = `Revision checklist:\n${items.map((item) => `- ${item}`).join('\n')}`;
  return trimmed ? `${trimmed}\n\n${checklistBlock}` : checklistBlock;
}

export function RequestRevisionModal({
  isOpen,
  milestone,
  tokenSymbol = 'USDC',
  isSubmitting = false,
  revisionsRemaining,
  onClose,
  onSubmit,
}: RequestRevisionModalProps) {
  const [note, setNote] = useState('');
  const [checklistDraft, setChecklistDraft] = useState('');
  const [checklist, setChecklist] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<RevisionAttachment[]>([]);
  const [error, setError] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEscapeKey(onClose, isOpen && !isSubmitting);

  // The parent remounts the modal (via `key`) for each milestone, so every new
  // revision request starts from clean state without an effect-driven reset.

  const remaining = useMemo(() => {
    if (typeof revisionsRemaining === 'number') return revisionsRemaining;
    return milestone?.revisions_remaining ?? milestone?.revision_limit ?? 2;
  }, [milestone, revisionsRemaining]);

  const addChecklistItem = () => {
    const item = checklistDraft.trim();
    if (!item) return;
    if (checklist.length >= 12) {
      setError('A revision request can include at most 12 checklist items.');
      return;
    }
    if (!checklist.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
      setChecklist((prev) => [...prev, item]);
    }
    setChecklistDraft('');
    setError('');
  };

  const removeChecklistItem = (index: number) => {
    setChecklist((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachmentError('');
    const incoming = Array.from(files);
    const availableSlots = MAX_REVISION_SCREENSHOTS - attachments.length;
    if (availableSlots <= 0) {
      setAttachmentError(`You can attach up to ${MAX_REVISION_SCREENSHOTS} screenshots.`);
      return;
    }

    incoming.slice(0, availableSlots).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        setAttachmentError('Only screenshot images can be attached.');
        return;
      }
      if (file.size > MAX_REVISION_SCREENSHOT_BYTES) {
        setAttachmentError('Each screenshot must be 2 MB or smaller.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const url = typeof reader.result === 'string' ? reader.result : '';
        if (!url) return;
        setAttachments((prev) => [
          ...prev,
          { name: file.name, size: file.size, type: file.type, url },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!milestone) return;

    if (note.trim().length < 3) {
      setError('Add revision feedback of at least 3 characters.');
      return;
    }
    if (checklist.length === 0 && note.trim().length < 10) {
      setError('Describe the required changes or add at least one checklist item.');
      return;
    }
    if (remaining <= 0) {
      setError('No revisions remain for this milestone.');
      return;
    }

    setError('');
    await onSubmit({
      milestoneId: milestone.id,
      note: note.trim(),
      checklist,
      attachments,
      formattedNote: formatRevisionNote(note, checklist),
    });
  };

  if (!isOpen || !milestone) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="revision-modal-title"
        data-testid="request-revision-modal"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:p-7 custom-scrollbar"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Formal revision request
            </span>
            <h2 id="revision-modal-title" className="mt-1 text-xl font-bold text-white">
              {milestone.title}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Milestone #{milestone.milestone_index + 1} · {milestone.amount} {tokenSymbol}
            </p>
          </div>
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-300">
            Revision Requested
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-200">
          <p className="flex items-center gap-2 font-bold text-amber-300">
            <span aria-hidden="true">⏸</span>
            Timelock paused
          </p>
          <p className="mt-1">
            Requesting a revision resets the 7-day auto-release countdown until the freelancer
            re-submits. <strong>{Math.max(0, remaining)}</strong> revision
            {remaining === 1 ? '' : 's'} will remain after this request.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div>
            <label
              htmlFor="revision-note"
              className="mb-1.5 block text-xs font-semibold text-slate-200"
            >
              Revision feedback & required adjustments <span className="text-amber-400">*</span>
            </label>
            <textarea
              id="revision-note"
              rows={4}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                if (error) setError('');
              }}
              placeholder="Explain what needs to change before this milestone can be approved..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="revision-checklist"
              className="mb-1.5 block text-xs font-semibold text-slate-200"
            >
              Revision checklist
            </label>
            <div className="flex gap-2">
              <input
                id="revision-checklist"
                type="text"
                value={checklistDraft}
                onChange={(event) => setChecklistDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addChecklistItem();
                  }
                }}
                placeholder="e.g. Add unit tests for the dispute resolver"
                className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={addChecklistItem}
                data-testid="revision-add-checklist"
                className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500/20"
              >
                + Add
              </button>
            </div>

            {checklist.length > 0 ? (
              <ul className="mt-3 space-y-2" data-testid="revision-checklist-list">
                {checklist.map((item, index) => (
                  <li
                    key={`${item}-${index}`}
                    data-testid="revision-checklist-item"
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300"
                  >
                    <span className="flex items-start gap-2">
                      <span className="mt-0.5 text-amber-400" aria-hidden="true">
                        ☐
                      </span>
                      <span>{item}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(index)}
                      aria-label={`Remove checklist item ${item}`}
                      className="text-slate-500 transition-colors hover:text-rose-400"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500">
                Add concrete items so the freelancer can tick each fix off before re-submitting.
              </p>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="revision-screenshots"
                className="block text-xs font-semibold text-slate-200"
              >
                Annotated screenshots <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <span className="text-[10px] text-slate-500">
                {attachments.length}/{MAX_REVISION_SCREENSHOTS} · max 2 MB each
              </span>
            </div>
            <input
              ref={fileInputRef}
              id="revision-screenshots"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                handleFiles(event.target.files);
                event.target.value = '';
              }}
              className="block w-full cursor-pointer rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-400 file:mr-3 file:border-0 file:bg-slate-800 file:px-3 file:py-2.5 file:text-xs file:font-semibold file:text-slate-200 hover:file:bg-slate-700"
              data-testid="revision-screenshot-input"
            />
            {attachmentError && (
              <p role="alert" className="mt-1.5 text-[11px] text-rose-400">
                {attachmentError}
              </p>
            )}
            {attachments.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {attachments.map((attachment, index) => (
                  <li
                    key={`${attachment.name}-${index}`}
                    className="relative overflow-hidden rounded-lg border border-slate-700 bg-slate-950"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="h-16 w-20 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((prev) =>
                          prev.filter((_, itemIndex) => itemIndex !== index)
                        )
                      }
                      aria-label={`Remove screenshot ${attachment.name}`}
                      className="absolute right-0 top-0 bg-black/70 px-1.5 py-0.5 text-[10px] text-white hover:bg-rose-600"
                    >
                      ✕
                    </button>
                    <span className="block max-w-[80px] truncate bg-slate-900 px-1 py-0.5 text-[9px] text-slate-400">
                      {attachment.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || remaining <= 0}
              className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white shadow-lg transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Requesting revision…' : 'Sign & Request Revision 🔄'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RequestRevisionModal;
