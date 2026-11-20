'use client';

import React from 'react';
import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';
import LanguageSelector from '@/components/LanguageSelector';
import { useI18n } from '@/lib/i18n';

interface HeaderProps {
  showDashboardLink?: boolean;
}

export function Header({ showDashboardLink = true }: HeaderProps) {
  const { t } = useI18n();

  return (
    <header className="w-full border-b border-[#27272a]/60 bg-[#09090b]/80 backdrop-blur-xl sticky top-0 z-50 px-6 py-4 transition-all">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform font-black text-xl">
            T
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg text-white tracking-tight group-hover:text-blue-400 transition-colors">
              TRUSTPAY
            </span>
            <span className="text-[10px] text-[#a1a1aa] font-medium tracking-wider uppercase">
              Stellar Escrow
            </span>
          </div>
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#052e16] text-[#22c55e] border border-[#14532d] ml-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse"></span>
            Stellar Testnet
          </span>
        </Link>

        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-[#a1a1aa]">
          <a href="#how-it-works" className="hover:text-white transition-colors">
            {t('nav.howItWorks')}
          </a>
          <a href="#features" className="hover:text-white transition-colors">
            {t('nav.features')}
          </a>
          <a href="#testimonials" className="hover:text-white transition-colors">
            {t('nav.testimonials')}
          </a>
          <a href="#wallet" className="hover:text-white transition-colors">
            {t('nav.connectWallet')}
          </a>
          <a href="#faq" className="hover:text-white transition-colors">
            {t('nav.faq')}
          </a>
        </nav>

        <div className="flex items-center space-x-3">
          <LanguageSelector />
          <NotificationBell />
          {showDashboardLink && (
            <Link
              href="/projects"
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 border border-blue-500/30 transition-all hover:shadow-blue-600/30 hover:-translate-y-0.5"
            >
              {t('nav.launchDashboard')} ↗
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
