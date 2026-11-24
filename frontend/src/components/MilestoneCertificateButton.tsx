'use client';

import React, { useState } from 'react';
import type { Milestone, Project } from '@/types';
import { MilestoneCertificateModal } from './MilestoneCertificateModal';

export interface MilestoneCertificateButtonProps {
  project: Project;
  milestone?: Milestone;
  txHash?: string;
  label?: string;
  className?: string;
}

/**
 * MilestoneCertificateButton (#310)
 *
 * Compact entry point used across dashboards: opens the certificate preview
 * for an approved milestone without each caller managing modal state.
 */
export function MilestoneCertificateButton({
  project,
  milestone,
  txHash,
  label = 'Certificate',
  className = '',
}: MilestoneCertificateButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        data-testid="milestone-certificate-button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300 transition-colors hover:bg-amber-500/20 ${className}`}
      >
        <span aria-hidden="true">🏅</span>
        {label}
      </button>

      <MilestoneCertificateModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        project={project}
        milestone={milestone}
        txHash={txHash}
      />
    </>
  );
}

export default MilestoneCertificateButton;
