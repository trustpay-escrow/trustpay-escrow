'use client';

import { useState, useEffect, useRef } from 'react';

export interface UseTimelockOptions {
  submittedAt?: string | number | Date;
  autoReleaseAt?: string | number | Date;
  durationDays?: number; // Defaults to 14 days inactivity rule
  currentLedgerSequence?: number;
  timelockLedgerSequence?: number;
  secondsPerLedger?: number; // Default ~5s per Stellar ledger close
  milestoneId?: string;
  milestoneTitle?: string;
}

export type UrgencyLevel = 'green' | 'amber' | 'red';

export interface TimelockCountdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSecondsRemaining: number;
  formatted: string;
  isExpired: boolean;
  urgency: UrgencyLevel;
  progressPercent: number; // 0 to 100% of duration elapsed
}

/**
 * useTimelock:
 * Computes exact remaining time based on current ledger sequence and timelock timestamp.
 * Enforces 14-day inactivity auto-release rule after milestone submission.
 * Color-coded urgency rings:
 *  - Green > 7d
 *  - Amber < 3d
 *  - Red < 24h
 * Emits browser warning notification when countdown drops below 24h.
 */
export function useTimelock({
  submittedAt,
  autoReleaseAt,
  durationDays = 14,
  currentLedgerSequence,
  timelockLedgerSequence,
  secondsPerLedger = 5,
  milestoneId,
  milestoneTitle,
}: UseTimelockOptions): TimelockCountdown {
  const [now, setNow] = useState<number>(() => Date.now());
  const hasNotifiedRef = useRef<boolean>(false);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute total duration in seconds
  const totalDurationSeconds = durationDays * 24 * 3600;

  // Compute remaining seconds
  let remainingSeconds = 0;
  let deadlineMs = 0;

  if (timelockLedgerSequence !== undefined && currentLedgerSequence !== undefined) {
    const ledgerDiff = timelockLedgerSequence - currentLedgerSequence;
    remainingSeconds = Math.max(0, ledgerDiff * secondsPerLedger);
    deadlineMs = now + remainingSeconds * 1000;
  } else if (autoReleaseAt) {
    deadlineMs = new Date(autoReleaseAt).getTime();
    remainingSeconds = Math.max(0, Math.floor((deadlineMs - now) / 1000));
  } else if (submittedAt) {
    const startMs = new Date(submittedAt).getTime();
    deadlineMs = startMs + durationDays * 24 * 3600 * 1000;
    remainingSeconds = Math.max(0, Math.floor((deadlineMs - now) / 1000));
  } else {
    // Default fallback to 14 days from now if not submitted yet
    remainingSeconds = totalDurationSeconds;
    deadlineMs = now + totalDurationSeconds * 1000;
  }

  const isExpired = remainingSeconds <= 0;

  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = Math.floor(remainingSeconds % 60);

  // Urgency logic: Green > 7d, Amber < 3d, Red < 24h
  let urgency: UrgencyLevel = 'green';
  if (remainingSeconds < 24 * 3600) {
    urgency = 'red';
  } else if (remainingSeconds < 3 * 86400) {
    urgency = 'amber';
  } else if (remainingSeconds <= 7 * 86400) {
    urgency = 'amber';
  } else {
    urgency = 'green';
  }

  // Progress percentage (0% at start, 100% when expired)
  const elapsedSeconds = Math.max(0, totalDurationSeconds - remainingSeconds);
  const progressPercent = Math.min(100, Math.max(0, (elapsedSeconds / totalDurationSeconds) * 100));

  // Formatted string
  const formatted = `${String(days).padStart(2, '0')}d : ${String(hours).padStart(2, '0')}h : ${String(minutes).padStart(2, '0')}m : ${String(seconds).padStart(2, '0')}s`;

  // Emits browser warning notification when countdown drops below 24 hours
  useEffect(() => {
    if (urgency === 'red' && !isExpired && !hasNotifiedRef.current) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            new Notification('⚠️ TrustPay Inactivity Auto-Release Warning', {
              body: `Milestone "${milestoneTitle || milestoneId || 'Submitted Work'}" auto-releases in less than 24 hours! Funds will transfer automatically if no revision or approval is submitted.`,
              icon: '/favicon.ico',
            });
            hasNotifiedRef.current = true;
          } catch {
            // notification error ignored
          }
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted' && !hasNotifiedRef.current) {
              try {
                new Notification('⚠️ TrustPay Inactivity Auto-Release Warning', {
                  body: `Milestone "${milestoneTitle || milestoneId || 'Submitted Work'}" auto-releases in less than 24 hours!`,
                  icon: '/favicon.ico',
                });
                hasNotifiedRef.current = true;
              } catch {
                // notification error ignored
              }
            }
          });
        }
      }
    }
  }, [urgency, isExpired, milestoneId, milestoneTitle]);

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSecondsRemaining: remainingSeconds,
    formatted,
    isExpired,
    urgency,
    progressPercent,
  };
}
