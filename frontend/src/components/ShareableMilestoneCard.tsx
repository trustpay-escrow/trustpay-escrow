'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Milestone, Project } from '@/types';
import { getStellarExplorerUrl } from '@/lib/soroban';
import {
  buildShareFilename,
  buildShareText,
  buildTwitterIntentUrl,
  CARD_HEIGHT,
  CARD_WIDTH,
  CardTheme,
  deriveShareCardData,
  downloadBlob,
  formatCardAmount,
  renderElementToPng,
  ShareCardData,
  truncateMiddle,
  truncateTitle,
} from '@/lib/share-card';

const PREVIEW_SCALE = 0.5;

/**
 * Palette as plain hex/rgb on purpose: html2canvas cannot parse the oklch()
 * colours Tailwind v4 emits, so nothing inside the captured card may use
 * Tailwind classes or CSS variables.
 */
const THEMES: Record<
  CardTheme,
  { background: string; text: string; muted: string; accent: string; panel: string; panelBorder: string; stamp: string }
> = {
  dark: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #0e7490 100%)',
    text: '#ffffff',
    muted: '#cbd5e1',
    accent: '#34d399',
    panel: 'rgba(15, 23, 42, 0.55)',
    panelBorder: 'rgba(148, 163, 184, 0.35)',
    stamp: '#34d399',
  },
  light: {
    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #cffafe 100%)',
    text: '#0f172a',
    muted: '#475569',
    accent: '#047857',
    panel: 'rgba(255, 255, 255, 0.75)',
    panelBorder: 'rgba(100, 116, 139, 0.35)',
    stamp: '#047857',
  },
};

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function CardFace({ data, theme, testId }: { data: ShareCardData; theme: CardTheme; testId: string }) {
  const c = THEMES[theme];
  const heading = data.kind === 'project' ? 'Project Completed' : 'Milestone Completed';
  const title = truncateTitle(data.projectTitle, 70);
  return (
    <div
      data-testid={testId}
      data-theme-name={theme}
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        boxSizing: 'border-box',
        padding: 64,
        background: c.background,
        color: c.text,
        fontFamily: FONT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Brand row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: c.accent,
              color: theme === 'dark' ? '#052e16' : '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            ✓
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 0.5 }}>TrustPay Escrow</div>
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: c.accent,
            border: `2px solid ${c.accent}`,
            borderRadius: 999,
            padding: '8px 20px',
          }}
        >
          {heading}
        </div>
      </div>

      {/* Main */}
      <div>
        <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.1, maxWidth: 1000 }}>{title}</div>
        {data.kind === 'milestone' && data.milestoneTitle && (
          <div style={{ fontSize: 30, color: c.muted, marginTop: 14 }}>
            {truncateTitle(data.milestoneTitle, 80)}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, marginTop: 28 }}>
          <div style={{ fontSize: 84, fontWeight: 800, color: c.accent }} data-testid={`${testId}-amount`}>
            {formatCardAmount(data.amount, data.token)}
          </div>
          <div style={{ fontSize: 26, color: c.muted }}>released from escrow</div>
        </div>
        {data.rating !== undefined && (
          <div style={{ fontSize: 34, marginTop: 14, color: '#fbbf24' }} aria-label={`Rated ${data.rating} out of 5`}>
            {'★'.repeat(data.rating)}
            <span style={{ color: c.muted }}>{'★'.repeat(5 - data.rating)}</span>
          </div>
        )}
      </div>

      {/* Stellar verification stamp */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: c.panel,
          border: `1px solid ${c.panelBorder}`,
          borderRadius: 20,
          padding: '20px 28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              border: `3px solid ${c.stamp}`,
              color: c.stamp,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              fontWeight: 800,
            }}
          >
            ✓
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: c.stamp }}>Verified on Stellar</div>
            <div style={{ fontSize: 18, color: c.muted }}>
              {data.verificationType === 'none' || !data.verificationId
                ? 'Settled on the Stellar network'
                : `${data.verificationType === 'tx' ? 'Tx' : 'Contract'} ${truncateMiddle(data.verificationId, 8, 8)}`}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 18, color: c.muted }}>Trustless milestone payments</div>
      </div>
    </div>
  );
}

