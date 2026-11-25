/**
 * Frontend performance telemetry: Core Web Vitals, RPC round-trip probes,
 * an overall health rating and a plain-text diagnostic report.
 *
 * Everything here is framework-free so it can be unit tested without a DOM.
 * Browser-only collection (`observeWebVitals`) guards on `PerformanceObserver`
 * so importing this module during SSR is safe.
 */

export type Rating = 'good' | 'needs-improvement' | 'poor';
export type OverallRating = Rating | 'pending';
export type VitalName = 'LCP' | 'FID' | 'CLS';

/** Google's published thresholds: [good upper bound, poor lower bound]. */
export const VITAL_THRESHOLDS: Record<VitalName, { good: number; poor: number; unit: 'ms' | '' }> = {
  LCP: { good: 2500, poor: 4000, unit: 'ms' },
  FID: { good: 100, poor: 300, unit: 'ms' },
  CLS: { good: 0.1, poor: 0.25, unit: '' },
};

/** Round-trip latency thresholds for RPC/Horizon probes, in milliseconds. */
export const LATENCY_THRESHOLDS = { good: 300, poor: 1000 } as const;

export type WebVitals = Record<VitalName, number | null>;

export interface LatencySample {
  /** Round-trip time in ms, or null when the probe failed. */
  ms: number | null;
  ok: boolean;
  at: number;
  error?: string;
}

export interface EndpointProbe {
  id: 'horizon' | 'soroban';
  label: string;
  url: string;
  samples: LatencySample[];
}

export interface EndpointStats {
  last: number | null;
  min: number | null;
  avg: number | null;
  max: number | null;
  failures: number;
  total: number;
  rating: Rating | 'pending';
}

export function rateVital(name: VitalName, value: number): Rating {
  const t = VITAL_THRESHOLDS[name];
  if (value <= t.good) return 'good';
  if (value > t.poor) return 'poor';
  return 'needs-improvement';
}

export function rateLatency(ms: number | null): Rating {
  if (ms === null) return 'poor';
  if (ms <= LATENCY_THRESHOLDS.good) return 'good';
  if (ms > LATENCY_THRESHOLDS.poor) return 'poor';
  return 'needs-improvement';
}

export function formatVital(name: VitalName, value: number | null): string {
  if (value === null) return 'measuring…';
  if (name === 'CLS') return value.toFixed(3);
  return `${Math.round(value)} ms`;
}

/** Summarise a probe's samples. Failed probes count against the rating. */
export function summarizeSamples(samples: LatencySample[]): EndpointStats {
  const total = samples.length;
  const okMs = samples.filter((s) => s.ok && s.ms !== null).map((s) => s.ms as number);
  const failures = total - okMs.length;
  if (total === 0) {
    return { last: null, min: null, avg: null, max: null, failures: 0, total: 0, rating: 'pending' };
  }
  const last = samples[total - 1];
  const avg = okMs.length ? okMs.reduce((a, b) => a + b, 0) / okMs.length : null;
  return {
    last: last.ok ? last.ms : null,
    min: okMs.length ? Math.min(...okMs) : null,
    avg,
    max: okMs.length ? Math.max(...okMs) : null,
    failures,
    total,
    // Rate on the average; an endpoint that has never answered is poor.
    rating: rateLatency(avg),
  };
}

const POINTS: Record<Rating, number> = { good: 100, 'needs-improvement': 50, poor: 0 };

export interface OverallScore {
  rating: OverallRating;
  /** 0-100, or null while nothing has been measured yet. */
  score: number | null;
}

/**
 * Overall rating: the mean of every measured signal (good=100,
 * needs-improvement=50, poor=0). >=80 is Good, >=50 Needs Improvement,
 * otherwise Poor. Unmeasured vitals are excluded so a fresh page load is
 * "pending" rather than unfairly "poor".
 */
export function computeOverallScore(vitals: WebVitals, probes: EndpointProbe[]): OverallScore {
  const ratings: Rating[] = [];
  (Object.keys(vitals) as VitalName[]).forEach((name) => {
    const v = vitals[name];
    if (v !== null) ratings.push(rateVital(name, v));
  });
  probes.forEach((p) => {
    const stats = summarizeSamples(p.samples);
    if (stats.rating !== 'pending') ratings.push(stats.rating);
  });
  if (ratings.length === 0) return { rating: 'pending', score: null };
  const score = Math.round(ratings.reduce((sum, r) => sum + POINTS[r], 0) / ratings.length);
  const rating: Rating = score >= 80 ? 'good' : score >= 50 ? 'needs-improvement' : 'poor';
  return { rating, score };
}

export const RATING_LABEL: Record<OverallRating, string> = {
  good: 'Good',
  'needs-improvement': 'Needs Improvement',
  poor: 'Poor',
  pending: 'Measuring',
};

type FetchLike = (input: string, init?: RequestInit) => Promise<{ ok: boolean; status: number }>;

export interface ProbeOptions {
  fetchImpl?: FetchLike;
  now?: () => number;
  timeoutMs?: number;
  /** Wall-clock timestamp recorded on the sample. */
  clock?: () => number;
}

