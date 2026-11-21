'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CryptoId, CryptoIdSize } from '@/components/ui/CryptoId';
import { soundSynthesizer } from '@/lib/sound-effects';

export interface AddressBadgeProps {
  /** The full address, contract ID or transaction hash */
  value: string;
  /** Starting characters to display if truncating */
  head?: number;
  /** Ending characters to display if truncating */
  tail?: number;
  /** Size variant ('xs' | 'sm') */
  size?: CryptoIdSize;
  /** Whether to play subtle audio tick feedback on copy (defaults to true) */
  enableAudio?: boolean;
  /** Optional container class name */
  className?: string;
  /** Optional crypto typography class name */
  cryptoClassName?: string;
  /** Optional custom title tooltip */
  title?: string;
  /** Callback fired after copy action */
  onCopy?: (value: string) => void;
  /** Optional prefix node */
  prefix?: React.ReactNode;
}

interface RipplePoint {
  id: number;
  x: number;
  y: number;
}

export function AddressBadge({
  value,
  head,
  tail,
  size = 'xs',
  enableAudio = true,
  className = '',
  cryptoClassName = '',
  title,
  onCopy,
  prefix,
}: AddressBadgeProps) {
  const [copied, setCopied] = useState(false);
  const [ripples, setRipples] = useState<RipplePoint[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // 1. Calculate click coordinates relative to button for expanding circular ripple
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRipple: RipplePoint = { id: Date.now() + Math.random(), x, y };

    setRipples((prev) => [...prev, newRipple]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);

    // 2. Play subtle soft audio tick tone if audio feedback is enabled
    if (enableAudio) {
      try {
        soundSynthesizer.playTick();
      } catch (err) {
        console.debug('Failed to play copy audio tick:', err);
      }
    }

    // 3. Copy to clipboard
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      }
    } catch (err) {
      console.debug('Failed to write to clipboard:', err);
    }

    // 4. Transition copy icon to green checkmark for 1.5 seconds
    setCopied(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setCopied(false);
    }, 1500);

    onCopy?.(value);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={title || (copied ? 'Copied to clipboard!' : `Click to copy: ${value}`)}
      aria-label={copied ? 'Address copied to clipboard' : `Copy address ${value}`}
      className={`group relative inline-flex items-center gap-1.5 overflow-hidden rounded-lg border px-2.5 py-1 text-xs transition-colors duration-150 select-none ${
        copied
          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
          : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 hover:bg-zinc-800/90 text-zinc-300'
      } ${className}`.trim()}
    >
      {/* Ripple wave animations expanding from click origin */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          data-testid="ripple-wave"
          className="animate-ripple ripple pointer-events-none absolute w-24 h-24 rounded-full bg-blue-500/30"
          style={{
            left: `${ripple.x}px`,
            top: `${ripple.y}px`,
          }}
        />
      ))}

      {prefix}

      <CryptoId value={value} head={head} tail={tail} size={size} className={cryptoClassName} />

      {/* Copy / Checkmark Icon */}
      <span className="relative z-10 inline-flex items-center ml-0.5" aria-hidden="true">
        {copied ? (
          <svg
            data-testid="checkmark-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-3.5 h-3.5 text-emerald-400"
          >
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            data-testid="copy-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-colors"
          >
            <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12a1.5 1.5 0 0 1 .439 1.061V16.5A1.5 1.5 0 0 1 15.5 18h-7A1.5 1.5 0 0 1 7 16.5v-13Z" />
            <path d="M5.5 5A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19h7a1.5 1.5 0 0 0 1.5-1.5V17H6.5A1.5 1.5 0 0 1 5 15.5V5h.5Z" />
          </svg>
        )}
      </span>
    </button>
  );
}
