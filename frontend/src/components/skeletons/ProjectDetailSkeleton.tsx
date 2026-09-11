'use client';

import React from 'react';

export function ProjectDetailSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-20 animate-skeleton-pulse" data-testid="project-detail-skeleton">
      {/* Top Banner Skeleton */}
      <div className="h-64 bg-slate-900/80 relative border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-full flex flex-col justify-end pb-8">
          <div className="h-6 w-32 bg-slate-800 rounded-lg mb-4"></div>
          <div className="h-10 w-2/3 bg-slate-800 rounded-xl mb-3"></div>
          <div className="flex items-center gap-3">
            <div className="h-6 w-24 bg-slate-800 rounded-full"></div>
            <div className="h-6 w-28 bg-slate-800 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left / Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview Box */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="h-6 w-44 bg-slate-800 rounded"></div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-slate-800/70 rounded"></div>
              <div className="h-4 w-full bg-slate-800/70 rounded"></div>
              <div className="h-4 w-4/5 bg-slate-800/60 rounded"></div>
              <div className="h-4 w-3/5 bg-slate-800/50 rounded"></div>
            </div>
          </div>

          {/* Milestones Box */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-6 w-36 bg-slate-800 rounded"></div>
              <div className="h-6 w-20 bg-slate-800 rounded-full"></div>
            </div>

            <div className="space-y-3 pt-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-1/3 bg-slate-800 rounded"></div>
                    <div className="h-3 w-1/2 bg-slate-800/50 rounded"></div>
                  </div>
                  <div className="h-6 w-20 bg-slate-800 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="h-5 w-32 bg-slate-800 rounded"></div>
            <div className="h-10 w-full bg-slate-800 rounded-xl"></div>
            <div className="space-y-3 pt-3 border-t border-slate-800/60">
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-slate-800/60 rounded"></div>
                <div className="h-4 w-28 bg-slate-800 rounded"></div>
              </div>
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-slate-800/60 rounded"></div>
                <div className="h-4 w-20 bg-slate-800 rounded"></div>
              </div>
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-slate-800/60 rounded"></div>
                <div className="h-4 w-24 bg-slate-800 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
