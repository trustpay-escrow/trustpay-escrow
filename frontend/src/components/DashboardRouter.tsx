'use client';

import React from 'react';
import { useWalletStore, useActiveWalletAddress } from '@/store/walletStore';
import { ClientDashboard } from './ClientDashboard';
import { FreelancerDashboard } from './FreelancerDashboard';
import { ArbiterDashboard } from './ArbiterDashboard';
import { RoleSwitcher } from './RoleSwitcher';
import WalletConnect from './WalletConnect';
import NotificationBell from './NotificationBell';
import { OrgWalletSwitcher } from './OrgWalletSwitcher';
import { CryptoId } from '@/components/ui/CryptoId';

export function DashboardRouter() {
  const { address, activeRole, disconnect } = useWalletStore();
  const activeWalletAddress = useActiveWalletAddress() || address;

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
              Please connect your Stellar wallet (Freighter, xBull, Albedo, etc.) to access your projects, submit proposals, or create escrows.
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
          <CryptoId
            value={activeWalletAddress ?? ''}
            head={6}
            tail={4}
            className="font-semibold text-white bg-[#27272a] px-2.5 py-0.5 rounded-md border border-[#3f3f46]"
          />
          <button
            onClick={disconnect}
            className="text-[11px] text-[#71717a] hover:text-red-400 font-semibold underline transition-colors ml-2"
          >
            Disconnect
          </button>
        </div>

        {/* Right Section: Notification Bell & Mode Switcher */}
        <div className="flex items-center space-x-4">
          <OrgWalletSwitcher />
          <NotificationBell />

          <div className="flex items-center space-x-2">
            <span className="text-[#a1a1aa] font-medium text-xs">Viewing as:</span>
            <RoleSwitcher />
          </div>
        </div>
      </div>

      {/* Render Active View matching Capability */}
      {activeRole === 'client' && <ClientDashboard />}
      {activeRole === 'freelancer' && <FreelancerDashboard />}
      {activeRole === 'arbiter' && <ArbiterDashboard />}
    </div>
  );
}
