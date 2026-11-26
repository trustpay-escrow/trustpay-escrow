'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AccessibleModal } from '@/components/a11y/AccessibleModal';

export interface EmbeddedDemoSandboxProps {
  url: string;
  title?: string;
  className?: string;
}

type SandboxPlatform = 'codesandbox' | 'stackblitz' | 'codepen' | 'gist' | 'generic';

function detectPlatform(rawUrl: string): SandboxPlatform {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    if (host.includes('codesandbox.io')) return 'codesandbox';
    if (host.includes('stackblitz.com')) return 'stackblitz';
    if (host.includes('codepen.io')) return 'codepen';
    if (host.includes('gist.github.com')) return 'gist';
  } catch {
    // fallthrough
  }
  return 'generic';
}

export function getEmbedUrl(rawUrl: string): string {
  const platform = detectPlatform(rawUrl);
  try {
    const parsed = new URL(rawUrl);
    if (platform === 'codesandbox') {
      const segments = parsed.pathname.split('/').filter(Boolean);
      const id = segments[segments.length - 1];
      return id ? `https://codesandbox.io/embed/${id}` : rawUrl;
    }
    if (platform === 'stackblitz') {
      return rawUrl;
    }
    if (platform === 'codepen') {
      const match = parsed.pathname.match(/\/([^/]+)\/(?:pen|embed)\/([^/?#]+)/);
      if (match) {
        return `https://codepen.io/${match[1]}/embed/${match[2]}`;
      }
      return rawUrl;
    }
    if (platform === 'gist') {
      return rawUrl.endsWith('.pibb') ? rawUrl : `${rawUrl}.pibb`;
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

const PLATFORM_LABELS: Record<SandboxPlatform, string> = {
  codesandbox: 'CodeSandbox',
  stackblitz: 'StackBlitz',
  codepen: 'CodePen',
  gist: 'GitHub Gist',
  generic: 'Live Demo',
};

export function EmbeddedDemoSandbox({ url, title, className = '' }: EmbeddedDemoSandboxProps) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const embedUrl = useMemo(() => getEmbedUrl(url), [url]);
  const platform = detectPlatform(url);

  const handleOpenExternal = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Demo link copied!');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const iframe = (
    <iframe
      src={embedUrl}
      title={title || 'Embedded demo sandbox'}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      className="w-full h-full border-0 bg-white"
      onLoad={() => setLoading(false)}
      onError={() => {
        setLoading(false);
        setFailed(true);
      }}
    />
  );

  const skeleton = (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#18181b]">
      <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-[#a1a1aa]">Loading {PLATFORM_LABELS[platform]} sandbox...</p>
    </div>
  );

  const fallback = (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#18181b] p-4 text-center">
      <p className="text-xs text-[#a1a1aa]">
        The embedded sandbox could not be loaded. Open the demo directly instead.
      </p>
      <button
        onClick={handleOpenExternal}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors"
      >
        Open Demo ↗
      </button>
    </div>
  );

  return (
    <>
      <div className={`rounded-2xl border border-[#27272a] bg-[#18181b] overflow-hidden ${className}`}>
        {/* Sandbox toolbar */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-[#1c1c20] border-b border-[#27272a]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              {PLATFORM_LABELS[platform]}
            </span>
            <span className="text-[11px] text-[#71717a] truncate">{title || url}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="p-1.5 text-[#a1a1aa] hover:text-white transition-colors"
              aria-label="Expand sandbox to full screen"
              title="Expand sandbox to full screen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-1.5 text-[#a1a1aa] hover:text-white transition-colors"
              aria-label="Copy demo link"
              title="Copy demo link"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleOpenExternal}
              className="p-1.5 text-[#a1a1aa] hover:text-white transition-colors"
              aria-label="Open demo in new tab"
              title="Open in new tab"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sandboxed iframe viewport */}
        <div className="relative h-72 sm:h-80">
          {loading && skeleton}
          {failed ? fallback : iframe}
        </div>
      </div>

      {/* Full-screen expansion overlay */}
      <AccessibleModal
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        closeOnBackdropClick={false}
        ariaLabel={`${PLATFORM_LABELS[platform]} full-screen sandbox`}
        backdropClassName="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex flex-col"
        dialogClassName="flex-1 flex flex-col w-full h-full"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              {PLATFORM_LABELS[platform]}
            </span>
            <span className="text-xs text-[#a1a1aa] truncate">{title || url}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            aria-label="Close full-screen sandbox"
            className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs font-bold rounded-xl transition-colors"
          >
            Close <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className="flex-1 relative bg-white">
          {iframe}
        </div>
      </AccessibleModal>
    </>
  );
}
