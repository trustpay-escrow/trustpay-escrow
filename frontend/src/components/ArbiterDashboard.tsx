'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { useWalletStore } from '@/store/walletStore';

export interface DisputedProject {
  id: string;
  title: string;
  client: string;
  freelancer: string;
  arbiter: string;
  budget: number;
  token: string;
  category: string;
  disputeReason: string;
  disputedAt: string;
  status: 'disputed' | 'resolved';
  clientClaim: string;
  freelancerClaim: string;
}

const INITIAL_DISPUTES: DisputedProject[] = [
  {
    id: 'disp-101',
    title: 'Stellar Soroban AMM Smart Contract Audit',
    client: 'GBZX...44AL',
    freelancer: 'GCLP...99KZ',
    arbiter: 'GARB...77TR',
    budget: 3500,
    token: 'USDC',
    category: 'Security Audit',
    disputeReason: 'Milestone 2 deliverable contained incomplete reentrancy test cases.',
    disputedAt: '2026-09-18T10:30:00Z',
    status: 'disputed',
    clientClaim: 'Client requests 50% refund for unverified audit coverage.',
    freelancerClaim: 'Freelancer states all scope items specified in Milestone 2 were completed.',
  },
  {
    id: 'disp-102',
    title: 'Cross-Border P2P Remittance UI in Next.js',
    client: 'GAKL...11MN',
    freelancer: 'GDTR...88XY',
    arbiter: 'GARB...77TR',
    budget: 1800,
    token: 'EURC',
    category: 'Frontend Development',
    disputeReason: 'Client claims milestone was delivered 5 days past agreed delivery timelock.',
    disputedAt: '2026-09-15T14:20:00Z',
    status: 'disputed',
    clientClaim: 'Requests $400 penalty deduction due to project launch delay.',
    freelancerClaim: 'Delay caused by late client API credential delivery.',
  },
  {
    id: 'disp-103',
    title: 'Freighter Wallet SDK Integration',
    client: 'GCVT...33QQ',
    freelancer: 'GBLM...22PP',
    arbiter: 'GARB...77TR',
    budget: 1200,
    token: 'USDC',
    category: 'Integration',
    disputeReason: 'Dispute resolved via 60/40 mutual settlement.',
    disputedAt: '2026-09-02T09:15:00Z',
    status: 'resolved',
    clientClaim: 'Settled',
    freelancerClaim: 'Settled',
  },
];

