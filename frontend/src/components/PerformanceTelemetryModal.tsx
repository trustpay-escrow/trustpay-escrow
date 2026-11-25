'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  buildDiagnosticReport,
  computeOverallScore,
  EndpointProbe,
  formatVital,
  LatencySample,
  observeWebVitals,
  OverallRating,
  probeEndpoint,
  pushSample,
  Rating,
  RATING_LABEL,
  rateVital,
  summarizeSamples,
  VITAL_THRESHOLDS,
  VitalName,
  WebVitals,
} from '@/lib/telemetry';
import { HORIZON_URL, SOROBAN_RPC_URL } from '@/lib/soroban';

const PROBE_INTERVAL_MS = 5000;

const RATING_STYLES: Record<OverallRating, string> = {
  good: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  'needs-improvement': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  poor: 'text-red-400 bg-red-500/10 border-red-500/30',
  pending: 'text-[#a1a1aa] bg-[#27272a] border-[#3f3f46]',
};

const RATING_STROKE: Record<Rating | 'pending', string> = {
  good: '#34d399',
  'needs-improvement': '#fbbf24',
  poor: '#f87171',
  pending: '#71717a',
};

const VITAL_DESCRIPTIONS: Record<VitalName, string> = {
  LCP: 'Largest Contentful Paint',
  FID: 'First Input Delay',
  CLS: 'Cumulative Layout Shift',
};

/** The endpoints we probe. Static for the page's lifetime. */
const PROBE_TARGETS: Array<Pick<EndpointProbe, 'id' | 'label' | 'url'>> = [
  { id: 'horizon', label: 'Stellar Horizon', url: HORIZON_URL },
  { id: 'soroban', label: 'Soroban RPC', url: SOROBAN_RPC_URL },
];

const initialProbes = (): EndpointProbe[] => PROBE_TARGETS.map((t) => ({ ...t, samples: [] }));

function Sparkline({ samples, rating }: { samples: LatencySample[]; rating: Rating | 'pending' }) {
  const width = 240;
  const height = 48;
  const values = samples.map((s) => (s.ok && s.ms !== null ? s.ms : null));
  const max = Math.max(100, ...values.filter((v): v is number => v !== null));
  const step = samples.length > 1 ? width / (samples.length - 1) : width;

  const points = values
    .map((v, i) => (v === null ? null : `${(i * step).toFixed(1)},${(height - (v / max) * (height - 4) - 2).toFixed(1)}`))
    .filter((p): p is string => p !== null);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-12"
      role="img"
      aria-label={`Latency graph, ${samples.length} samples`}
      preserveAspectRatio="none"
    >
      {points.length > 1 && (
        <polyline
          fill="none"
          stroke={RATING_STROKE[rating]}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points.join(' ')}
        />
      )}
      {values.map((v, i) =>
        v === null ? (
          <line
            key={i}
            data-testid="probe-failure"
            x1={i * step}
            x2={i * step}
            y1={0}
            y2={height}
            stroke="#f87171"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        ) : null
      )}
    </svg>
  );
}