/**
 * Time one request. Soroban RPC is JSON-RPC (POST `getHealth`); Horizon is a
 * plain GET on its root document. Never throws: failures become a sample with
 * `ok: false` so a dead endpoint shows up in the graph instead of crashing it.
 */
export async function probeEndpoint(
  id: EndpointProbe['id'],
  url: string,
  opts: ProbeOptions = {}
): Promise<LatencySample> {
  const fetchImpl = opts.fetchImpl ?? ((i, init) => fetch(i, init));
  const now = opts.now ?? (() => performance.now());
  const clock = opts.clock ?? (() => Date.now());
  const timeoutMs = opts.timeoutMs ?? 8000;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
  const init: RequestInit =
    id === 'soroban'
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
          cache: 'no-store',
          signal: controller?.signal,
        }
      : { method: 'GET', cache: 'no-store', signal: controller?.signal };

  const started = now();
  try {
    const res = await fetchImpl(url, init);
    const ms = Math.max(0, now() - started);
    if (!res.ok) return { ms: null, ok: false, at: clock(), error: `HTTP ${res.status}` };
    return { ms, ok: true, at: clock() };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ms: null,
      ok: false,
      at: clock(),
      error: aborted ? `timeout after ${timeoutMs} ms` : err instanceof Error ? err.message : 'network error',
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Append a sample, keeping only the most recent `max` entries. */
export function pushSample(samples: LatencySample[], sample: LatencySample, max = 20): LatencySample[] {
  return [...samples, sample].slice(-max);
}

/**
 * Subscribe to LCP, FID and CLS via PerformanceObserver. Returns an
 * unsubscribe function. Unsupported entry types are skipped silently, since
 * Safari/Firefox ship different subsets.
 */
export function observeWebVitals(onUpdate: (vitals: WebVitals) => void): () => void {
  const vitals: WebVitals = { LCP: null, FID: null, CLS: null };
  if (typeof PerformanceObserver === 'undefined') return () => undefined;
  const observers: PerformanceObserver[] = [];
  let cls = 0;

  const watch = (type: string, handle: (entry: PerformanceEntry) => void) => {
    try {
      const po = new PerformanceObserver((list) => {
        list.getEntries().forEach(handle);
        onUpdate({ ...vitals });
      });
      po.observe({ type, buffered: true } as PerformanceObserverInit);
      observers.push(po);
    } catch {
      /* entry type unsupported in this browser */
    }
  };

  watch('largest-contentful-paint', (e) => {
    vitals.LCP = e.startTime;
  });
  watch('first-input', (e) => {
    const fi = e as PerformanceEventTiming;
    vitals.FID = fi.processingStart - fi.startTime;
  });
  watch('layout-shift', (e) => {
    const ls = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
    if (!ls.hadRecentInput) {
      cls += ls.value;
      vitals.CLS = cls;
    }
  });

  return () => observers.forEach((o) => o.disconnect());
}

export interface DiagnosticSnapshot {
  vitals: WebVitals;
  probes: EndpointProbe[];
  generatedAt: string;
  userAgent?: string;
  pageUrl?: string;
  connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
  online?: boolean;
}

/** Plain-text report the user can paste into a support ticket. */
export function buildDiagnosticReport(snap: DiagnosticSnapshot): string {
  const overall = computeOverallScore(snap.vitals, snap.probes);
  const lines: string[] = [
    'TrustPay Escrow: System Diagnostic Report',
    `Generated: ${snap.generatedAt}`,
    `Overall: ${RATING_LABEL[overall.rating]}${overall.score === null ? '' : ` (${overall.score}/100)`}`,
    '',
    'Core Web Vitals',
  ];
  (Object.keys(VITAL_THRESHOLDS) as VitalName[]).forEach((name) => {
    const v = snap.vitals[name];
    const rating = v === null ? 'not yet measured' : RATING_LABEL[rateVital(name, v)];
    lines.push(`  ${name}: ${formatVital(name, v)} [${rating}]`);
  });

  lines.push('', 'Network probes');
  snap.probes.forEach((p) => {
    const s = summarizeSamples(p.samples);
    const fmt = (n: number | null) => (n === null ? 'n/a' : `${Math.round(n)} ms`);
    lines.push(
      `  ${p.label} (${p.url})`,
      `    last ${fmt(s.last)}, avg ${fmt(s.avg)}, min ${fmt(s.min)}, max ${fmt(s.max)}, failures ${s.failures}/${s.total}`
    );
    const lastError = [...p.samples].reverse().find((x) => x.error)?.error;
    if (lastError) lines.push(`    last error: ${lastError}`);
  });

  lines.push('', 'Environment');
  if (snap.pageUrl) lines.push(`  Page: ${snap.pageUrl}`);
  if (snap.userAgent) lines.push(`  User agent: ${snap.userAgent}`);
  if (snap.online !== undefined) lines.push(`  Online: ${snap.online ? 'yes' : 'no'}`);
  if (snap.connection) {
    const c = snap.connection;
    lines.push(
      `  Connection: ${c.effectiveType ?? 'unknown'}, downlink ${c.downlink ?? 'n/a'} Mbps, rtt ${c.rtt ?? 'n/a'} ms${
        c.saveData ? ', data saver on' : ''
      }`
    );
  }
  return lines.join('\n');
}
