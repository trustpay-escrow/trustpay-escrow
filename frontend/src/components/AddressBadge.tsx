'use client';

import React, { useEffect, useRef, useState, type MouseEvent } from 'react';
import { soundSynthesizer } from '@/lib/sound-effects';

export interface AddressBadgeProps {
  address?: string;
  value?: string;
  label?: string;
  network?: 'testnet' | 'public';
  truncateStart?: number;
  truncateEnd?: number;
  showExplorerLink?: boolean;
  className?: string;
}

export function AddressBadge({
  address,
  value,
  label,
  network = 'testnet',
  truncateStart = 4,
  truncateEnd = 4,
  showExplorerLink = false,
  className = '',
}: AddressBadgeProps) {
  const targetValue = value ?? address ?? '';

  // Mode 1: Icon button with ripple, label, and sound effect (used when `label` is explicitly provided)
  const [ripple, setRipple] = useState<{ x: number; y: number; size: number; id: number }>();
  const [iconCopied, setIconCopied] = useState(false);
  const iconTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sequence = useRef(0);

  // Mode 2: Chip with truncated address, tooltip, and explorer link
  const [chipCopied, setChipCopied] = useState(false);
  const chipTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => {
    clearTimeout(iconTimeout.current);
    clearTimeout(chipTimeout.current);
    sequence.current += 1;
  }, []);

  const handleIconCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    const x = event.detail ? event.clientX - left : width / 2;
    const y = event.detail ? event.clientY - top : height / 2;
    const size = 2 * Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
    const id = ++sequence.current;

    try {
      await navigator.clipboard.writeText(targetValue);
    } catch {
      return;
    }
    if (id !== sequence.current) return;

    setIconCopied(true);
    setRipple({ x, y, size, id });
    soundSynthesizer.playCopyTick();
    clearTimeout(iconTimeout.current);
    iconTimeout.current = setTimeout(() => {
      setIconCopied(false);
      setRipple(undefined);
    }, 1500);
  };

  const handleChipCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(targetValue);
      }
      setChipCopied(true);
      clearTimeout(chipTimeout.current);
      chipTimeout.current = setTimeout(() => {
        setChipCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  if (label) {
    return (
      <button
        type="button"
        onClick={handleIconCopy}
        title={label}
        aria-label={label}
        className={`relative inline-flex h-7 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-800 text-slate-200 hover:bg-slate-700 ${className}`}
      >
        {ripple && (
          <span
            key={ripple.id}
            aria-hidden="true"
            className="copy-ripple"
            style={{ left: ripple.x, top: ripple.y, width: ripple.size, height: ripple.size }}
          />
        )}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`h-4 w-4 ${iconCopied ? 'text-emerald-400' : ''}`}
        >
          {iconCopied ? (
            <path d="m5 12 4 4L19 6" />
          ) : (
            <>
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
            </>
          )}
        </svg>
        <span role="status" className="sr-only">
          {iconCopied && 'Copied'}
        </span>
      </button>
    );
  }

  if (!targetValue) return null;

  const truncated =
    targetValue.length > truncateStart + truncateEnd
      ? `${targetValue.slice(0, truncateStart)}...${targetValue.slice(-truncateEnd)}`
      : targetValue;

  const explorerUrl = `https://stellar.expert/explorer/${network}/account/${targetValue}`;

  return (
    <div
      data-testid="address-badge-container"
      className={`inline-flex items-center gap-1.5 relative ${className}`}
    >
      {chipCopied && (
        <div
          role="status"
          data-testid="copy-tooltip"
          className="absolute -top-8 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded-lg shadow-lg shadow-emerald-900/50 whitespace-nowrap z-50 animate-in fade-in slide-in-from-bottom-1 duration-200 flex items-center gap-1"
        >
          <span>✓</span>
          <span>Copied to Clipboard!</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleChipCopy}
        data-testid="address-copy-button"
        title="Click to copy full Stellar address"
        className="inline-flex items-center gap-1.5 bg-[#232326] hover:bg-[#2c2c31] active:scale-95 text-[#e4e4e7] hover:text-white px-2.5 py-1 rounded-xl border border-[#3f3f46] text-xs font-mono font-semibold transition-all cursor-pointer group"
      >
        <span>{truncated}</span>
        <span className="text-[#a1a1aa] group-hover:text-white transition-colors text-[11px]">
          {chipCopied ? '✓' : '📋'}
        </span>
      </button>

      {showExplorerLink && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="stellar-expert-link"
          title="View account on Stellar Expert"
          className="p-1 rounded-lg bg-[#232326] hover:bg-[#2c2c31] text-[#a1a1aa] hover:text-blue-400 border border-[#3f3f46] transition-colors inline-flex items-center justify-center text-xs"
        >
          <svg
            className="w-3.5 h-3.5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      )}
    </div>
  );
}

export default AddressBadge;
