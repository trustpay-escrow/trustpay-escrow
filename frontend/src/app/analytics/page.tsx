'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EscrowVolumeChart } from '@/components/EscrowVolumeChart';
import { fetchEscrowAnalytics, type EscrowAnalytics } from '@/lib/api';

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<EscrowAnalytics>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchEscrowAnalytics(controller.signal).then(
      (result) => { if (!controller.signal.aborted) setAnalytics(result); },
      () => { if (!controller.signal.aborted) setFailed(true); },
    );
    return () => controller.abort();
  }, [attempt]);

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/projects" className="text-sm text-blue-400 hover:underline">← Projects</Link>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Escrow analytics</h1>
        <p className="mb-6 mt-2 text-slate-400">Locked principal and indexed Stellar milestone settlements for public projects.</p>
        {analytics ? <EscrowVolumeChart analytics={analytics} /> : failed ? (
          <div role="alert">
            <p>Could not load escrow analytics.</p>
            <button type="button" className="mt-2 text-blue-400 underline" onClick={() => {
              setFailed(false);
              setAttempt((previous) => previous + 1);
            }}>Try again</button>
          </div>
        ) : <p role="status">Loading escrow analytics…</p>}
      </div>
    </main>
  );
}
