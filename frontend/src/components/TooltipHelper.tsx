'use client';

import React, { useState, useRef, useEffect, useId } from 'react';

export interface BlockchainTermInfo {
  title: string;
  explanation: string;
  docsUrl?: string;
}

export const BLOCKCHAIN_TERMS: Record<string, BlockchainTermInfo> = {
  'soroban-ttl': {
    title: 'Soroban TTL',
    explanation: 'Time-To-Live storage lifecycle. Smart contract state entries remain active until their TTL expires, after which rent restoration is required.',
    docsUrl: 'https://developers.stellar.org/docs/learn/encyclopedia/storage/state-archival',
  },
  'sac-tokens': {
    title: 'SAC Tokens',
    explanation: 'Stellar Asset Contracts wrapping classic Stellar assets (such as USDC and EURC) to seamlessly interact with Soroban smart contract logic.',
    docsUrl: 'https://developers.stellar.org/docs/tokens/stellar-asset-contract',
  },
  'timelock-release': {
    title: 'Timelock Auto-Release',
    explanation: 'A fail-safe mechanism ensuring freelancer funds are unlocked automatically if client review stays unresponsive beyond the preset timelock window.',
    docsUrl: 'https://developers.stellar.org',
  },
  'arbitration-split': {
    title: 'Arbitration Split',
    explanation: 'A dispute resolution process where designated third-party arbiters review deliverables and allocate escrowed funds fairly between client and freelancer.',
    docsUrl: 'https://developers.stellar.org',
  },
  'blend-yield': {
    title: 'Blend Yield',
    explanation: 'Automated yield generation on locked stablecoin deposits via Blend lending pools during project execution.',
    docsUrl: 'https://blend.capital',
  },
};

export interface TooltipHelperProps {
  termKey?: keyof typeof BLOCKCHAIN_TERMS | string;
  title?: string;
  explanation?: string;
  docsUrl?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function TooltipHelper({
  termKey,
  title: customTitle,
  explanation: customExplanation,
  docsUrl: customDocsUrl,
  position = 'top',
  className = '',
}: TooltipHelperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId();

  const predefined = termKey && BLOCKCHAIN_TERMS[termKey] ? BLOCKCHAIN_TERMS[termKey] : null;
  const title = customTitle ?? predefined?.title;
  const explanation = customExplanation ?? predefined?.explanation ?? '';
  const docsUrl = customDocsUrl ?? predefined?.docsUrl;

  // Handle outside click dismissal
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Position classes
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position];

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center ml-1 text-zinc-400 align-middle ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-label={title ? `Learn more about ${title}` : 'Explain technical blockchain term'}
        className="w-4 h-4 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 inline-flex items-center justify-center text-[10px] font-bold transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500"
        data-testid="tooltip-helper-trigger"
      >
        ?
      </button>

      {isOpen && (
        <div
          id={tooltipId}
          role="tooltip"
          data-testid="tooltip-helper-popover"
          className={`absolute z-50 w-64 p-3 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl text-xs text-zinc-200 pointer-events-auto transition-opacity duration-150 animate-in fade-in-0 zoom-in-95 ${positionClasses}`}
        >
          {title && <div className="font-semibold text-white mb-1">{title}</div>}
          <p className="text-zinc-300 leading-relaxed">{explanation}</p>
          {docsUrl && (
            <div className="mt-2 pt-2 border-t border-zinc-800 flex justify-end">
              <a
                href={docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 hover:underline inline-flex items-center gap-1"
                data-testid="tooltip-helper-docs-link"
              >
                Learn more
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
