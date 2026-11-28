'use client';

import React, { useState, useEffect } from 'react';
import { CryptoId } from '@/components/ui/CryptoId';

export interface StarredFreelancer {
  address: string;
  name?: string;
  notes: string;
  starredAt: number;
  portfolioUrl?: string;
}

const STORAGE_KEY = 'trustpay_starred_freelancers';

export function getStarredFreelancers(): StarredFreelancer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStarredFreelancers(freelancers: StarredFreelancer[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freelancers));
    window.dispatchEvent(new Event('trustpay_starred_updated'));
  } catch {
    // Local storage full or blocked
  }
}

export function isFreelancerStarred(address: string): boolean {
  if (!address) return false;
  const list = getStarredFreelancers();
  return list.some((f) => f.address.toLowerCase() === address.toLowerCase());
}

export function toggleStarFreelancer(data: { address: string; name?: string; portfolioUrl?: string }): boolean {
  if (!data.address) return false;
  const list = getStarredFreelancers();
  const existingIdx = list.findIndex((f) => f.address.toLowerCase() === data.address.toLowerCase());

  let isNowStarred = false;
  if (existingIdx >= 0) {
    list.splice(existingIdx, 1);
    isNowStarred = false;
  } else {
    list.push({
      address: data.address,
      name: data.name,
      notes: '',
      starredAt: Date.now(),
      portfolioUrl: data.portfolioUrl,
    });
    isNowStarred = true;
  }

  saveStarredFreelancers(list);
  return isNowStarred;
}

export function updateFreelancerNotes(address: string, notes: string): void {
  if (!address) return;
  const list = getStarredFreelancers();
  const item = list.find((f) => f.address.toLowerCase() === address.toLowerCase());
  if (item) {
    item.notes = notes;
    saveStarredFreelancers(list);
  }
}

export interface StarButtonProps {
  address: string;
  name?: string;
  portfolioUrl?: string;
  className?: string;
  onToggle?: (starred: boolean) => void;
}

export const StarButton: React.FC<StarButtonProps> = ({
  address,
  name,
  portfolioUrl,
  className = '',
  onToggle,
}) => {
  const [starred, setStarred] = useState(false);

  useEffect(() => {
    setStarred(isFreelancerStarred(address));

    const handleUpdate = () => {
      setStarred(isFreelancerStarred(address));
    };

    window.addEventListener('trustpay_starred_updated', handleUpdate);
    return () => window.removeEventListener('trustpay_starred_updated', handleUpdate);
  }, [address]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = toggleStarFreelancer({ address, name, portfolioUrl });
    setStarred(nextState);
    if (onToggle) onToggle(nextState);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={starred ? 'Unstar freelancer' : 'Star freelancer'}
      title={starred ? 'Starred contractor (Saved)' : 'Star contractor (Save to private CRM)'}
      data-testid={`star-btn-${address}`}
      className={`p-1.5 rounded-lg border transition-colors ${
        starred
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
          : 'bg-[#232326] border-[#333338] text-muted-foreground hover:text-white hover:border-[#44444a]'
      } ${className}`}
    >
      <svg
        className={`w-4 h-4 ${starred ? 'fill-amber-400 text-amber-400' : 'fill-none text-current'}`}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    </button>
  );
};

export interface StarredFreelancersListProps {
  onInviteToProject?: (freelancerAddress: string) => void;
  className?: string;
}

