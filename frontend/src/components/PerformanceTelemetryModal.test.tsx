import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { PerformanceTelemetryModal, PerformanceTelemetryButton } from './PerformanceTelemetryModal';

vi.mock('@/lib/soroban', () => ({
  HORIZON_URL: 'https://horizon.test',
  SOROBAN_RPC_URL: 'https://rpc.test',
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';

type Entry = Record<string, unknown>;
let observers: Array<{ type: string; cb: (list: { getEntries: () => Entry[] }) => void }> = [];

class FakePerformanceObserver {
  cb: (list: { getEntries: () => Entry[] }) => void;
  type = '';
  constructor(cb: (list: { getEntries: () => Entry[] }) => void) {
    this.cb = cb;
  }
  observe(opts: { type: string }) {
    this.type = opts.type;
    observers.push({ type: opts.type, cb: this.cb });
  }
  disconnect() {}
}

const emit = (type: string, entries: Entry[]) =>
  act(() => {
    observers.filter((o) => o.type === type).forEach((o) => o.cb({ getEntries: () => entries }));
  });

describe('PerformanceTelemetryModal', () => {
  beforeEach(() => {
    observers = [];
    vi.stubGlobal('PerformanceObserver', FakePerformanceObserver);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200 })
    );
    vi.mocked(navigator.clipboard.writeText).mockClear();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders nothing while closed', () => {
    const { container } = render(<PerformanceTelemetryModal isOpen={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('starts pending, then rates vitals as PerformanceObserver reports them', async () => {
    render(<PerformanceTelemetryModal isOpen onClose={() => {}} />);
    expect(screen.getByTestId('vital-LCP')).toHaveAttribute('data-rating', 'pending');

    emit('largest-contentful-paint', [{ startTime: 1800 }]);
    emit('first-input', [{ startTime: 1000, processingStart: 1350 }]);
    emit('layout-shift', [
      { value: 0.04, hadRecentInput: false },
      { value: 0.5, hadRecentInput: true }, // user-initiated shifts must not count
      { value: 0.03, hadRecentInput: false },
    ]);

    expect(screen.getByTestId('vital-LCP')).toHaveAttribute('data-rating', 'good');
    expect(screen.getByTestId('vital-FID')).toHaveAttribute('data-rating', 'poor'); // 350 ms
    expect(screen.getByTestId('vital-CLS')).toHaveAttribute('data-rating', 'good'); // 0.07
    expect(screen.getByTestId('vital-CLS')).toHaveTextContent('0.070');
    await waitFor(() => expect(screen.getByTestId('probe-horizon')).toHaveTextContent(/\d+ ms/));
  });

  it('rates FID exactly at the boundary between good and needs-improvement', () => {
    render(<PerformanceTelemetryModal isOpen onClose={() => {}} />);
    emit('first-input', [{ startTime: 500, processingStart: 600 }]); // 100 ms
    expect(screen.getByTestId('vital-FID')).toHaveAttribute('data-rating', 'good');
    emit('first-input', [{ startTime: 500, processingStart: 650 }]); // 150 ms
    expect(screen.getByTestId('vital-FID')).toHaveAttribute('data-rating', 'needs-improvement');
  });

  it('probes Horizon (GET) and Soroban RPC (JSON-RPC POST) and shows the latency', async () => {
    render(<PerformanceTelemetryModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    const calls = vi.mocked(fetch).mock.calls;
    const horizon = calls.find(([url]) => url === 'https://horizon.test');
    const rpc = calls.find(([url]) => url === 'https://rpc.test');
    expect(horizon?.[1]).toMatchObject({ method: 'GET' });
    expect(rpc?.[1]).toMatchObject({ method: 'POST' });

    await waitFor(() => expect(screen.getByTestId('probe-horizon')).toHaveTextContent(/\d+ ms/));
    expect(screen.getByTestId('probe-soroban')).toHaveTextContent('0/1 failed');
  });

  it('shows a failed endpoint and drags the overall rating down', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    render(<PerformanceTelemetryModal isOpen onClose={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('probe-soroban')).toHaveTextContent('failed'));
    expect(screen.getByTestId('probe-soroban')).toHaveTextContent('1/1 failed');
    expect(screen.getByTestId('overall-rating')).toHaveTextContent('Poor');
    expect(screen.getAllByTestId('probe-failure').length).toBeGreaterThan(0);
  });

  it('copies a diagnostic report containing live readings', async () => {
    render(<PerformanceTelemetryModal isOpen onClose={() => {}} />);
    emit('largest-contentful-paint', [{ startTime: 3200 }]);
    await waitFor(() => expect(screen.getByTestId('probe-horizon')).toHaveTextContent(/\d+ ms/));

    fireEvent.click(screen.getByRole('button', { name: 'Copy System Diagnostic Report' }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
    const report = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(report).toContain('System Diagnostic Report');
    expect(report).toContain('LCP: 3200 ms [Needs Improvement]');
    expect(report).toContain('Stellar Horizon (https://horizon.test)');
    expect(report).toContain('Soroban RPC (https://rpc.test)');
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('reports a clipboard failure instead of throwing', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
    render(<PerformanceTelemetryModal isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy System Diagnostic Report' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('closes on Escape and stops probing once closed', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<PerformanceTelemetryModal isOpen onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(screen.getByTestId('probe-soroban')).toHaveTextContent('0/1 failed'));
    rerender(<PerformanceTelemetryModal isOpen={false} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('PerformanceTelemetryButton', () => {
  beforeEach(() => {
    observers = [];
    vi.stubGlobal('PerformanceObserver', FakePerformanceObserver);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the dialog from the launcher and closes it again', async () => {
    render(<PerformanceTelemetryButton />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open performance telemetry' }));
    expect(screen.getByRole('dialog', { name: 'Performance telemetry' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close performance telemetry' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
