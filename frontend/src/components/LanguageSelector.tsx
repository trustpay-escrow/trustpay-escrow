'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useI18n, SupportedLocale } from '@/lib/i18n';

export function LanguageSelector({ className = '' }: { className?: string }) {
  const { locale, setLocale, supportedLocales } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentOption = supportedLocales.find((l) => l.code === locale) || supportedLocales[0];

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-xs font-semibold text-[#a1a1aa] hover:text-white transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        title="Select Language"
        aria-label="Select Language"
      >
        <span className="text-base">{currentOption.flag}</span>
        <span className="uppercase tracking-wider">{currentOption.code}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 text-[#71717a] ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 rounded-xl bg-[#121215] border border-[#27272a] shadow-xl py-1.5 z-50 animate-fadeIn backdrop-blur-xl">
          <div className="px-3 py-1 text-[10px] font-bold text-[#71717a] uppercase tracking-wider">
            Language / Idioma
          </div>
          {supportedLocales.map((item) => {
            const isSelected = item.code === locale;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  setLocale(item.code as SupportedLocale);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-blue-600/15 text-blue-400 font-bold'
                    : 'text-[#d4d4d8] hover:bg-[#27272a] hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-base">{item.flag}</span>
                  <span>{item.label}</span>
                </div>
                {isSelected && <span className="text-blue-400 text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageSelector;
