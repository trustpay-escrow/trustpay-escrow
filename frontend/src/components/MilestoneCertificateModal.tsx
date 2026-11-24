'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Milestone, Project } from '@/types';
import {
  buildCertificateSvg,
  downloadCertificatePdf,
  downloadCertificateSvg,
  getCertificateFilename,
  getCertificateVerificationUrl,
  type MilestoneCertificateData,
} from '@/lib/receipt-generator';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useA11yAnnouncer } from './A11yLiveAnnouncer';

export interface MilestoneCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  milestone?: Milestone;
  /** Overrides the project's stored transaction hash. */
  txHash?: string;
  issuedAt?: string;
  className?: string;
}

export function buildCertificateData({
  project,
  milestone,
  txHash,
  issuedAt,
}: Pick<MilestoneCertificateModalProps, 'project' | 'milestone' | 'txHash' | 'issuedAt'>): MilestoneCertificateData {
  const resolvedMilestone =
    milestone ||
    project.milestones?.find((item) => item.status === 'approved') ||
    project.milestones?.[0];

  return {
    projectTitle: project.title,
    milestoneTitle: resolvedMilestone?.title || 'Project completion',
    milestoneIndex: resolvedMilestone?.milestone_index,
    amount: resolvedMilestone?.amount ?? project.budget ?? 0,
    token: project.token || 'USDC',
    freelancerAddress: project.freelancer_address,
    clientAddress: project.client_address,
    txHash: txHash || project.tx_hash,
    contractId: project.contract_id,
    issuedAt:
      issuedAt ||
      resolvedMilestone?.auto_release_at ||
      resolvedMilestone?.submitted_at ||
      project.created_at ||
      new Date().toISOString(),
  };
}

/**
 * MilestoneCertificateModal (#310)
 *
 * Print-ready, shareable credential for an approved milestone. Renders the
 * vector certificate inline, offers one-click SVG/PDF download, copies a
 * shareable project link and traps keyboard focus while open.
 */
export function MilestoneCertificateModal({
  isOpen,
  onClose,
  project,
  milestone,
  txHash,
  issuedAt,
  className = '',
}: MilestoneCertificateModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { announce } = useA11yAnnouncer();
  const dialogRef = useFocusTrap<HTMLDivElement>({
    active: isOpen,
    onEscape: onClose,
  });

  const certificateData = useMemo(
    () => buildCertificateData({ project, milestone, txHash, issuedAt }),
    [project, milestone, txHash, issuedAt]
  );
  const svgMarkup = useMemo(() => buildCertificateSvg(certificateData), [certificateData]);
  const verificationUrl = getCertificateVerificationUrl(certificateData);

  if (!isOpen) return null;

  const notify = (message: string) => {
    announce(message);
    toast.success(message);
  };

  const handleDownloadSvg = () => {
    downloadCertificateSvg(certificateData);
    notify('Certificate SVG downloaded');
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    announce('Generating PDF certificate');
    try {
      await downloadCertificatePdf(certificateData);
      notify('Certificate PDF exported');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not export the certificate PDF';
      announce(message, 'assertive');
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyLink = async () => {
    const shareLink =
      typeof window === 'undefined'
        ? `/projects/${project.id}`
        : `${window.location.origin}/projects/${project.id}${
            milestone ? `?certificate=${encodeURIComponent(milestone.id)}` : ''
          }`;
    try {
      await navigator.clipboard.writeText(shareLink);
      notify('Shareable certificate link copied');
    } catch {
      toast.error('Could not copy the shareable link');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-md sm:p-6"
      onClick={onClose}
      data-testid="certificate-modal-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="certificate-modal-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-amber-500/30 bg-[#0b1120] p-4 shadow-2xl custom-scrollbar sm:p-6 ${className}`}
        data-testid="certificate-modal"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="certificate-modal-title" className="text-lg font-bold text-white sm:text-xl">
              Milestone Completion Certificate
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {project.title} · {certificateData.milestoneTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close certificate preview"
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div
          data-testid="certificate-preview"
          className="overflow-hidden rounded-xl border border-amber-500/20 bg-[#0b1120] [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>
            Verify on-chain:{' '}
            <a
              href={verificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-cyan-300 underline decoration-cyan-500/40 underline-offset-2 hover:text-cyan-200"
            >
              Stellar Expert
            </a>
          </span>
          <span className="font-mono" data-testid="certificate-filename">
            {getCertificateFilename(certificateData)}
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => void handleCopyLink()}
            data-testid="copy-certificate-link"
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800"
          >
            🔗 Copy Shareable Link
          </button>
          <button
            type="button"
            onClick={handleDownloadSvg}
            data-testid="download-certificate-svg"
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-500/20"
          >
            Download SVG
          </button>
          <button
            type="button"
            onClick={() => void handleExportPdf()}
            disabled={isExporting}
            data-testid="export-certificate-pdf"
            className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 px-4 py-2 text-xs font-bold text-slate-950 transition-all hover:from-amber-400 hover:to-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MilestoneCertificateModal;
