import Accordion from '@/components/Accordion';
'use client';

import React, { useState } from 'react';
import WalletConnect from "@/components/WalletConnect";
import Header from "@/components/Header";
import { useI18n } from "@/lib/i18n";
import Link from 'next/link';
import EscrowGlobeVisualizer3D, { GlobeEscrow } from "@/components/EscrowGlobeVisualizer3D";

const liveEscrows: GlobeEscrow[] = [
  {
    id: 'sf-london-usdc',
    client: { lat: 37.77, lon: -122.42, label: 'San Francisco' },
    contractor: { lat: 51.51, lon: -0.13, label: 'London' },
    asset: 'USDC',
    status: 'locked',
  },
  {
    id: 'tokyo-berlin-xlm',
    client: { lat: 35.68, lon: 139.69, label: 'Tokyo' },
    contractor: { lat: 52.52, lon: 13.41, label: 'Berlin' },
    asset: 'XLM',
    status: 'locked',
  },
  {
    id: 'nyc-nairobi-usdc',
    client: { lat: 40.71, lon: -74.01, label: 'New York' },
    contractor: { lat: -1.29, lon: 36.82, label: 'Nairobi' },
    asset: 'USDC',
    status: 'locked',
  },
  {
    id: 'singapore-toronto-done',
    client: { lat: 1.35, lon: 103.82, label: 'Singapore' },
    contractor: { lat: 43.65, lon: -79.38, label: 'Toronto' },
    asset: 'completed',
    status: 'released',
  },
  {
    id: 'sydney-saopaulo-xlm',
    client: { lat: -33.87, lon: 151.21, label: 'Sydney' },
    contractor: { lat: -23.55, lon: -46.63, label: 'Sao Paulo' },
    asset: 'XLM',
    status: 'locked',
  },
];

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { t, formatAmount } = useI18n();

  const testimonials = [
    {
      name: "Alex Chen",
      role: "Full-Stack Web3 Freelancer",
      avatar: "AC",
      gradient: "from-blue-600 to-cyan-500",
      rating: 5,
      content: "TrustPay eliminated all payment anxiety. Knowing milestone funds are locked directly in Stellar Soroban smart contracts gave my clients total peace of mind."
    },
    {
      name: "Sarah Jenkins",
      role: "Product Manager @ BlockLaunch",
      avatar: "SJ",
      gradient: "from-indigo-600 to-purple-600",
      rating: 5,
      content: "As a client hiring global contractors, TrustPay makes milestone payouts instant with sub-cent network fees. The unified wallet workflow is brilliant."
    },
    {
      name: "Michael Vance",
      role: "Smart Contract Auditor",
      avatar: "MV",
      gradient: "from-purple-600 to-pink-600",
      rating: 5,
      content: "The dispute resolution mechanics and dual-role flexibility are second to none. Transactions finalize in under 3 seconds on Stellar Testnet."
    }
  ];

  const faqs = [
    {
      q: "How does TrustPay ensure escrow security?",
      a: "Funds are locked directly into Soroban smart contracts on the Stellar blockchain. Neither TrustPay nor any third party can access funds without milestone completion or consensus resolution."
    },
    {
      q: "Can I use the same wallet as both a Client and Freelancer?",
      a: "Yes! TrustPay features unified wallet identity. A single Stellar address lets you post escrow jobs as a Client or submit proposals and claim funds as a Freelancer."
    },
    {
      q: "What happens if there is a disagreement on a milestone?",
      a: "Either party can raise a dispute. An assigned decentralized arbiter reviews the submitted deliverables and releases funds fairly according to project terms."
    },
    {
      q: "What tokens are supported for payments?",
      a: "TrustPay supports native XLM as well as Stellar USDC for stable value milestone payments with instant finality and sub-cent fees."
    }
  ];

  return (
    <main className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans relative overflow-x-hidden flex flex-col justify-between selection:bg-blue-500/30 selection:text-white">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Navigation Header */}
      <Header />

      {/* Hero Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-16 pb-20 text-center flex flex-col items-center">
        
        {/* Protocol Pill */}
        <div className="inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full bg-[#18181b] border border-[#27272a] text-xs font-semibold text-[#a1a1aa] mb-8 shadow-2xl backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
          <span className="text-blue-400 font-bold">Soroban Smart Contracts</span>
          <span className="text-[#3f3f46]">|</span>
          <span className="text-[#e4e4e7]">Milestone Escrow V1</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1] max-w-4xl mb-6">
          Trustless Escrow Payments for <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">Milestone Contracts</span>
        </h1>

        <p className="text-base sm:text-lg text-[#a1a1aa] max-w-2xl leading-relaxed mb-10 font-normal">
          Lock funds securely in Stellar Soroban smart contracts. Funds release automatically upon client approval — simple, transparent, and completely non-custodial.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 w-full sm:w-auto">
          {/* Primary Hero CTA with ambient radial gradient pulse & particle glow shimmer */}
          <div className="relative group/cta w-full sm:w-auto">
            <div
              className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 opacity-70 blur-lg animate-hero-glow group-hover/cta:opacity-100 group-hover/cta:scale-105 transition-all duration-500 pointer-events-none"
              aria-hidden="true"
            />
            <Link
              href="/projects/create"
              data-testid="hero-create-escrow-cta"
              className="relative flex items-center justify-center space-x-2 w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-blue-600/30 border border-blue-400/40 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] text-center"
            >
              <span>Create Escrow</span>
              <span className="text-blue-200 text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-sm">
                Instant V1
              </span>
            </Link>
          </div>

          <Link
            href="/projects"
            className="w-full sm:w-auto px-8 py-4 bg-[#18181b] hover:bg-[#27272a] text-white font-bold text-sm rounded-2xl border border-[#27272a] hover:border-[#3f3f46] transition-all hover:scale-[1.01] active:scale-[0.98] text-center"
          >
            Explore Projects Portal ↗
          </Link>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto px-8 py-4 text-[#a1a1aa] hover:text-white font-semibold text-sm transition-colors text-center"
          >
            How It Works ↓
          </a>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 w-full max-w-4xl p-6 rounded-3xl bg-[#18181b]/60 border border-[#27272a] backdrop-blur-xl mb-16 text-center">
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-black text-white">$0.0001</div>
            <div className="text-xs text-[#a1a1aa]">Average Network Fee</div>
          </div>
          <div className="space-y-1 border-l border-[#27272a]">
            <div className="text-2xl sm:text-3xl font-black text-blue-400">&lt; 3 Sec</div>
            <div className="text-xs text-[#a1a1aa]">Stellar Settlement Time</div>
          </div>
          <div className="space-y-1 border-l border-[#27272a]">
            <div className="text-2xl sm:text-3xl font-black text-indigo-400">100%</div>
            <div className="text-xs text-[#a1a1aa]">On-Chain Soroban Audit</div>
          </div>
          <div className="space-y-1 border-l border-[#27272a]">
            <div className="text-2xl sm:text-3xl font-black text-purple-400">Multi-Role</div>
            <div className="text-xs text-[#a1a1aa]">Client & Freelancer Wallet</div>
          </div>
        </div>

        {/* Embedded Wallet Connect Box */}
        <div id="wallet" className="w-full max-w-md scroll-mt-24">
          <WalletConnect />
        </div>
      </section>

      {/* Live Global Escrow Globe */}
      <section id="global-flow" className="relative z-10 w-full py-16 px-6 border-t border-[#27272a]/60 scroll-mt-12">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest bg-cyan-500/10 px-3.5 py-1.5 rounded-full border border-cyan-500/20">
              Borderless by Design
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
              Every Milestone, Across the Globe
            </h2>
            <p className="text-[#a1a1aa] max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
              Watch escrow locks and releases travel between clients and contractors in real time. Drag to orbit, scroll to zoom, and follow each glowing beam from funding to payout.
            </p>
          </div>
          <EscrowGlobeVisualizer3D escrows={liveEscrows} />
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="relative z-10 py-20 px-6 border-t border-[#27272a]/60 bg-[#09090b]/40 backdrop-blur-md scroll-mt-12">
        <div className="max-w-5xl mx-auto text-center space-y-16">
          <div className="space-y-4">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 px-3.5 py-1.5 rounded-full border border-blue-500/20">
              Seamless Workflow
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              How TrustPay Works
            </h2>
            <p className="text-[#a1a1aa] max-w-xl mx-auto text-sm sm:text-base">
              Three simple steps to conduct safe, milestone-driven freelance transactions on Stellar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-3xl p-8 space-y-4 relative overflow-hidden group hover:border-blue-500/40 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center text-xl font-black group-hover:scale-110 transition-transform">
                1
              </div>
              <h3 className="text-xl font-bold text-white">Create Escrow Job</h3>
              <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                Client creates a project, defines milestones, and deposits total funds into the Soroban smart contract.
              </p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-3xl p-8 space-y-4 relative overflow-hidden group hover:border-indigo-500/40 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-xl font-black group-hover:scale-110 transition-transform">
                2
              </div>
              <h3 className="text-xl font-bold text-white">Submit Work</h3>
              <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                Freelancer completes work and submits deliverables per milestone directly on the portal.
              </p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-3xl p-8 space-y-4 relative overflow-hidden group hover:border-purple-500/40 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center text-xl font-black group-hover:scale-110 transition-transform">
                3
              </div>
              <h3 className="text-xl font-bold text-white">Instant Payout</h3>
              <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                Client reviews and approves. The smart contract instantly releases funds to the freelancer&apos;s wallet.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative z-10 py-20 px-6 border-t border-[#27272a]/60 scroll-mt-12">
        <div className="max-w-5xl mx-auto text-center space-y-16">
          <div className="space-y-4">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20">
              Built for Stellar
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Platform Features
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-3xl p-8 space-y-4 hover:border-[#3f3f46] transition-all">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center text-2xl font-bold">
                ⚡
              </div>
              <h3 className="text-lg font-bold text-white">Soroban Escrow Contracts</h3>
              <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                Milestone funds locked in immutable code. Automated release mechanisms guarantee compliance without intermediaries.
              </p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-3xl p-8 space-y-4 hover:border-[#3f3f46] transition-all">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-2xl font-bold">
                🆔
              </div>
              <h3 className="text-lg font-bold text-white">Unified Wallet Identity</h3>
              <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                Switch seamlessly between Client mode (creating jobs) and Freelancer mode (applying & receiving payouts) with one address.
              </p>
            </div>

            <div className="bg-[#18181b]/80 border border-[#27272a] rounded-3xl p-8 space-y-4 hover:border-[#3f3f46] transition-all">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center text-2xl font-bold">
                🛡️
              </div>
              <h3 className="text-lg font-bold text-white">Decentralized Arbiter Protection</h3>
              <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                Built-in dispute resolution mechanics ensure fair resolution if deliverable specifications are disputed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="relative z-10 py-20 px-6 border-t border-[#27272a]/60 bg-[#09090b]/40 backdrop-blur-md scroll-mt-12">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest bg-cyan-500/10 px-3.5 py-1.5 rounded-full border border-cyan-500/20">
              Trusted Worldwide
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              What Our Users Say
            </h2>
            <p className="text-[#a1a1aa] max-w-xl mx-auto text-sm sm:text-base">
              Real feedback from clients and freelancers building trustless agreements on Stellar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#18181b]/80 border border-[#27272a] rounded-3xl p-8 space-y-6 flex flex-col justify-between hover:border-blue-500/40 transition-all duration-300 shadow-xl group"
              >
                <div className="space-y-4">
                  {/* Star Rating */}
                  <div className="flex items-center space-x-1 text-amber-400 text-sm">
                    {"★".repeat(item.rating)}
                  </div>
                  {/* Quote Content */}
                  <p className="text-xs sm:text-sm text-[#d4d4d8] leading-relaxed italic">
                    &quot;{item.content}&quot;
                  </p>
                </div>

                {/* User Info Footer */}
                <div className="flex items-center space-x-3.5 pt-4 border-t border-[#27272a]/60">
                  <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center text-white font-extrabold text-sm shadow-md group-hover:scale-105 transition-transform`}>
                    {item.avatar}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">{item.name}</span>
                    <span className="text-[11px] text-[#a1a1aa] font-medium">{item.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative z-10 py-20 px-6 border-t border-[#27272a]/60 bg-[#09090b]/60 scroll-mt-12">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-widest bg-purple-500/10 px-3.5 py-1.5 rounded-full border border-purple-500/20">
              Got Questions?
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <Accordion
            items={faqs.map((faq, idx) => ({
              id: aq-,
              title: faq.q,
              content: faq.a,
            }))}
            type="single"
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-[#27272a]/60 py-8 text-xs text-[#71717a] bg-[#09090b]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
              T
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-white font-bold">TrustPay Escrow</span>
              <span>© {new Date().getFullYear()} TrustPay Escrow. Built for Stellar Network.</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
            <Link href="/projects" className="hover:text-white transition-colors">Projects Portal</Link>
            <Link href="/projects/create" className="hover:text-white transition-colors">Create Escrow</Link>
            <a href="#how-it-works" className="hover:text-white transition-colors">Docs</a>
            <span className="hidden sm:inline-block w-px h-3 bg-[#3f3f46]" aria-hidden="true" />
            <a
              href="https://github.com/trustpay-escrow/trustpay-escrow"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TrustPay Escrow on GitHub"
              className="group inline-flex items-center gap-1.5 transition-all duration-300 hover:text-white hover:scale-105"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-[#a1a1aa] group-hover:text-white transition-colors duration-300" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.995 7.995 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              GitHub
            </a>
            <a
              href="https://developers.stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Stellar documentation"
              className="group inline-flex items-center gap-1.5 transition-all duration-300 hover:text-white hover:scale-105"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-[#a1a1aa] group-hover:text-white transition-colors duration-300" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              Stellar Docs
            </a>
            <a
              href="https://www.drips.network/wave"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Drips Wave"
              className="group inline-flex items-center gap-1.5 transition-all duration-300 hover:text-white hover:scale-105"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-[#a1a1aa] group-hover:text-white transition-colors duration-300" aria-hidden="true">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
              Drips Wave
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}