export interface ShareableMilestoneCardProps {
  project: Project;
  milestone?: Milestone;
  /** Optional 1-5 contractor rating shown as stars. */
  rating?: number;
  /** Link included in the tweet. Defaults to the Stellar Expert page for the settlement. */
  shareUrl?: string;
  initialTheme?: CardTheme;
}

export function ShareableMilestoneCard({
  project,
  milestone,
  rating,
  shareUrl,
  initialTheme = 'dark',
}: ShareableMilestoneCardProps) {
  const [theme, setTheme] = useState<CardTheme>(initialTheme);
  const [busy, setBusy] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
  const data = deriveShareCardData(project, milestone, rating);

  const resolveShareUrl = useCallback((): string | undefined => {
    if (shareUrl) return shareUrl;
    if (data?.verificationId && data.verificationType !== 'none') {
      return getStellarExplorerUrl(data.verificationId, data.verificationType);
    }
    return typeof window !== 'undefined' ? window.location.origin : undefined;
  }, [shareUrl, data]);

  if (!data) return null;

  const handleDownload = async () => {
    const node = captureRef.current?.firstElementChild as HTMLElement | null;
    if (!node) return;
    setBusy(true);
    try {
      const blob = await renderElementToPng(node);
      downloadBlob(blob, buildShareFilename(data.milestoneTitle || data.projectTitle, data.kind));
      toast.success('Image downloaded');
    } catch (err) {
      console.error('Share card render failed', err);
      toast.error('Could not generate the image. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleShare = () => {
    const url = buildTwitterIntentUrl({ text: buildShareText(data), url: resolveShareUrl() });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div
          style={{ width: CARD_WIDTH * PREVIEW_SCALE, height: CARD_HEIGHT * PREVIEW_SCALE, overflow: 'hidden', borderRadius: 12 }}
        >
          <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
            <CardFace data={data} theme={theme} testId="share-card-preview" />
          </div>
        </div>
      </div>

      {/* Full-size capture source, kept off-screen so the preview's CSS scale never touches the export. */}
      <div aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }}>
        <div ref={captureRef}>
          <CardFace data={data} theme={theme} testId="share-card-capture" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Card theme" className="inline-flex rounded-lg border border-[#27272a] overflow-hidden">
          {(['dark', 'light'] as CardTheme[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={theme === t}
              onClick={() => setTheme(t)}
              className={`px-3 py-1.5 text-xs font-semibold capitalize ${
                theme === t ? 'bg-blue-600 text-white' : 'bg-[#18181b] text-[#a1a1aa] hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold"
        >
          {busy ? 'Generating…' : 'Download PNG'}
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-[#18181b] border border-[#3f3f46] text-white text-xs font-bold"
        >
          Share to X
        </button>
      </div>
    </div>
  );
}

export interface ShareMilestoneButtonProps {
  project: Project;
  milestone?: Milestone;
  rating?: number;
  className?: string;
}

/**
 * Entry point for dashboards: a "Share" button that opens the card in a
 * dialog. Renders nothing until there is a finished milestone or project
 * to celebrate.
 */
export function ShareMilestoneButton({ project, milestone, rating, className = '' }: ShareMilestoneButtonProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!deriveShareCardData(project, milestone, rating)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          'px-3.5 py-1.5 bg-[#18181b] hover:bg-[#27272a] text-white text-xs font-bold rounded-xl border border-[#3f3f46] shadow-md transition-all active:scale-95'
        }
      >
        Share Achievement
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Share achievement"
            className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 sm:p-5 max-w-[calc(100vw-1.5rem)] max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Share your achievement</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close share dialog"
                className="text-[#a1a1aa] hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>
            <ShareableMilestoneCard project={project} milestone={milestone} rating={rating} />
          </div>
        </div>
      )}
    </>
  );
}
