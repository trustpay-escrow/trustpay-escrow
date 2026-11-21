'use client';

import React from 'react';
import { CryptoId } from '@/components/ui/CryptoId';
import { ZkAttestationBadge } from './ZkAttestationBadge';
import type { ApplicantCardData } from './ApplicantCard';

export interface FreelancerProfileModalProps {
  applicant: ApplicantCardData | null;
  onClose: () => void;
}

export function FreelancerProfileModal({ applicant, onClose }: FreelancerProfileModalProps) {
  if (!applicant) return null;

  const walletAddr = applicant.stellar_address || applicant.freelancer_address || applicant.name || '';
  const coverText = applicant.cover_note || applicant.pitch || 'No cover note provided.';
  const portfolioUrl = applicant.portfolio_url;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md" onClick={onClose}>
      <div
        className="bg-[#18181b] border border-[#3f3f46] rounded-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#27272a]">
          <div>
            <h3 className="text-lg font-bold text-white">Freelancer Privacy Profile</h3>
            <p className="text-xs text-[#a1a1aa] mt-1">ZK reputation is verified without exposing counterparty history.</p>
          </div>
          <button onClick={onClose} className="text-[#a1a1aa] hover:text-white text-lg" aria-label="Close profile">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">Stellar Address</span>
            <CryptoId value={walletAddr} className="text-sm text-white bg-[#232326] px-3 py-1.5 rounded-xl border border-[#333338] break-all" />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">ZK Attestation</span>
            <div>
              <ZkAttestationBadge attestation={applicant.zk_attestation} />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">Cover Note</span>
            <p className="text-sm text-[#a1a1aa] leading-relaxed whitespace-pre-line bg-[#1c1c20] p-3.5 rounded-xl border border-[#27272a]">
              &quot;{coverText}&quot;
            </p>
          </div>

          {portfolioUrl && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">Portfolio</span>
              <a
                href={portfolioUrl.startsWith('http') ? portfolioUrl : `https://${portfolioUrl}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium hover:underline"
              >
                {portfolioUrl} ↗
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
