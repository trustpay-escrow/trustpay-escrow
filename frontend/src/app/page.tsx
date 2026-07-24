'use client';

import React from 'react';
import WalletConnect from "@/components/WalletConnect";
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans relative overflow-hidden flex flex-col justify-between">
      {/* Background Ambient Glow Spheres */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Navigation Header */}
      <header className="w-full border-b border-[#27272a]/60 bg-[#09090b]/80 backdrop-blur-xl sticky top-0 z-40 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 font-bold text-lg">
              T
            </div>
            <span className="font-extrabold text-lg text-white tracking-wider">TRUSTPAY</span>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#14532d] text-[#22c55e] border border-[#15803d]">
              ● Stellar Testnet Ready
            </span>
          </div>

          <Link
            href="/projects"
            className="px-4 py-2 bg-[#1c1c20] hover:bg-[#27272a] text-white font-semibold text-xs rounded-xl border border-[#3f3f46] transition-all hover:border-[#52525b]"
          >
            Launch Dashboard ↗
          </Link>
        </div>
      </header>

      {/* Main Hero Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-12 md:py-20 text-center flex flex-col items-center">
        
        {/* Protocol Pill */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#18181b] border border-[#27272a] text-xs font-semibold text-[#a1a1aa] mb-6 shadow-xl">
          <span className="text-blue-400 font-bold">🔒 Protocol V1</span>
          <span>•</span>
          <span className="text-[#e4e4e7]">Soroban Milestone Escrows</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-tight max-w-4xl mb-6">
          Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-400">TrustPay</span>
        </h1>

        <p className="text-base md:text-xl text-[#a1a1aa] max-w-2xl leading-relaxed mb-10">
          The trustless escrow platform on Stellar. Lock funds in smart contracts, release payments per milestone, and switch seamlessly between Client and Freelancer.
        </p>

        {/* Embedded Wallet Connect Box */}
        <div className="w-full max-w-md mb-16">
          <WalletConnect />
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6 space-y-3 hover:border-[#3f3f46] transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center text-xl font-bold">
              ⚡
            </div>
            <h3 className="text-lg font-bold text-white">Smart Contract Escrows</h3>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Milestone funds are securely locked in Soroban smart contracts and automatically released upon client approval.
            </p>
          </div>

          <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6 space-y-3 hover:border-[#3f3f46] transition-all">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-xl font-bold">
              🆔
            </div>
            <h3 className="text-lg font-bold text-white">Unified Wallet Capability</h3>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              One wallet address grants full capability to create projects as a Client and apply as a Freelancer without account fragmentation.
            </p>
          </div>

          <div className="bg-[#18181b]/80 border border-[#27272a] rounded-2xl p-6 space-y-3 hover:border-[#3f3f46] transition-all">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center text-xl font-bold">
              🛡️
            </div>
            <h3 className="text-lg font-bold text-white">Dispute Governance</h3>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Arbiter-backed dispute mechanisms safeguard both parties, ensuring fair settlement if expectations differ.
            </p>
          </div>
        </div>

      </section>

      {/* Footer */}
      <footer className="w-full border-t border-[#27272a]/60 py-6 text-center text-xs text-[#71717a]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© 2026 TrustPay Escrow. Built on Stellar Soroban.</span>
          <div className="flex items-center space-x-4">
            <Link href="/projects" className="hover:text-white transition-colors">Explore Projects</Link>
            <Link href="/projects/create" className="hover:text-white transition-colors">Create Project</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
