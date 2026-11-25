import { describe, it, expect, vi } from 'vitest';
import {
  buildDiagnosticReport,
  computeOverallScore,
  EndpointProbe,
  LatencySample,
  probeEndpoint,
  pushSample,
  rateLatency,
  rateVital,
  summarizeSamples,
} from './telemetry';

const ok = (ms: number): LatencySample => ({ ms, ok: true, at: 0 });
const fail = (error = 'boom'): LatencySample => ({ ms: null, ok: false, at: 0, error });
const probe = (id: EndpointProbe['id'], samples: LatencySample[]): EndpointProbe => ({
  id,
  label: id === 'horizon' ? 'Stellar Horizon' : 'Soroban RPC',
  url: `https://${id}.example`,
  samples,
});

describe('rateVital thresholds', () => {
  it.each([
    ['LCP', 2500, 'good'],
    ['LCP', 2501, 'needs-improvement'],
    ['LCP', 4000, 'needs-improvement'],
    ['LCP', 4001, 'poor'],
    ['FID', 100, 'good'],
    ['FID', 101, 'needs-improvement'],
    ['FID', 301, 'poor'],
    ['CLS', 0.1, 'good'],
    ['CLS', 0.11, 'needs-improvement'],
    ['CLS', 0.26, 'poor'],
  ] as const)('%s at %s is %s', (name, value, expected) => {
    expect(rateVital(name, value)).toBe(expected);
  });
});

describe('rateLatency', () => {
  it('rates by round-trip time and treats a failed probe as poor', () => {
    expect(rateLatency(300)).toBe('good');
    expect(rateLatency(301)).toBe('needs-improvement');
    expect(rateLatency(1001)).toBe('poor');
    expect(rateLatency(null)).toBe('poor');
  });
});

describe('summarizeSamples', () => {
  it('computes last/min/avg/max and counts failures', () => {
    const s = summarizeSamples([ok(100), fail(), ok(300)]);
    expect(s).toMatchObject({ last: 300, min: 100, avg: 200, max: 300, failures: 1, total: 3 });
  });

  it('is pending with no samples and poor when nothing ever answered', () => {
    expect(summarizeSamples([]).rating).toBe('pending');
    const dead = summarizeSamples([fail(), fail()]);
    expect(dead).toMatchObject({ last: null, avg: null, failures: 2, rating: 'poor' });
  });
});

describe('computeOverallScore', () => {
  it('is pending until something has been measured', () => {
    const r = computeOverallScore({ LCP: null, FID: null, CLS: null }, [probe('horizon', [])]);
    expect(r).toEqual({ rating: 'pending', score: null });
  });

  it('is Good when every measured signal is good', () => {
    const r = computeOverallScore({ LCP: 1200, FID: 20, CLS: 0.01 }, [
      probe('horizon', [ok(120)]),
      probe('soroban', [ok(200)]),
    ]);
    expect(r).toEqual({ rating: 'good', score: 100 });
  });

  it('is Needs Improvement for a mixed result', () => {
    // good, needs-improvement, poor, good -> (100 + 50 + 0 + 100) / 4 = 62.5 -> 63
    const r = computeOverallScore({ LCP: 1000, FID: 150, CLS: 0.5 }, [probe('soroban', [ok(100)])]);
    expect(r).toEqual({ rating: 'needs-improvement', score: 63 });
  });

  it('is Poor when most signals are poor, including a dead RPC', () => {
    const r = computeOverallScore({ LCP: 9000, FID: null, CLS: null }, [probe('soroban', [fail()])]);
    expect(r).toEqual({ rating: 'poor', score: 0 });
  });

  it('ignores unmeasured vitals rather than counting them as poor', () => {
    const r = computeOverallScore({ LCP: 1000, FID: null, CLS: null }, []);
    expect(r).toEqual({ rating: 'good', score: 100 });
  });
});

describe('probeEndpoint', () => {
  const clockSeq = (...values: number[]) => {
    const q = [...values];
    return () => q.shift() ?? 0;
  };

  it('times a Horizon GET and reports the round trip', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const sample = await probeEndpoint('horizon', 'https://h.example', {
      fetchImpl,
      now: clockSeq(1000, 1180),
      clock: () => 42,
    });
    expect(sample).toEqual({ ms: 180, ok: true, at: 42 });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://h.example');
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: 'GET' });
  });

  it('sends a getHealth JSON-RPC POST to Soroban', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await probeEndpoint('soroban', 'https://rpc.example', { fetchImpl, now: clockSeq(0, 50) });
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ jsonrpc: '2.0', id: 1, method: 'getHealth' });
  });

  it('records non-2xx responses as failures with the status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const sample = await probeEndpoint('horizon', 'https://h.example', { fetchImpl });
    expect(sample).toMatchObject({ ms: null, ok: false, error: 'HTTP 503' });
  });

  it('never throws: network errors and timeouts become failed samples', async () => {
    const net = await probeEndpoint('horizon', 'https://h.example', {
      fetchImpl: vi.fn().mockRejectedValue(new Error('offline')),
    });
    expect(net).toMatchObject({ ok: false, error: 'offline' });

    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const timeout = await probeEndpoint('horizon', 'https://h.example', {
      fetchImpl: vi.fn().mockRejectedValue(abort),
      timeoutMs: 1234,
    });
    expect(timeout).toMatchObject({ ok: false, error: 'timeout after 1234 ms' });
  });
});

describe('pushSample', () => {
  it('keeps only the most recent samples', () => {
    let samples: LatencySample[] = [];
    for (let i = 1; i <= 25; i++) samples = pushSample(samples, ok(i), 20);
    expect(samples).toHaveLength(20);
    expect(samples[0].ms).toBe(6);
    expect(samples[19].ms).toBe(25);
  });
});

describe('buildDiagnosticReport', () => {
  it('includes the rating, vitals, probe stats and environment', () => {
    const report = buildDiagnosticReport({
      vitals: { LCP: 3000, FID: null, CLS: 0.02 },
      probes: [probe('horizon', [ok(100), ok(300)]), probe('soroban', [fail('HTTP 503')])],
      generatedAt: '2026-11-20T00:00:00.000Z',
      userAgent: 'TestAgent/1.0',
      pageUrl: 'https://app.example/projects',
      online: true,
      connection: { effectiveType: '4g', downlink: 10, rtt: 50 },
    });
    expect(report).toContain('Generated: 2026-11-20T00:00:00.000Z');
    expect(report).toContain('LCP: 3000 ms [Needs Improvement]');
    expect(report).toContain('FID: measuring… [not yet measured]');
    expect(report).toContain('CLS: 0.020 [Good]');
    expect(report).toContain('Stellar Horizon (https://horizon.example)');
    expect(report).toContain('avg 200 ms, min 100 ms, max 300 ms, failures 0/2');
    expect(report).toContain('failures 1/1');
    expect(report).toContain('last error: HTTP 503');
    expect(report).toContain('User agent: TestAgent/1.0');
    expect(report).toContain('Connection: 4g, downlink 10 Mbps, rtt 50 ms');
  });
});
