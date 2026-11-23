'use client';

import React, { useEffect, useState } from 'react';

export interface NumberRollProps {
  value: number;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

/**
 * Standard easeOutQuad easing function: f(t) = t * (2 - t)
 * Accelerates quickly and smoothly decelerates toward target
 */
export function easeOutQuad(t: number): number {
  return t * (2 - t);
}

/**
 * Interpolates smoothly from 0 to target value using easeOutQuad easing
 */
export function interpolateValue(progress: number, target: number): number {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  return easeOutQuad(clampedProgress) * target;
}

/**
 * Formats a number with comma separators and specified decimal places
 */
export function formatRollingNumber(val: number, decimals: number = 0): string {
  return val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export const NumberRoll: React.FC<NumberRollProps> = ({
  value,
  durationMs = 800,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}) => {
  const [currentVal, setCurrentVal] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if (prefersReduced) return value;
    }
    return 0;
  });

  useEffect(() => {
    // Check if user prefers reduced motion
    if (typeof window !== 'undefined') {
      const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if (prefersReduced) {
        setCurrentVal(value);
        return;
      }
    }

    let animationFrameId: number;
    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const nextVal = interpolateValue(progress, value);

      setCurrentVal(nextVal);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setCurrentVal(value);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [value, durationMs]);

  return (
    <span
      className={`inline-block tabular-nums font-mono ${className}`}
      data-testid="number-roll"
      aria-label={`${prefix}${formatRollingNumber(value, decimals)}${suffix}`}
    >
      {prefix}
      {formatRollingNumber(currentVal, decimals)}
      {suffix}
    </span>
  );
};

export default NumberRoll;
