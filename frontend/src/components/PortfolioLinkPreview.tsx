'use client';

import React from 'react';

export interface PortfolioLinkPreviewProps {
  url: string;
  className?: string;
}

export type PlatformType =
  | 'github'
  | 'figma'
  | 'dribbble'
  | 'behance'
  | 'twitter'
  | 'linkedin'
  | 'website'
  | 'suspicious';

export interface ParsedLinkInfo {
  platform: PlatformType;
  displayUrl: string;
  safeHref: string;
  isSuspicious: boolean;
}

export function parsePortfolioUrl(rawUrl: string): ParsedLinkInfo {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      platform: 'suspicious',
      displayUrl: 'Invalid Link',
      safeHref: '#',
      isSuspicious: true,
    };
  }

  const trimmed = rawUrl.trim();

  // Flag suspicious protocols immediately
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return {
      platform: 'suspicious',
      displayUrl: 'Suspicious Link',
      safeHref: '#',
      isSuspicious: true,
    };
  }

  // Ensure standard protocol for URL parser
  const fullUrl =
    lower.startsWith('http://') || lower.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;

  try {
    const parsed = new URL(fullUrl);
    const hostname = parsed.hostname.toLowerCase();

    // Check for IP addresses or localhosts as suspicious in public portfolio
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    if (isIp || hostname === 'localhost') {
      return {
        platform: 'suspicious',
        displayUrl: `${hostname}${parsed.pathname}`,
        safeHref: fullUrl,
        isSuspicious: true,
      };
    }

    let platform: PlatformType = 'website';
    if (hostname.includes('github.com')) {
      platform = 'github';
    } else if (hostname.includes('figma.com')) {
      platform = 'figma';
    } else if (hostname.includes('dribbble.com')) {
      platform = 'dribbble';
    } else if (hostname.includes('behance.net')) {
      platform = 'behance';
    } else if (hostname.includes('twitter.com') || hostname === 'x.com') {
      platform = 'twitter';
    } else if (hostname.includes('linkedin.com')) {
      platform = 'linkedin';
    }

    // Clean truncated display string (e.g. github.com/user/repo)
    let display = parsed.hostname.replace(/^www\./, '') + parsed.pathname;
    if (display.endsWith('/')) {
      display = display.slice(0, -1);
    }

    return {
      platform,
      displayUrl: display,
      safeHref: fullUrl,
      isSuspicious: false,
    };
  } catch {
    return {
      platform: 'suspicious',
      displayUrl: trimmed,
      safeHref: '#',
      isSuspicious: true,
    };
  }
}

export function PortfolioLinkPreview({
  url,
  className = '',
}: PortfolioLinkPreviewProps) {
  const { platform, displayUrl, safeHref, isSuspicious } = parsePortfolioUrl(url);

  const getPlatformIcon = () => {
    switch (platform) {
      case 'github':
        return '🐙';
      case 'figma':
        return '🎨';
      case 'dribbble':
        return '🏀';
      case 'behance':
        return '🅱️';
      case 'twitter':
        return '🐦';
      case 'linkedin':
        return '💼';
      case 'suspicious':
        return '⚠️';
      default:
        return '🌐';
    }
  };

  if (isSuspicious) {
    return (
      <span
        data-testid="suspicious-link-badge"
        className={`inline-flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl font-medium ${className}`}
      >
        <span>⚠️</span>
        <span className="truncate max-w-[200px]" title={url}>
          {displayUrl}
        </span>
        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold uppercase">
          Warning
        </span>
      </span>
    );
  }

  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="portfolio-link-chip"
      data-platform={platform}
      className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all duration-200 max-w-full group hover:shadow-sm ${
        platform === 'github'
          ? 'bg-[#18181b] hover:bg-[#27272a] text-white border-[#3f3f46]'
          : platform === 'figma'
          ? 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-purple-500/20'
          : platform === 'dribbble'
          ? 'bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border-pink-500/20'
          : platform === 'behance'
          ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border-blue-500/20'
          : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border-indigo-500/20'
      } ${className}`}
    >
      <span className="text-sm" aria-hidden="true">
        {getPlatformIcon()}
      </span>
      <span className="truncate max-w-[220px]" title={safeHref}>
        {displayUrl}
      </span>
      <span className="text-xs opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
        ↗
      </span>
    </a>
  );
}

export default PortfolioLinkPreview;
