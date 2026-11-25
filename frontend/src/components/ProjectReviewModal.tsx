'use client';

import React, { useState, useCallback } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useWalletStore } from '@/store/walletStore';
import { signTransaction, isConnected } from '@stellar/freighter-api';
import { toast } from 'sonner';
import { nativeToScVal, xdr, TransactionBuilder, Networks, Operation } from '@stellar/stellar-sdk';

interface ReviewData {
  quality: number;
  communication: number;
  timeliness: number;
  testimonial: string;
  skills: string[];
}

interface ProjectReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  revieweeAddress: string;
  revieweeRole: 'client' | 'freelancer';
  reviewerRole: 'client' | 'freelancer';
  onSubmit?: (review: ReviewData & { signature: string; reviewerAddress: string }) => Promise<void>;
}

const SKILL_OPTIONS = [
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

const RATING_CATEGORIES = [
  { key: 'quality', label: 'Quality of Work', description: 'Code quality, deliverable completeness, adherence to spec' },
  { key: 'communication', label: 'Communication', description: 'Responsiveness, clarity, proactive updates' },
  { key: 'timeliness', label: 'Adherence to Deadlines', description: 'On-time delivery, milestone punctuality' },
];

const STELLAR_NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;

function useReviewSignature() {
  const { address } = useWalletStore();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signReview = useCallback(async (reviewData: ReviewData): Promise<string | null> => {
    if (!address) {
      setError('Wallet not connected');
      return null;
    }

    setSigning(true);
    setError(null);

    try {
      if (!(await isConnected())) {
        throw new Error('Freighter wallet extension is not detected. Please install and unlock Freighter.');
      }

      // Create a deterministic message to sign: projectId + ratings + testimonial hash
      const message = JSON.stringify({
        projectId: reviewData.projectId,
        ratings: {
          quality: reviewData.quality,
          communication: reviewData.communication,
          timeliness: reviewData.timeliness,
        },
        testimonialHash: await hashString(reviewData.testimonial),
        skills: reviewData.skills.sort(),
        reviewerRole: reviewData.reviewerRole,
        timestamp: Date.now(),
      });

      // Sign using Freighter's signTransaction with a dummy transaction
      // We'll use a simpler approach: sign a challenge message
      const challengeXdr = btoa(message);

      // For simplicity, we'll use the SEP-0010 approach or a custom message signing
      // Since Freighter doesn't expose arbitrary message signing directly,
      // we'll create a minimal transaction that encodes our review data
      const server = new (await import('@stellar/stellar-sdk')).rpc.Server(
        process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org'
      );

      const sourceAccount = await server.getAccount(address);
      
      // Build a transaction with a manageData operation containing the review hash
      const reviewHash = await hashString(message);
      const tx = new TransactionBuilder(sourceAccount, {
        fee: '100000',
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
      })
        .addOperation(Operation.manageData({
          name: `review_${reviewHash.slice(0, 32)}`,
          value: reviewHash.slice(0, 64),
        }))
        .setTimeout(30)
        .build();

      const preparedTx = await server.prepareTransaction(tx);
      const signResult = await signTransaction(preparedTx.toXDR(), {
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
      });

      let signedXdr = '';
      if (typeof signResult === 'string') {
        signedXdr = signResult;
      } else if (signResult && typeof signResult === 'object') {
        if (signResult.error) {
          throw new Error(typeof signResult.error === 'string' ? signResult.error : (signResult.error.message || 'Freighter rejected signature'));
        }
        signedXdr = signResult.signedTxXdr || signResult.signedTransaction || '';
      }

      if (!signedXdr) {
        throw new Error('Review signing was rejected or returned empty XDR.');
      }

      // Send the transaction to anchor the review on-chain
      const signedTx = TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE);
      const sendRes = await server.sendTransaction(signedTx);

      if (sendRes.status === 'ERROR') {
        throw new Error(`Review transaction rejected: ${sendRes.errorResult ? JSON.stringify(sendRes.errorResult) : sendRes.status}`);
      }

      return sendRes.hash;
    } catch (err: any) {
      const msg = err.message || String(err);
      setError(msg);
      return null;
    } finally {
      setSigning(false);
    }
  }, [address]);

  return { signReview, signing, error };
}

