import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  triggerCelebrationConfetti,
  isReducedMotionPreferred,
  STELLAR_CONFETTI_COLORS,
} from './confetti';
import confetti from 'canvas-confetti';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('confetti utility', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.matchMedia = originalMatchMedia;
  });

  describe('isReducedMotionPreferred', () => {
    it('returns false when window.matchMedia indicates no reduced motion preference', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(isReducedMotionPreferred()).toBe(false);
    });

    it('returns true when prefers-reduced-motion is active', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(isReducedMotionPreferred()).toBe(true);
    });
  });

  describe('triggerCelebrationConfetti', () => {
    it('skips firing particles and returns false when prefers-reduced-motion is enabled', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const triggered = triggerCelebrationConfetti();
      expect(triggered).toBe(false);
      expect(confetti).not.toHaveBeenCalled();
    });

    it('triggers initial burst with Stellar brand colors when reduced motion is not preferred', () => {
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const triggered = triggerCelebrationConfetti({ durationMs: 1000, particleCount: 60 });
      expect(triggered).toBe(true);
      expect(confetti).toHaveBeenCalledTimes(1);

      expect(confetti).toHaveBeenCalledWith(
        expect.objectContaining({
          colors: STELLAR_CONFETTI_COLORS,
          disableForReducedMotion: true,
          zIndex: 9999,
        })
      );
    });

    it('cleans up interval after timeout duration completes', () => {
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      triggerCelebrationConfetti({ durationMs: 600 });
      expect(confetti).toHaveBeenCalledTimes(1);

      // Advance by 250ms -> second burst
      vi.advanceTimersByTime(250);
      expect(confetti).toHaveBeenCalledTimes(2);

      // Advance by 250ms -> third burst (500ms elapsed)
      vi.advanceTimersByTime(250);
      expect(confetti).toHaveBeenCalledTimes(3);

      // Advance past 600ms -> should complete and clear interval
      vi.advanceTimersByTime(300);
      const callCountAfterExpiration = (confetti as any).mock.calls.length;

      // Further time progression should not trigger additional bursts
      vi.advanceTimersByTime(1000);
      expect((confetti as any).mock.calls.length).toBe(callCountAfterExpiration);
    });

    it('handles canvas errors gracefully and returns false', () => {
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      vi.mocked(confetti).mockImplementationOnce(() => {
        throw new Error('Canvas not supported');
      });

      const triggered = triggerCelebrationConfetti();
      expect(triggered).toBe(false);
    });
  });
});
