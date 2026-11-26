'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import DisputeMediationView from '@/components/DisputeMediationView';

export default function DisputeDetailPage() {
  const params = useParams();
  const disputeId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string) || 'disp-84920';

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] flex flex-col justify-between selection:bg-blue-500/30 selection:text-white">
      <Header />

      <main id="main-content" tabIndex={-1} className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/projects"
            className="inline-flex items-center text-xs text-[#a1a1aa] hover:text-white space-x-1 transition-colors"
          >
            <span>← Back to Dashboard</span>
          </Link>
          <span className="text-xs text-[#71717a]">
            Arbitration Docket #{disputeId}
          </span>
        </div>

        <DisputeMediationView disputeId={disputeId} />
      </main>

      <footer className="w-full border-t border-[#27272a] py-6 text-center text-xs text-[#71717a]">
        TrustPay Escrow Protocol • Stellar Soroban Decentralized Arbitration
      </footer>
    </div>
  );
}
