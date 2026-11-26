'use client';

import React, { useState, useRef } from 'react';
import {
  truncateHash,
  verifyFileChecksum,
  calculateFileChecksum,
  parseAttachmentChecksums,
} from '../lib/checksum';

export interface FileChecksumBadgeProps {
  hash: string;
  fileName?: string;
  showVerifier?: boolean;
  className?: string;
}

export function FileChecksumBadge({
  hash,
  fileName,
  showVerifier = true,
  className = '',
}: FileChecksumBadgeProps) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    status: 'match' | 'mismatch' | 'error';
    actualHash?: string;
    message?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanHash = hash ? hash.replace(/^sha256:/i, '').trim().toLowerCase() : '';
  const displayHash = truncateHash(cleanHash);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cleanHash) return;
    try {
      await navigator.clipboard.writeText(cleanHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVerifying(true);
    setVerificationResult(null);

    try {
      const actualHash = await calculateFileChecksum(file);
      const isMatch = await verifyFileChecksum(file, cleanHash);
      if (isMatch) {
        setVerificationResult({
          status: 'match',
          actualHash,
          message: 'Checksum matches! File is authentic and unaltered.',
        });
      } else {
        setVerificationResult({
          status: 'mismatch',
          actualHash,
          message: 'Security warning: Checksum mismatch! File has been altered or corrupted.',
        });
      }
    } catch (err: unknown) {
      setVerificationResult({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to read file.',
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className={`inline-flex flex-col gap-1.5 ${className}`} data-testid="file-checksum-badge-container">
      <div className="inline-flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-2.5 py-1 rounded-md text-xs font-mono border border-neutral-200 dark:border-neutral-700">
        <span className="font-semibold text-neutral-500 dark:text-neutral-400 select-none">
          sha256:
        </span>
        <span className="select-all" title={cleanHash} data-testid="checksum-hash-text">
          {cleanHash.slice(0, 6)}...{cleanHash.slice(-6)}
        </span>

        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-100"
          title="Copy full SHA-256 hash"
          aria-label="Copy SHA-256 hash"
        >
          {copied ? (
            <svg
              className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              data-testid="copy-success-icon"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              data-testid="copy-icon"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          )}
        </button>

        {/* Verify Integrity Tool Trigger */}
        {showVerifier && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="ml-1 text-[11px] font-sans font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            aria-expanded={isOpen}
            data-testid="verify-integrity-toggle"
          >
            <span>Verify</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Verification Tool In-Place Drawer / Popover */}
      {showVerifier && isOpen && (
        <div
          className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm text-xs font-sans mt-1 max-w-sm"
          data-testid="verification-panel"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
              Verify Deliverable Integrity
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              aria-label="Close verification panel"
            >
              ×
            </button>
          </div>

          <p className="text-neutral-600 dark:text-neutral-400 mb-2.5">
            Select the downloaded {fileName ? <strong>{fileName}</strong> : 'file'} to check if its cryptographic hash matches the original on-chain commitment.
          </p>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            data-testid="checksum-file-input"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={verifying}
            className="w-full py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded font-medium flex items-center justify-center gap-1.5 transition-colors"
            data-testid="upload-verify-button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>{verifying ? 'Computing Hash...' : 'Select File to Verify'}</span>
          </button>

          {/* Verification Status Result */}
          {verificationResult && (
            <div
              className={`mt-2.5 p-2 rounded border flex items-start gap-2 ${
                verificationResult.status === 'match'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}
              data-testid="verification-result-box"
            >
              {verificationResult.status === 'match' ? (
                <svg
                  className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  data-testid="match-success-icon"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  data-testid="mismatch-alert-icon"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              <div className="flex-1 text-[11px] leading-relaxed">
                <div className="font-semibold">{verificationResult.message}</div>
                {verificationResult.actualHash && (
                  <div className="font-mono text-[10px] mt-1 opacity-80 break-all select-all">
                    Computed: {verificationResult.actualHash}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Renders checksum badges for every SHA-256 attachment recorded in milestone deliverable notes. */
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