export function ArbiterDashboard() {
  const { address } = useWalletStore();
  const [disputes, setDisputes] = useState<DisputedProject[]>(INITIAL_DISPUTES);
  const [selectedDispute, setSelectedDispute] = useState<DisputedProject | null>(null);
  const [activeTab, setActiveTab] = useState<'disputes' | 'resolved' | 'policy'>('disputes');

  // Settlement Form State
  const [clientSplitPct, setClientSplitPct] = useState<number>(50);
  const [isResolving, setIsResolving] = useState(false);

  const freelancerSplitPct = 100 - clientSplitPct;

  const handleOpenArbitration = (disp: DisputedProject) => {
    setSelectedDispute(disp);
    setClientSplitPct(50);
  };

  const handleResolveDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispute) return;

    setIsResolving(true);
    try {
      // Simulate on-chain Soroban resolve_dispute invocation
      await new Promise((res) => setTimeout(res, 600));

      const clientAmount = (selectedDispute.budget * clientSplitPct) / 100;
      const freelancerAmount = (selectedDispute.budget * freelancerSplitPct) / 100;

      setDisputes((prev) =>
        prev.map((d) =>
          d.id === selectedDispute.id ? { ...d, status: 'resolved' } : d
        )
      );

      toast.success(
        `Dispute resolved! ${clientAmount} ${selectedDispute.token} released to client, ${freelancerAmount} ${selectedDispute.token} released to freelancer.`
      );
      setSelectedDispute(null);
    } catch (err: any) {
      toast.error('Failed to submit dispute settlement to Stellar Soroban');
    } finally {
      setIsResolving(false);
    }
  };

  const activeDisputesList = disputes.filter((d) => d.status === 'disputed');
  const resolvedDisputesList = disputes.filter((d) => d.status === 'resolved');

  return (
    <div data-testid="arbiter-dashboard" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Arbiter Hero & Metrics Card */}
      <div className="bg-gradient-to-br from-[#1c1917] via-[#18181b] to-[#09090b] border border-amber-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-amber-500/10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                ⚖️ Arbiter Chamber
              </span>
              <span className="text-xs text-[#a1a1aa] font-mono">
                {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Arbiter Identity'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Dispute Resolution & Consensus Center
            </h1>
            <p className="text-xs sm:text-sm text-[#a1a1aa] mt-1">
              Arbitrate contested escrow contracts and enforce impartial milestone settlements on Stellar Soroban.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('disputes')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'disputes'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                  : 'bg-[#27272a] text-[#a1a1aa] hover:text-white'
              }`}
            >
              Active Disputes ({activeDisputesList.length})
            </button>
            <button
              onClick={() => setActiveTab('resolved')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'resolved'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                  : 'bg-[#27272a] text-[#a1a1aa] hover:text-white'
              }`}
            >
              Settled Archive ({resolvedDisputesList.length})
            </button>
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
          <div className="bg-[#1e1e24]/80 p-4 rounded-2xl border border-[#33333b]">
            <span className="text-xs text-[#a1a1aa]">Active Disputes</span>
            <div className="text-2xl font-black text-amber-400 mt-1">
              {activeDisputesList.length}
            </div>
          </div>
          <div className="bg-[#1e1e24]/80 p-4 rounded-2xl border border-[#33333b]">
            <span className="text-xs text-[#a1a1aa]">Resolved Escrows</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {resolvedDisputesList.length}
            </div>
          </div>
          <div className="bg-[#1e1e24]/80 p-4 rounded-2xl border border-[#33333b]">
            <span className="text-xs text-[#a1a1aa]">Arbitrated Volume</span>
            <div className="text-2xl font-black text-indigo-400 mt-1">$6,500 USDC</div>
          </div>
          <div className="bg-[#1e1e24]/80 p-4 rounded-2xl border border-[#33333b]">
            <span className="text-xs text-[#a1a1aa]">Consensus Finality</span>
            <div className="text-2xl font-black text-white mt-1">99.2%</div>
          </div>
        </div>
      </div>

      {/* Disputed Projects List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>{activeTab === 'disputes' ? 'Active Disputes Requiring Review' : 'Settlement Log'}</span>
        </h2>

        {(activeTab === 'disputes' ? activeDisputesList : resolvedDisputesList).length === 0 ? (
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-12 text-center text-[#71717a] space-y-2">
            <div className="text-3xl">⚖️</div>
            <p className="text-sm font-medium">No disputes in this view.</p>
            <p className="text-xs">All TrustPay escrow milestones are currently running in consensus.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {(activeTab === 'disputes' ? activeDisputesList : resolvedDisputesList).map((disp) => (
              <div
                key={disp.id}
                className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 hover:border-amber-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#27272a] text-slate-300">
                      {disp.category}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase border ${
                        disp.status === 'disputed'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}
                    >
                      {disp.status}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white">{disp.title}</h3>
                  <p className="text-xs text-[#a1a1aa] leading-relaxed max-w-2xl">
                    <strong className="text-slate-300">Dispute Claim: </strong>
                    {disp.disputeReason}
                  </p>

                  <div className="flex items-center gap-4 text-xs font-mono text-[#71717a] pt-1">
                    <span>Client: {disp.client}</span>
                    <span>•</span>
                    <span>Freelancer: {disp.freelancer}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row md:flex-col items-end gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-[11px] text-[#a1a1aa] block">Escrow Amount</span>
                    <span className="text-xl font-black text-amber-400">
                      {disp.budget} {disp.token}
                    </span>
                  </div>

                  {disp.status === 'disputed' && (
                    <button
                      onClick={() => handleOpenArbitration(disp)}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                    >
                      <span>Arbitrate & Settle</span>
                      <span>⚖️</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Arbitration Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-[#27272a] rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Arbitration Settlement
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  {selectedDispute.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDispute(null)}
                className="text-[#71717a] hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#09090b] p-4 rounded-xl border border-[#27272a] space-y-2 text-xs">
              <div className="text-[#a1a1aa]">
                <strong className="text-white">Client Position: </strong>
                {selectedDispute.clientClaim}
              </div>
              <div className="text-[#a1a1aa]">
                <strong className="text-white">Freelancer Position: </strong>
                {selectedDispute.freelancerClaim}
              </div>
            </div>

            <form onSubmit={handleResolveDispute} className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-blue-400">Client Refund: {clientSplitPct}%</span>
                  <span className="text-indigo-400">Freelancer Payout: {freelancerSplitPct}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={clientSplitPct}
                  onChange={(e) => setClientSplitPct(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-center bg-[#232328] p-3 rounded-xl border border-[#33333b]">
                <div>
                  <span className="text-[10px] text-[#a1a1aa] block uppercase">Client Receives</span>
                  <span className="text-base font-bold text-blue-400">
                    {((selectedDispute.budget * clientSplitPct) / 100).toFixed(2)} {selectedDispute.token}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#a1a1aa] block uppercase">Freelancer Receives</span>
                  <span className="text-base font-bold text-indigo-400">
                    {((selectedDispute.budget * freelancerSplitPct) / 100).toFixed(2)} {selectedDispute.token}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDispute(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#a1a1aa] hover:text-white bg-[#27272a]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResolving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isResolving ? 'Executing On-Chain...' : 'Execute Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