export const StarredFreelancersList: React.FC<StarredFreelancersListProps> = ({
  onInviteToProject,
  className = '',
}) => {
  const [freelancers, setFreelancers] = useState<StarredFreelancer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savedNoteStatus, setSavedNoteStatus] = useState<Record<string, boolean>>({});

  const reloadFreelancers = () => {
    const list = getStarredFreelancers();
    setFreelancers(list);
    const notesMap: Record<string, string> = {};
    list.forEach((f) => {
      notesMap[f.address] = f.notes || '';
    });
    setEditingNotes(notesMap);
  };

  useEffect(() => {
    reloadFreelancers();

    const handleUpdate = () => reloadFreelancers();
    window.addEventListener('trustpay_starred_updated', handleUpdate);
    return () => window.removeEventListener('trustpay_starred_updated', handleUpdate);
  }, []);

  const handleNoteChange = (address: string, val: string) => {
    setEditingNotes((prev) => ({ ...prev, [address]: val }));
  };

  const handleSaveNotes = (address: string) => {
    const notes = editingNotes[address] || '';
    updateFreelancerNotes(address, notes);
    setSavedNoteStatus((prev) => ({ ...prev, [address]: true }));
    setTimeout(() => {
      setSavedNoteStatus((prev) => ({ ...prev, [address]: false }));
    }, 2000);
  };

  const handleUnstar = (address: string) => {
    toggleStarFreelancer({ address });
  };

  const filtered = freelancers.filter((f) => {
    const q = searchQuery.toLowerCase();
    const matchAddr = f.address.toLowerCase().includes(q);
    const matchName = f.name?.toLowerCase().includes(q);
    const matchNotes = f.notes?.toLowerCase().includes(q);
    return matchAddr || matchName || matchNotes;
  });

  return (
    <div
      className={`rounded-2xl border border-[#27272a] bg-[#18181b] p-6 shadow-2xl space-y-5 ${className}`}
      data-testid="starred-freelancers-container"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272a]">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Saved Contractors</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
              {freelancers.length} Bookmarked
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Private CRM directory of starred freelancers, notes, and quick escrow invitations.
          </p>
        </div>

        {freelancers.length > 0 && (
          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search address or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-[#232326] border border-[#333338] rounded-xl text-white text-xs placeholder-[#71717a] focus:outline-none focus:border-blue-500 transition-colors"
              data-testid="starred-search-input"
            />
          </div>
        )}
      </div>

      {freelancers.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-[#27272a] rounded-xl" data-testid="empty-starred-state">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <svg className="w-6 h-6 fill-none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-white">No contractors bookmarked yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Click the star icon on any applicant card across your escrow projects to save high-performing freelancers here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground">
          No starred contractors match "{searchQuery}"
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="starred-cards-grid">
          {filtered.map((freelancer) => {
            const isSaved = savedNoteStatus[freelancer.address];
            return (
              <div
                key={freelancer.address}
                className="bg-[#202024] border border-[#2e2e33] rounded-xl p-4 flex flex-col justify-between gap-4 transition-all hover:border-[#3e3e44]"
                data-testid={`starred-card-${freelancer.address}`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      {freelancer.name && (
                        <h4 className="text-sm font-semibold text-white">{freelancer.name}</h4>
                      )}
                      <div className="flex items-center gap-1.5">
                        <CryptoId
                          value={freelancer.address}
                          className="sm:text-xs text-white bg-[#17171a] px-2.5 py-0.5 rounded-lg border border-[#2b2b30] font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StarButton address={freelancer.address} />
                    </div>
                  </div>

                  {/* Private Collaboration Notes */}
                  <div className="space-y-1.5 pt-2 border-t border-[#2a2a2f]">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Private Notes</span>
                      {isSaved && <span className="text-emerald-400 font-medium">Saved</span>}
                    </div>
                    <div className="relative">
                      <textarea
                        rows={2}
                        value={editingNotes[freelancer.address] ?? ''}
                        onChange={(e) => handleNoteChange(freelancer.address, e.target.value)}
                        placeholder="e.g. Proven Soroban Rust dev, delivered milestone early..."
                        className="w-full px-3 py-2 bg-[#17171a] border border-[#2b2b30] rounded-lg text-white text-xs placeholder-[#5c5c66] focus:outline-none focus:border-blue-500 transition-colors resize-none"
                        data-testid={`notes-textarea-${freelancer.address}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveNotes(freelancer.address)}
                        className="mt-1 px-2.5 py-1 bg-[#2e2e34] hover:bg-[#3b3b42] text-[11px] font-medium text-white rounded transition-colors"
                        data-testid={`save-note-btn-${freelancer.address}`}
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#2a2a2f] flex items-center justify-between text-xs">
                  <span className="text-[11px] text-muted-foreground">
                    Starred: {new Date(freelancer.starredAt).toLocaleDateString()}
                  </span>
                  {onInviteToProject && (
                    <button
                      type="button"
                      onClick={() => onInviteToProject(freelancer.address)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                      data-testid={`invite-btn-${freelancer.address}`}
                    >
                      <span>Invite to Project</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
