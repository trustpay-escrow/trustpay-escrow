'use client';

import React, { useState, useEffect } from 'react';

export interface AddressBadgeProps {
  address: string;
  network?: 'testnet' | 'public';
  truncateStart?: number;
  truncateEnd?: number;
  showExplorerLink?: boolean;
  className?: string;
}

export function AddressBadge({
  address,
  network = 'testnet',
  truncateStart = 4,
  truncateEnd = 4,
  showExplorerLink = true,
  className = '',
}: AddressBadgeProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => {
      setCopied(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!address) return null;

  const truncated =
    address.length > truncateStart + truncateEnd
      ? `${address.slice(0, truncateStart)}...${address.slice(-truncateEnd)}`
      : address;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(address);
      }
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const explorerUrl = `https://stellar.expert/explorer/${network}/account/${address}`;

  return (
    <div
      data-testid="address-badge-container"
      className={`inline-flex items-center gap-1.5 relative ${className}`}
    >
      {/* Tooltip feedback when copied */}
      {copied && (
        <div
          role="status"
          data-testid="copy-tooltip"
          className="absolute -top-8 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded-lg shadow-lg shadow-emerald-900/50 whitespace-nowrap z-50 animate-in fade-in slide-in-from-bottom-1 duration-200 flex items-center gap-1"
        >
          <span>✓</span>
          <span>Copied to Clipboard!</span>
        </div>
      )}

      {/* Interactive Truncated Address Chip with Copy Action */}
      <button
        type="button"
        onClick={handleCopy}
        data-testid="address-copy-button"
        title="Click to copy full Stellar address"
        className="inline-flex items-center gap-1.5 bg-[#232326] hover:bg-[#2c2c31] active:scale-95 text-[#e4e4e7] hover:text-white px-2.5 py-1 rounded-xl border border-[#3f3f46] text-xs font-mono font-semibold transition-all cursor-pointer group"
      >
        <span>{truncated}</span>
        <span className="text-[#a1a1aa] group-hover:text-white transition-colors text-[11px]">
          {copied ? '✓' : '📋'}
        </span>
      </button>

      {/* Stellar Expert Explorer Link */}
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
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      )}
    </div>
  );
}

export default AddressBadge;
