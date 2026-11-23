'use client';

import React from 'react';
import Link from 'next/link';
import { CreateProjectWizard } from '@/components/CreateProjectWizard';
import Header from '@/components/Header';

export default function CreateProjectPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] flex flex-col justify-between selection:bg-blue-500/30 selection:text-white">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/projects"
            className="inline-flex items-center text-xs text-[#a1a1aa] hover:text-white space-x-1 transition-colors"
          >
            <span>← Back to Dashboard</span>
          </Link>
          <Link
            href="/projects/create/retainer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 transition-colors hover:bg-indigo-500/20"
          >
            <span aria-hidden="true">🔁</span> Set up a recurring retainer
          </Link>
        </div>

        <CreateProjectWizard />
      </main>

      <footer className="w-full border-t border-[#27272a] py-6 text-center text-xs text-[#71717a]">
        TrustPay Escrow Protocol • Powered by Stellar Soroban
      </footer>
    </div>
  );
}
