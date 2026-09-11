'use client';

import React from 'react';

export interface ProjectCardSkeletonProps {
  variant?: 'default' | 'freelancer';
}

export function ProjectCardSkeleton({ variant = 'default' }: ProjectCardSkeletonProps) {
  if (variant === 'freelancer') {
    return (
      <div className="bg-[#1c1c20]/90 border border-[#27272a] rounded-2xl p-4 sm:p-5 md:p-6 space-y-3.5 animate-skeleton-pulse shadow-lg">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <div className="h-5 w-20 bg-[#27272a] rounded-md"></div>
              <div className="h-4 w-28 bg-[#27272a]/60 rounded-md"></div>
            </div>
            <div className="h-6 w-3/4 bg-[#27272a] rounded-md"></div>
          </div>

          <div className="flex items-center gap-2.5 pt-1 sm:pt-0">
            <div className="h-8 w-24 bg-[#27272a] rounded-xl"></div>
            <div className="h-8 w-20 bg-[#27272a] rounded-xl"></div>
          </div>
        </div>

        {/* Description line placeholder */}
        <div className="space-y-1.5 pt-1">
          <div className="h-3.5 w-full bg-[#27272a]/50 rounded-md"></div>
          <div className="h-3.5 w-2/3 bg-[#27272a]/30 rounded-md"></div>
        </div>

        {/* Footer info placeholder */}
        <div className="flex items-center gap-3 pt-2">
          <div className="h-4 w-24 bg-[#27272a]/50 rounded"></div>
          <div className="h-4 w-32 bg-[#27272a]/40 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1c1c20]/80 border border-[#27272a] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-skeleton-pulse">
      <div className="space-y-2.5 flex-1">
        {/* Title placeholder */}
        <div className="h-5 w-2/5 bg-[#27272a] rounded-md"></div>
        
        {/* Subtitle / Description placeholder */}
        <div className="h-4 w-3/4 bg-[#27272a]/60 rounded-md"></div>

        {/* Attachments / tags placeholders */}
        <div className="pt-1 flex items-center gap-2">
          <div className="h-6 w-16 bg-[#27272a] rounded-md"></div>
          <div className="h-6 w-20 bg-[#27272a]/80 rounded-md"></div>
        </div>
      </div>

      {/* Right status badge placeholder */}
      <div className="self-start sm:self-center">
        <div className="h-7 w-24 bg-[#27272a] rounded-full"></div>
      </div>
    </div>
  );
}

export interface ProjectCardSkeletonListProps {
  count?: number;
  variant?: 'default' | 'freelancer';
}

export function ProjectCardSkeletonList({ count = 3, variant = 'default' }: ProjectCardSkeletonListProps) {
  return (
    <div className="space-y-4" data-testid="project-skeleton-list">
      {Array.from({ length: count }).map((_, index) => (
        <ProjectCardSkeleton key={index} variant={variant} />
      ))}
    </div>
  );
}