export interface PerformanceTelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PerformanceTelemetryModal({ isOpen, onClose }: PerformanceTelemetryModalProps) {
  const [vitals, setVitals] = useState<WebVitals>({ LCP: null, FID: null, CLS: null });
  const [probes, setProbes] = useState<EndpointProbe[]>(initialProbes);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    return observeWebVitals(setVitals);
  }, [isOpen]);

  const runProbes = useCallback(async () => {
    const results = await Promise.all(
      PROBE_TARGETS.map(async (t) => ({ id: t.id, sample: await probeEndpoint(t.id, t.url) }))
    );
    setProbes((prev) =>
      prev.map((p) => {
        const hit = results.find((r) => r.id === p.id);
        return hit ? { ...p, samples: pushSample(p.samples, hit.sample) } : p;
      })
    );
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    // First probe on the next tick (not synchronously in the effect body), then poll.
    const first = setTimeout(() => void runProbes(), 0);
    const timer = setInterval(() => void runProbes(), PROBE_INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [isOpen, runProbes]);

  const overall = computeOverallScore(vitals, probes);

  const handleCopy = async () => {
    const nav = navigator as Navigator & {
      connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
    };
    const report = buildDiagnosticReport({
      vitals,
      probes,
      generatedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      pageUrl: window.location.href,
      online: navigator.onLine,
      connection: nav.connection
        ? {
            effectiveType: nav.connection.effectiveType,
            downlink: nav.connection.downlink,
            rtt: nav.connection.rtt,
            saveData: nav.connection.saveData,
          }
        : undefined,
    });
    try {
      await navigator.clipboard.writeText(report);
      toast.success('Diagnostic report copied to clipboard');
    } catch {
      toast.error('Could not access the clipboard. Copy the report manually.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Performance telemetry"
        className="bg-[#18181b] border border-[#27272a] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-[#27272a] bg-[#1c1c20] flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Performance Telemetry</h2>
            <p className="text-xs text-[#71717a] mt-1">
              Live Core Web Vitals and network latency for this session.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              data-testid="overall-rating"
              className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${RATING_STYLES[overall.rating]}`}
            >
              {RATING_LABEL[overall.rating]}
              {overall.score !== null ? ` · ${overall.score}` : ''}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close performance telemetry"
              className="text-[#a1a1aa] hover:text-white text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-6">
          <section aria-labelledby="vitals-heading">
            <h3 id="vitals-heading" className="text-sm font-semibold text-white mb-3">
              Core Web Vitals
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(Object.keys(VITAL_THRESHOLDS) as VitalName[]).map((name) => {
                const value = vitals[name];
                const rating: OverallRating = value === null ? 'pending' : rateVital(name, value);
                const t = VITAL_THRESHOLDS[name];
                return (
                  <div
                    key={name}
                    data-testid={`vital-${name}`}
                    data-rating={rating}
                    className="rounded-xl border border-[#27272a] bg-[#1c1c20] p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{name}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${RATING_STYLES[rating]}`}>
                        {RATING_LABEL[rating]}
                      </span>
                    </div>
                    <p className="text-xl font-mono text-white mt-2">{formatVital(name, value)}</p>
                    <p className="text-[10px] text-[#71717a] mt-1">
                      {VITAL_DESCRIPTIONS[name]}. Good ≤ {t.good}
                      {t.unit && ` ${t.unit}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="latency-heading">
            <h3 id="latency-heading" className="text-sm font-semibold text-white mb-3">
              Network latency
            </h3>
            <div className="space-y-3">
              {probes.map((p) => {
                const stats = summarizeSamples(p.samples);
                return (
                  <div
                    key={p.id}
                    data-testid={`probe-${p.id}`}
                    className="rounded-xl border border-[#27272a] bg-[#1c1c20] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{p.label}</p>
                        <p className="text-[10px] text-[#71717a] truncate">{p.url}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-mono text-white">
                          {stats.last === null ? (stats.total ? 'failed' : '…') : `${Math.round(stats.last)} ms`}
                        </p>
                        <p className="text-[10px] text-[#71717a]">
                          avg {stats.avg === null ? 'n/a' : `${Math.round(stats.avg)} ms`} · {stats.failures}/{stats.total} failed
                        </p>
                      </div>
                    </div>
                    <Sparkline samples={p.samples} rating={stats.rating} />
                  </div>
                );
              })}
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold"
            >
              Copy System Diagnostic Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Self-contained launcher: floating button plus the modal it opens. */
export function PerformanceTelemetryButton() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open performance telemetry"
        title="Performance telemetry"
        className="fixed bottom-4 left-4 z-40 h-10 w-10 rounded-full bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-white hover:border-[#3f3f46] shadow-lg text-base"
      >
        ⚡
      </button>
      <PerformanceTelemetryModal isOpen={open} onClose={close} />
    </>
  );
}
