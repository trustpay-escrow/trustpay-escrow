import confetti from 'canvas-confetti';

export const STELLAR_CONFETTI_COLORS = [
  '#3b82f6', // Stellar Blue
  '#10b981', // Emerald Green
  '#6366f1', // Indigo
  '#f59e0b', // Gold
];

export interface ConfettiBurstOptions {
  durationMs?: number;
  particleCount?: number;
  spread?: number;
  colors?: string[];
  origin?: { x: number; y: number };
}

/**
 * Checks if user prefers reduced motion
 */
export function isReducedMotionPreferred(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

/**
 * Fires celebratory confetti particle burst on key escrow milestones
 * Renders on a temporary overlay canvas, respects prefers-reduced-motion, and auto-cleans
 */
export function triggerCelebrationConfetti(options: ConfettiBurstOptions = {}): boolean {
  if (isReducedMotionPreferred()) {
    return false;
  }

  const {
    durationMs = 2000,
    particleCount = 50,
    spread = 70,
    colors = STELLAR_CONFETTI_COLORS,
    origin = { x: 0.5, y: 0.6 },
  } = options;

  try {
    const end = Date.now() + durationMs;

    // Fire initial celebratory burst
    confetti({
      particleCount: particleCount * 1.5,
      spread,
      origin,
      colors,
      disableForReducedMotion: true,
      zIndex: 9999,
    });

    // Continuous decay burst over the duration
    const interval: ReturnType<typeof setInterval> = setInterval(() => {
      const timeLeft = end - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      confetti({
        particleCount: Math.floor(particleCount / 2),
        spread: spread * 1.2,
        origin: {
          x: origin.x + (Math.random() - 0.5) * 0.2,
          y: origin.y + (Math.random() - 0.5) * 0.2,
        },
        colors,
        disableForReducedMotion: true,
        zIndex: 9999,
      });
    }, 250);

    return true;
  } catch (err) {
    // Graceful fallback if canvas is unsupported
    return false;
  }
}

export const celebrateEscrow = (options?: ConfettiBurstOptions) => triggerCelebrationConfetti(options);