async function hashString(str: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for environments without crypto.subtle
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
  revieweeAddress,
  revieweeRole,
  reviewerRole,
  onSubmit,
}: ProjectReviewModalProps) {
  const { address } = useWalletStore();
  const [ratings, setRatings] = useState<Record<string, number>>({
    quality: 0,
    communication: 0,
    timeliness: 0,
  });
  const [testimonial, setTestimonial] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signReview, signing, error: signError } = useReviewSignature();

  useEscapeKey(() => {
    if (!submitting) onClose();
  }, isOpen);

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
    if (!isFormValid || !address || submitting) return;

    setSubmitting(true);
    setError(null);

    const reviewData: ReviewData & { projectId: string; reviewerRole: string; reviewerAddress: string } = {
      projectId,
      quality: ratings.quality,
      communication: ratings.communication,
      timeliness: ratings.timeliness,
      testimonial: testimonial.trim(),
      skills: selectedSkills,
      reviewerRole,
      reviewerAddress: address,
    };

    try {
      // Sign the review
      const signature = await signReview(reviewData);
      if (!signature) {
        throw new Error(signError || 'Failed to sign review');
      }

      // Submit via callback if provided
      if (onSubmit) {
        await onSubmit({ ...reviewData, signature });
      } else {
        // Fallback: submit to API
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/projects/${projectId}/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...reviewData, signature }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to submit review');
        }
      }

      setSubmitted(true);
      toast.success('Review submitted and signed on Stellar!');
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
      toast.error(`Review submission failed: ${err.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  if (submitted) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-md bg-[#18181d] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 text-3xl mb-4">✓</div>
            <h3 className="text-lg font-bold text-white mb-2">Review Submitted!</h3>
            <p className="text-sm text-slate-400">Your signed review has been recorded on Stellar.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-[#18181d] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              ⭐
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Submit Review</h3>
              <p className="text-xs text-slate-400">{reviewerRole === 'client' ? 'Client reviewing freelancer' : 'Freelancer reviewing client'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Project Info */}
        <div className="p-4 border-b border-[#27272a] bg-slate-950/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Project</span>
            <span className="font-medium text-white truncate max-w-[200px]">{projectTitle}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-slate-400">Reviewing</span>
            <span className="font-medium text-slate-300">{revieweeRole === 'client' ? 'Client' : 'Freelancer'}</span>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Star Ratings */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-300">Rate your experience</h4>
            {RATING_CATEGORIES.map((cat) => (
              <div key={cat.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">{cat.label}</label>
                  <span className="text-[11px] text-slate-400">{ratings[cat.key] || 0} / 5</span>
                </div>
                <p className="text-[11px] text-slate-500">{cat.description}</p>
                <div className="flex items-center gap-1" role="radiogroup" aria-label={cat.label}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRatingChange(cat.key, star)}
                      className={`p-1.5 rounded transition-colors ${
                        ratings[cat.key] >= star
                          ? 'text-amber-400'
                          : 'text-slate-600 hover:text-amber-300'
                      }`}
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white">Written Testimonial (optional)</label>
            <textarea
              value={testimonial}
              onChange={(e) => setTestimonial(e.target.value)}
              rows={4}
              placeholder="Share your experience working with this participant... (markdown supported)"
              className="w-full bg-[#121214] border border-[#27272a] rounded-xl px-4 py-3 text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-indigo-500 resize-none"
            />
            <p className="text-[11px] text-slate-500">Markdown supported. Be constructive and specific.</p>
          </div>

          {/* Skill Endorsements */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white">Skill Endorsements (optional)</label>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    selectedSkills.includes(skill)
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-600 hover:text-slate-300'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error || signError ? (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
              {error || signError}
            </div>
          ) : null}

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid || submitting || signing || !address}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting || signing ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {signing ? 'Signing with Freighter...' : 'Submitting review...'}
              </>
            ) : (
              'Submit Signed Review'
            )}
          </button>

          {!address && (
            <p className="text-center text-xs text-slate-500">Connect your wallet to submit a signed review</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectReviewModal;