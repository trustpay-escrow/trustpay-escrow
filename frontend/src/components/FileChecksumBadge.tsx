'use client';

import React, { useRef, useState } from 'react';
import {
  parseAttachmentChecksums,
  truncateHash,
  verifyFileIntegrity,
  type IntegrityResult,
} from '@/lib/checksum';

export type VerificationStatus = 'idle' | 'checking' | 'verified' | 'tampered' | 'error';

export interface FileChecksumBadgeProps {
  /** SHA-256 recorded when the file was submitted. */
  hash: string;
  fileName?: string;
  /** Controlled result, for server-driven or test scenarios. */
  status?: VerificationStatus;
  className?: string;
}

/**
 * Truncated SHA-256 badge with a "Verify File Integrity" tool (#254): pick the
 * downloaded file and it is hashed in the browser and compared with the
 * recorded hash. Green check on a match, red warning if the file was altered.
 */
export function FileChecksumBadge({ hash, fileName, status: controlled, className = '' }: FileChecksumBadgeProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [result, setResult] = useState<IntegrityResult | null>(null);
  const current = controlled ?? status;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setStatus('checking');
    try {
      const outcome = await verifyFileIntegrity(file, hash);
      setResult(outcome);
      setStatus(outcome.match ? 'verified' : 'tampered');
    } catch {
      setStatus('error');
    }
  };

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`} data-testid="file-checksum-badge">
      <span
        className="font-mono text-[11px] px-2 py-0.5 rounded-lg bg-[#232326] border border-[#333338] text-[#e4e4e7]"
        title={hash}
        data-testid="checksum-hash"
      >
        {truncateHash(hash)}
      </span>

      {current === 'verified' && (
        <span className="text-[11px] font-bold text-emerald-400" role="status" data-testid="checksum-verified">
          ✓ Verified. The file matches the submitted hash.
        </span>
      )}
      {current === 'tampered' && (
        <span className="text-[11px] font-bold text-red-400" role="alert" data-testid="checksum-tampered">
          ⚠ Tampered. This file does not match the submitted hash
          {result ? ` (got ${truncateHash(result.actual)})` : ''}.
        </span>
      )}
      {current === 'error' && (
        <span className="text-[11px] text-amber-300" role="alert" data-testid="checksum-error">
          Could not read the file to verify it.
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-label={`Choose downloaded file${fileName ? ` ${fileName}` : ''} to verify`}
        data-testid="checksum-file-input"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={current === 'checking'}
        className="text-[11px] text-indigo-400 hover:text-indigo-300 underline disabled:opacity-50"
        data-testid="checksum-verify-button"
      >
        {current === 'checking' ? 'Verifying…' : 'Verify File Integrity'}
      </button>
    </span>
  );
}

/** Badges for every attachment whose SHA-256 is recorded in the milestone's deliverable notes. */
export function DeliverableChecksums({ notes }: { notes?: string | null }) {
  const items = parseAttachmentChecksums(notes);
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1.5" data-testid="deliverable-checksums">
      {items.map((item) => (
        <li key={`${item.name}-${item.sha256}`} className="text-xs flex flex-wrap items-center gap-2">
          <span className="text-slate-500 font-medium truncate max-w-[12rem]" title={item.name}>
            {item.name}
          </span>
          <FileChecksumBadge hash={item.sha256} fileName={item.name} />
        </li>
      ))}
    </ul>
  );
}
