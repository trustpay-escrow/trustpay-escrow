'use client';

import React, { useEffect, useState, useRef } from 'react';
import { CryptoId } from '@/components/ui/CryptoId';
import { triggerCelebrationConfetti } from '@/lib/confetti';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { announcePolite } from '@/components/a11y/LiveAnnouncer';

export interface SuccessCheckmarkProps {
  isOpen: boolean;
  onClose: () => void;
  amount?: string | number;
  tokenSymbol?: string;
  milestoneTitle?: string;
  milestoneIndex?: number;
  recipientAddress?: string;
  txHash?: string;
  playSound?: boolean;
  autoDismissDelay?: number; // ms, default 3000. Set 0 to disable.
}

export function SuccessCheckmark({
  isOpen,
  onClose,
  amount,
  tokenSymbol = 'USDC',
  milestoneTitle,
  milestoneIndex,
  recipientAddress,
  txHash,
  playSound = true,
  autoDismissDelay = 3000,
}: SuccessCheckmarkProps) {
  const [animationStarted, setAnimationStarted] = useState(false);
  const audioPlayedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(dialogRef, {
    isOpen,
    onClose,
  });

  // Optional celebratory audio chime using Web Audio API
  const playCelebrationChime = () => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Note 1: E5 (659.25Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2: B5 (987.77Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.12);
      gain2.gain.setValueAtTime(0.15, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.55);
    } catch {
      // Audio playback fails gracefully if blocked by browser autoplay policy
    }
  };

  useEffect(() => {
    if (isOpen) {
      setAnimationStarted(true);
      announcePolite(
        typeof milestoneIndex === 'number'
          ? `Milestone ${milestoneIndex + 1} completed and funds released.`
          : 'Milestone completed and funds released.'
      );

      if (playSound && !audioPlayedRef.current) {
        audioPlayedRef.current = true;
        playCelebrationChime();
        triggerCelebrationConfetti();
      }

      let timer: NodeJS.Timeout | null = null;
      if (autoDismissDelay > 0) {
        timer = setTimeout(() => {
          onClose();
        }, autoDismissDelay);
      }

      return () => {
        if (timer) clearTimeout(timer);
      };
    } else {
      setAnimationStarted(false);
      audioPlayedRef.current = false;
    }
  }, [isOpen, onClose, autoDismissDelay, playSound, milestoneIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-dialog-title"
        aria-describedby="success-dialog-desc"
        tabIndex={-1}
        className="relative w-full max-w-md p-6 overflow-hidden text-center bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl shadow-emerald-500/10 focus:outline-none"
      >
        {/* Background glow celebration accent */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Animated SVG Checkmark Icon */}
        <div className="flex items-center justify-center my-4">
          <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30">
            <svg
              data-testid="checkmark-svg"
              className={`w-12 h-12 text-emerald-400 transition-all duration-700 ease-out ${
                animationStarted ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
              }`}
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle
                cx="24"
                cy="24"
                r="22"
                stroke="currentColor"
                strokeWidth="3"
                className="stroke-emerald-500/40"
              />
              <path
                data-testid="checkmark-path"
                d="M14 24.5L21 31.5L34 16.5"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 40,
                  strokeDashoffset: animationStarted ? 0 : 40,
                  transition: 'stroke-dashoffset 0.6s cubic-bezier(0.65, 0, 0.45, 1) 0.15s',
                }}
              />
            </svg>
          </div>
        </div>

        {/* Modal Titles & Celebration Micro-copy */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span>🎉</span>
            <span>Milestone Approved & Released</span>
          </span>

          <h2 id="success-dialog-title" className="text-xl font-bold tracking-tight text-white">
            {typeof milestoneIndex === 'number'
              ? `Milestone #${milestoneIndex + 1} Completed!`
              : 'Milestone Completed!'}
          </h2>

          <p id="success-dialog-desc" className="text-xs text-slate-400">
            Funds have been unlocked and transferred successfully on the Stellar blockchain.
          </p>
        </div>

        {/* Released Amount & Details Card */}
        {(amount !== undefined || milestoneTitle || recipientAddress || txHash) && (
          <div className="mt-5 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-left space-y-2">
            {milestoneTitle && (
              <div className="text-xs text-slate-300 font-medium truncate">
                <span className="text-slate-500 mr-1.5">Milestone:</span>
                {milestoneTitle}
              </div>
            )}

            {amount !== undefined && (
              <div className="flex items-baseline justify-between pt-1 border-t border-slate-800/60">
                <span className="text-xs text-slate-400">Amount Released:</span>
                <span className="text-base font-extrabold text-emerald-400 font-mono">
                  {amount} {tokenSymbol}
                </span>
              </div>
            )}

            {recipientAddress && (
              <div className="flex items-baseline justify-between pt-1 border-t border-slate-800/60 text-xs">
                <span className="text-slate-400">Counterparty:</span>
                <CryptoId
                  value={recipientAddress}
                  head={6}
                  tail={6}
                  title={recipientAddress}
                  className="text-slate-300"
                />
              </div>
            )}

            {txHash && (
              <div className="text-xs text-slate-500 truncate pt-1">
                <span className="text-slate-600 mr-1">Tx:</span>
                <CryptoId value={txHash} className="text-indigo-400" />
              </div>
            )}
          </div>
        )}

        {/* Action Button & Auto-dismiss prompt */}
        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
          >
            Done
          </button>

          {autoDismissDelay > 0 && (
            <p className="text-[11px] text-slate-500">
              Auto-dismissing in {Math.round(autoDismissDelay / 1000)} seconds...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default SuccessCheckmark;
