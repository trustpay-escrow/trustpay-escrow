'use client';

import React from 'react';
import { useWalletStore } from '@/store/walletStore';
import { ClientDashboard } from './ClientDashboard';
import { FreelancerDashboard } from './FreelancerDashboard';
import WalletConnect from './WalletConnect';

export function DashboardRouter() {
  const { address, activeRole, setActiveRole, disconnect } = useWalletStore();

  // AUTH GUARD: If user has not connected wallet, block dashboard and require wallet connect
  if (!address) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-blue-600/15 to-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-lg w-full text-center space-y-6">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#18181b] border border-[#27272a] text-xs font-semibold text-[#a1a1aa] shadow-xl">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span>Authentication Required</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Connect Your Wallet
            </h1>
            <p className="text-sm text-[#a1a1aa] leading-relaxed max-w-md mx-auto">
              Please connect your Freighter Stellar wallet to access your projects, submit proposals, or create escrows.
            </p>
          </div>

          <div className="pt-2">
            <WalletConnect />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      {/* Top Global Capability Switcher Bar */}
      <div className="w-full bg-[#18181b] border-b border-[#27272a] px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center space-x-2">
          <span className="font-extrabold text-blue-500 tracking-wider">TRUSTPAY ESCROW</span>
          <span className="text-[#52525b]">|</span>
          <span className="text-[#a1a1aa]">Wallet:</span>
          <span className="font-semibold text-white bg-[#27272a] px-2.5 py-0.5 rounded-md font-mono text-[11px] border border-[#3f3f46]">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
          <button
            onClick={disconnect}
            className="text-[11px] text-[#71717a] hover:text-red-400 font-semibold underline transition-colors ml-2"
          >
            Disconnect
          </button>
        </div>

        {/* Viewing As Mode Switcher */}
        <div className="flex items-center space-x-2">
          <span className="text-[#a1a1aa] font-medium text-xs">Viewing as:</span>
          <div className="flex items-center space-x-1 bg-[#232326] p-1 rounded-xl border border-[#333338]">
            <button
              onClick={() => setActiveRole('client')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center space-x-1 ${
                activeRole === 'client'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]'
              }`}
            >
              <span>👤 Client</span>
            </button>
            <button
              onClick={() => setActiveRole('freelancer')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center space-x-1 ${
                activeRole === 'freelancer'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]'
              }`}
            >
              <span>💼 Freelancer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Render Active View matching Capability */}
      {activeRole === 'client' ? <ClientDashboard /> : <FreelancerDashboard />}
    </div>
  );
}
