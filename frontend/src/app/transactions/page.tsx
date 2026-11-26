'use client';

import React from 'react';
import Link from 'next/link';
import { TransactionLedgerTable } from '@/components/TransactionLedgerTable';

export default function TransactionsPage() {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="text-xs text-blue-400 hover:text-blue-300 transition flex items-center gap-1 mb-2"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Transaction History
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Complete on-chain audit trail of all project escrow settlements, deposits, and releases.
            </p>
          </div>
        </div>

        <TransactionLedgerTable isTestnet={true} />
      </div>
    </main>
  );
}
