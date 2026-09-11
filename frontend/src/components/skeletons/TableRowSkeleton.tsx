'use client';

import React from 'react';

export function TableRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 bg-[#1c1c20]/60 border border-[#27272a] rounded-xl animate-skeleton-pulse gap-4">
      <div className="flex items-center space-x-3 flex-1">
        <div className="w-8 h-8 rounded-full bg-[#27272a]"></div>
        <div className="space-y-1.5 flex-1">
          <div className="h-4 w-1/3 bg-[#27272a] rounded"></div>
          <div className="h-3 w-1/2 bg-[#27272a]/50 rounded"></div>
        </div>
      </div>
      <div className="h-6 w-20 bg-[#27272a] rounded-md"></div>
      <div className="h-6 w-16 bg-[#27272a] rounded-full"></div>
    </div>
  );
}

export function ProposalCardSkeleton() {
  return (
    <div className="bg-[#1c1c20]/80 border border-[#27272a] rounded-xl p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 animate-skeleton-pulse">
      <div className="space-y-3 max-w-xl flex-1">
        <div className="flex items-center space-x-2">
          <div className="h-5 w-40 bg-[#27272a] rounded"></div>
          <div className="h-4 w-20 bg-[#27272a]/60 rounded"></div>
        </div>

        <div className="h-4 w-48 bg-[#27272a]/70 rounded"></div>

        <div className="space-y-1.5 pt-1">
          <div className="h-3.5 w-full bg-[#27272a]/50 rounded"></div>
          <div className="h-3.5 w-4/5 bg-[#27272a]/40 rounded"></div>
        </div>

        <div className="h-3.5 w-32 bg-[#27272a]/50 rounded"></div>
      </div>

      <div className="self-start">
        <div className="h-7 w-20 bg-[#27272a] rounded-full"></div>
      </div>
    </div>
  );
}

export interface ProposalSkeletonListProps {
  count?: number;
}

export function ProposalSkeletonList({ count = 3 }: ProposalSkeletonListProps) {
  return (
    <div className="space-y-4" data-testid="proposal-skeleton-list">
      {Array.from({ length: count }).map((_, index) => (
        <ProposalCardSkeleton key={index} />
      ))}
    </div>
  );
}
