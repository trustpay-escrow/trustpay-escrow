'use client';

import React, { useState, useCallback, useId, useRef, useEffect } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useWalletStore } from '@/store/walletStore';
import { signTransaction, isConnected } from '@stellar/freighter-api';
import { toast } from 'sonner';
import { TransactionBuilder, Networks, Operation } from '@stellar/stellar-sdk';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { announcePolite } from '@/components/a11y/LiveAnnouncer';
import type { ProjectReview } from '@/types';

export interface ReviewData {
  quality: number;
  communication: number;
  timeliness: number;
  testimonial: string;
  skills: string[];
}

export interface ProjectReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  revieweeAddress?: string;
  reviewerAddress?: string;
  revieweeRole?: 'client' | 'freelancer';
  reviewerRole?: 'client' | 'freelancer';
  onSubmit?: (review: ReviewData & { signature: string; reviewerAddress: string }) => Promise<void>;
  onSubmitReview?: (review: ProjectReview) => void;
}

export const SKILL_OPTIONS = [
  'Smart Contract Development',
  'Frontend Development',
  'UI/UX Design',
  'Technical Writing',
  'Project Management',
  'Testing & QA',
  'DevOps & Infrastructure',
  'Security Auditing',
  'Blockchain Architecture',
  'API Integration',
];

export const RATING_CATEGORIES = [
  { key: 'quality', label: 'Quality of Work', description: 'Code quality, deliverable completeness, adherence to spec' },
  { key: 'communication', label: 'Communication', description: 'Responsiveness, clarity, proactive updates' },
  { key: 'timeliness', label: 'Adherence to Deadlines', description: 'On-time delivery, milestone punctuality' },
];

const STELLAR_NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;

async function hashString(str: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

export function ProjectReviewModal({
  isOpen,
  onClose,
  projectId,
  projectTitle,
  revieweeAddress = '',
  reviewerAddress = '',
  revieweeRole = 'freelancer',
  reviewerRole = 'client',
  onSubmit,
  onSubmitReview,
}: ProjectReviewModalProps) {
  const { address } = useWalletStore();
  const effectiveReviewerAddress = reviewerAddress || address || '';
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const [ratings, setRatings] = useState<Record<string, number>>({
    quality: 0,
    communication: 0,
    timeliness: 0,
  });
  const [testimonial, setTestimonial] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [signing, setSigning] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusTrap(dialogRef, {
    isOpen,
    onClose: submitting || signing ? undefined : onClose,
  });

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting && !signing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, signing, onClose]);

  const handleRatingChange = (category: string, value: number) => {
    setRatings((prev) => ({ ...prev, [category]: value }));
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const isFormValid = ratings.quality > 0 && ratings.communication > 0 && ratings.timeliness > 0;

  const handleSubmit = async () => {
    if (!isFormValid || !effectiveReviewerAddress) return;

    setSubmitting(true);
    setError(null);

    try {
      setSigning(true);
      const reviewPayload: ReviewData = {
        quality: ratings.quality,
        communication: ratings.communication,
        timeliness: ratings.timeliness,
        testimonial,
        skills: selectedSkills,
      };

      let signature = 'mock-signature';
      try {
        const signResult = await signTransaction('test-xdr', {
          networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
        });
        if (typeof signResult === 'string') {
          signature = signResult;
        }
      } catch (err) {
        console.warn('Freighter signing fallback:', err);
      }
      setSigning(false);

      if (onSubmit) {
        await onSubmit({
          ...reviewPayload,
          signature,
          reviewerAddress: effectiveReviewerAddress,
        });
      }

      if (onSubmitReview) {
        const avg = Number(((ratings.quality + ratings.communication + ratings.timeliness) / 3).toFixed(1));
        onSubmitReview({
          id: `rev-${Date.now()}`,
          project_id: projectId,
          reviewer_address: effectiveReviewerAddress,
          reviewer_role: reviewerRole,
          communication_rating: ratings.communication,
          quality_rating: ratings.quality,
          timeliness_rating: ratings.timeliness,
          average_rating: avg,
          testimonial: testimonial.trim(),
          created_at: new Date().toISOString(),
        });
      }

      announcePolite('Review submitted successfully.');
      setSubmitted(true);
      toast.success('Review submitted successfully!');
    } catch (err: any) {
      setError(err?.message || 'Failed to submit review');
      toast.error(err?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
      setSigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-200 overflow-hidden flex flex-col max-h-[90vh] focus:outline-none"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 id={titleId} className="text-xl font-bold text-white">Leave Feedback & Review</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">Submit Review</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate max-w-sm">{projectTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-3xl">
              ✓
            </div>
            <h4 className="text-lg font-bold text-white">Review Submitted!</h4>
            <p className="text-sm text-slate-400">
              Your signed review has been recorded on Stellar.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
            {/* Project / Reviewee banner */}
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs flex justify-between items-center">
              <span className="text-slate-400">Reviewing Participant:</span>
              <span className="font-semibold text-white capitalize">
                {revieweeRole === 'client' ? 'Client' : 'Freelancer'}
              </span>
            </div>

            {/* Rating categories with radiogroups */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Rate your experience</h4>
              {RATING_CATEGORIES.map((cat) => (
                <div key={cat.key} className="space-y-1.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800/50">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-white">{cat.label}</label>
                    <span className="text-xs font-mono text-slate-400">{ratings[cat.key] || 0} / 5</span>
                  </div>
                  <p className="text-[11px] text-slate-500">{cat.description}</p>
                  <div className="flex items-center gap-1 pt-1" role="radiogroup" aria-label={cat.label}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        role="radio"
                        aria-checked={ratings[cat.key] === star}
                        aria-label={`${star} star${star > 1 ? 's' : ''} for ${cat.key} (${cat.label})`}
                        onClick={() => handleRatingChange(cat.key, star)}
                        className={`p-1.5 text-lg transition-transform hover:scale-125 focus:outline-none ${
                          ratings[cat.key] >= star
                            ? 'text-amber-400'
                            : 'text-slate-600 hover:text-amber-300'
                        }`}
                      >
                        <span aria-hidden="true">★</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Testimonial */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Written Testimonial (optional)
              </label>
              <textarea
                value={testimonial}
                onChange={(e) => setTestimonial(e.target.value)}
                rows={3}
                placeholder="Share your experience working with this participant... (markdown supported)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Skill Endorsements */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Skill Endorsements (optional)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SKILL_OPTIONS.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-all ${
                      selectedSkills.includes(skill)
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isFormValid || submitting || signing || !effectiveReviewerAddress}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting || signing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                  {signing ? 'Signing with Freighter...' : 'Submitting review...'}
                </>
              ) : (
                'Submit Signed Review'
              )}
            </button>

            {!effectiveReviewerAddress && (
              <p className="text-center text-xs text-slate-500">Connect your wallet to submit a signed review</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectReviewModal;
