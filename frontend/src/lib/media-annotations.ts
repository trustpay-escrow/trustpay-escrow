export interface TimestampComment {
  id: string;
  /** Position in the media, in seconds. */
  time: number;
  text: string;
  author?: string;
  createdAt?: string;
  resolved?: boolean;
}

/** Formats seconds as m:ss, or h:mm:ss for media over an hour. */
export function formatTimestamp(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Parses "1:23", "01:23:45" or plain seconds. Returns null when it isn't a valid time. */
export function parseTimestamp(input: string): number | null {
  const value = input.trim();
  if (!value) return null;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  const parts = value.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  const seconds = nums[nums.length - 1];
  const minutes = nums[nums.length - 2];
  const hours = nums.length === 3 ? nums[0] : 0;
  if (seconds > 59 || (nums.length === 3 && minutes > 59)) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

export function clampTime(time: number, duration: number): number {
  if (!Number.isFinite(time) || time < 0) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return time;
  return Math.min(time, duration);
}

/** Left offset (0-100) of a comment pin along the timeline. */
export function pinPositionPercent(time: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(100, Math.max(0, (time / duration) * 100));
}

export function sortComments(comments: TimestampComment[]): TimestampComment[] {
  return [...comments].sort((a, b) => a.time - b.time || (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
}

/** Maps a pointer x-offset inside a bounding box to a playback time. */
export function timeFromPointer(clientX: number, left: number, width: number, duration: number): number {
  if (width <= 0 || duration <= 0) return 0;
  return Math.min(duration, Math.max(0, ((clientX - left) / width) * duration));
}

/** Reduces decoded PCM channel data to `bars` normalised peak values in [0.05, 1]. */
export function computePeaks(samples: Float32Array, bars: number): number[] {
  if (bars <= 0) return [];
  if (samples.length === 0) return new Array(bars).fill(0.05);
  const block = Math.max(1, Math.floor(samples.length / bars));
  const peaks: number[] = [];
  for (let i = 0; i < bars; i++) {
    let peak = 0;
    const start = i * block;
    const end = Math.min(samples.length, start + block);
    for (let j = start; j < end; j++) peak = Math.max(peak, Math.abs(samples[j]));
    peaks.push(peak);
  }
  const max = Math.max(...peaks, 0.0001);
  return peaks.map((p) => Math.max(0.05, p / max));
}

/** Deterministic placeholder waveform used when the media can't be decoded (CORS, video codecs, etc.). */
export function fallbackPeaks(seed: string, bars: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) + i;
    const r = ((h >>> 0) % 1000) / 1000;
    out.push(0.15 + 0.85 * Math.abs(Math.sin(i / 5 + r * 2)) * (0.4 + 0.6 * r));
  }
  return out;
}

export async function decodeWaveform(src: string, bars: number, signal?: AbortSignal): Promise<number[]> {
  const Ctx: typeof AudioContext | undefined =
    typeof window !== 'undefined'
      ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!Ctx) return fallbackPeaks(src, bars);
  try {
    const res = await fetch(src, { signal });
    if (!res.ok) return fallbackPeaks(src, bars);
    const ctx = new Ctx();
    try {
      const audio = await ctx.decodeAudioData(await res.arrayBuffer());
      return computePeaks(audio.getChannelData(0), bars);
    } finally {
      void ctx.close?.();
    }
  } catch {
    return fallbackPeaks(src, bars);
  }
}
