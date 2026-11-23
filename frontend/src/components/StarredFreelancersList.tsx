'use client';

import React, { useState } from 'react';
import type { StarredFreelancer } from '@/types';
import { MAX_NOTE_LENGTH } from '@/lib/starred-freelancers';

export interface StarredFreelancersListProps {
  starred: StarredFreelancer[];
  onUnstar: (address: string) => void;
  onSaveNotes: (address: string, notes: string) => void;
  /** 1-click "Invite to New Project": the parent opens a pre-filled escrow form. */
  onInvite: (freelancer: StarredFreelancer) => void;
}

function short(address: string) {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-6)}` : address;
}

function NoteEditor({
  freelancer,
  onSave,
}: {
  freelancer: StarredFreelancer;
  onSave: (notes: string) => void;
}) {
  const [draft, setDraft] = useState(freelancer.notes);
  const [saved, setSaved] = useState(false);
  const dirty = draft !== freelancer.notes;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={`notes-${freelancer.address}`}
        className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]"
      >
        Private notes
      </label>
      <textarea
        id={`notes-${freelancer.address}`}
        value={draft}
        maxLength={MAX_NOTE_LENGTH}
        rows={2}
        onChange={(e) => {
          setDraft(e.target.value);
          setSaved(false);
        }}
        placeholder="e.g. Excellent Rust dev, fast turnaround"
        className="w-full px-3 py-2 bg-[#232326] border border-[#333338] rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
        data-testid={`starred-notes-${freelancer.address}`}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!dirty}
          onClick={() => {
            onSave(draft);
            setSaved(true);
          }}
          className="px-3 py-1 bg-[#232326] hover:bg-[#27272a] text-[#e4e4e7] border border-[#333338] text-[11px] font-bold rounded-lg disabled:opacity-40"
          data-testid={`starred-save-${freelancer.address}`}
        >
          Save notes
        </button>
        {saved && !dirty && (
          <span className="text-[11px] text-emerald-400" role="status">
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

/** "Saved Contractors": the client's starred freelancers with private notes (#255). */
export function StarredFreelancersList({
  starred,
  onUnstar,
  onSaveNotes,
  onInvite,
}: StarredFreelancersListProps) {
  if (starred.length === 0) {
    return (
      <div
        className="text-center py-12 bg-[#1c1c20]/40 rounded-xl border border-[#27272a]"
        data-testid="starred-empty"
      >
        <p className="text-sm text-[#a1a1aa]">
          No saved contractors yet. Star a freelancer on an applicant card to keep them here.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-4" data-testid="starred-list">
      {starred.map((f) => (
        <li
          key={f.address}
          className="bg-[#1c1c20]/90 border border-[#27272a] rounded-2xl p-5 space-y-3"
          data-testid={`starred-${f.address}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{f.name || short(f.address)}</p>
              <p className="text-[11px] font-mono text-[#71717a]" title={f.address}>
                {short(f.address)}
              </p>
              {f.lastProjectTitle && (
                <p className="text-[11px] text-[#a1a1aa]">Last project: {f.lastProjectTitle}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onInvite(f)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
                data-testid={`starred-invite-${f.address}`}
              >
                Invite to New Project
              </button>
              <button
                type="button"
                onClick={() => onUnstar(f.address)}
                aria-label={`Remove ${f.name || short(f.address)} from saved contractors`}
                className="px-2.5 py-1.5 text-amber-400 hover:text-amber-300 text-sm"
                data-testid={`starred-remove-${f.address}`}
              >
                ★
              </button>
            </div>
          </div>
          <NoteEditor freelancer={f} onSave={(notes) => onSaveNotes(f.address, notes)} />
        </li>
      ))}
    </ul>
  );
}
