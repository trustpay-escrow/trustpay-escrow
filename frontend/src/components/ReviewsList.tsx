'use client';

import React from 'react';
import { ProjectReview } from '@/types';

export interface ReviewsListProps {
  reviews?: ProjectReview[];
  className?: string;
}

const DEFAULT_MOCK_REVIEWS: ProjectReview[] = [
  {
    id: 'rev-1',
    project_id: 'p-1',
    reviewer_address: 'GB7TND7...4W2K',
    reviewer_role: 'client',
    communication_rating: 5,
    quality_rating: 5,
    timeliness_rating: 4,
    average_rating: 4.7,
    testimonial: 'Exceptional Soroban smart contract engineering. Delivered all milestones promptly and communication was seamless throughout the project lifecycle.',
    created_at: '2026-11-18T14:30:00Z',
  },
  {
    id: 'rev-2',
    project_id: 'p-2',
    reviewer_address: 'GCR45KD...9P1X',
    reviewer_role: 'freelancer',
    communication_rating: 5,
    quality_rating: 5,
    timeliness_rating: 5,
    average_rating: 5.0,
    testimonial: 'Great client to collaborate with! Milestones were funded promptly into escrow and deliverables approved without delay.',
    created_at: '2026-11-15T09:15:00Z',
  },
];

export function ReviewsList({
  reviews = DEFAULT_MOCK_REVIEWS,
  className = '',
}: ReviewsListProps) {
  const renderStarDisplay = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5 text-amber-400 text-sm">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star}>{star <= Math.round(rating) ? '★' : '☆'}</span>
        ))}
        <span className="text-xs font-bold text-slate-300 ml-1.5">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white tracking-tight">Verified Client & Freelancer Reviews</h3>
        <span className="text-xs text-slate-400">{reviews.length} total reviews</span>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 text-center text-xs text-slate-500">
          No reviews submitted yet for this project.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-300 font-semibold">
                      {rev.reviewer_address}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                        rev.reviewer_role === 'client'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}
                    >
                      {rev.reviewer_role}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {new Date(rev.created_at).toLocaleDateString()}
                  </div>
                </div>
                {renderStarDisplay(rev.average_rating)}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed italic">
                &ldquo;{rev.testimonial}&rdquo;
              </p>

              <div className="flex items-center gap-4 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                <span>Comm: <strong className="text-slate-300">{rev.communication_rating}★</strong></span>
                <span>Quality: <strong className="text-slate-300">{rev.quality_rating}★</strong></span>
                <span>Timeliness: <strong className="text-slate-300">{rev.timeliness_rating}★</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
