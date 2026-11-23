import { describe, it, expect } from 'vitest';
import {
  clampTime,
  computePeaks,
  fallbackPeaks,
  formatTimestamp,
  parseTimestamp,
  pinPositionPercent,
  sortComments,
  timeFromPointer,
} from './media-annotations';

describe('media-annotations', () => {
  it('formats timestamps', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(83.9)).toBe('1:23');
    expect(formatTimestamp(3725)).toBe('1:02:05');
    expect(formatTimestamp(NaN)).toBe('0:00');
  });

  it('parses timestamps', () => {
    expect(parseTimestamp('1:23')).toBe(83);
    expect(parseTimestamp('01:02:05')).toBe(3725);
    expect(parseTimestamp('42')).toBe(42);
    expect(parseTimestamp('1:75')).toBeNull();
    expect(parseTimestamp('abc')).toBeNull();
    expect(parseTimestamp('')).toBeNull();
  });

  it('clamps and positions', () => {
    expect(clampTime(-5, 100)).toBe(0);
    expect(clampTime(150, 100)).toBe(100);
    expect(pinPositionPercent(25, 100)).toBe(25);
    expect(pinPositionPercent(25, 0)).toBe(0);
    expect(timeFromPointer(150, 100, 200, 60)).toBe(15);
    expect(timeFromPointer(0, 100, 200, 60)).toBe(0);
  });

  it('sorts comments by time without mutating input', () => {
    const input = [
      { id: 'b', time: 30, text: 'b' },
      { id: 'a', time: 5, text: 'a' },
    ];
    expect(sortComments(input).map((c) => c.id)).toEqual(['a', 'b']);
    expect(input[0].id).toBe('b');
  });

  it('computes normalised peaks', () => {
    const samples = new Float32Array([0, 0.5, -1, 0.25]);
    const peaks = computePeaks(samples, 2);
    expect(peaks).toHaveLength(2);
    expect(Math.max(...peaks)).toBe(1);
    expect(computePeaks(new Float32Array(0), 3)).toEqual([0.05, 0.05, 0.05]);
  });

  it('generates a stable fallback waveform', () => {
    expect(fallbackPeaks('a.mp4', 10)).toEqual(fallbackPeaks('a.mp4', 10));
    expect(fallbackPeaks('a.mp4', 10)).not.toEqual(fallbackPeaks('b.mp4', 10));
    expect(fallbackPeaks('a.mp4', 10).every((p) => p > 0 && p <= 1)).toBe(true);
  });
});
