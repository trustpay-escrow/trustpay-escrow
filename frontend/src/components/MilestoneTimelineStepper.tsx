'use client';

import React, { useMemo } from 'react';
import type { Milestone, Project } from '@/types';

const ON_CHAIN_STATES = ['Initialized', 'Active', 'In Review', 'Approved', 'Disputed', 'Finalized'] as const;
const STATUS_TO_STATE: Record<Milestone['status'], typeof ON_CHAIN_STATES[number]> = {
  pending: 'Initialized',
  submitted: 'Active',
  in_revision: 'In Review',
  approved: 'Approved',
  disputed: 'Disputed',
};

interface MilestoneTimelineStepperProps {
  project: Project;
  milestones: Milestone[];
}

export function MilestoneTimelineStepper({ project, milestones }: MilestoneTimelineStepperProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const isVertical = isMobile || milestones.length > 5;
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  const activeIndex = useMemo(() => {
    const idx = milestones.findIndex((m) => m.status === 'submitted' || m.status === 'in_revision');
    return idx >= 0 ? idx : milestones.findIndex((m) => m.status !== 'approved' && m.status !== 'disputed');
  }, [milestones]);

  const handleNodeClick = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  if (milestones.length === 0) {
    return <div className="text-center py-8 text-[#a1a1aa]">No milestones available</div>;
  }

  if (isVertical) {
    return (
      <div className="space-y-4">
        {milestones.map((milestone, index) => {
          const state = STATUS_TO_STATE[milestone.status] || 'Initialized';
          const isActive = index === activeIndex;
          const isDisputed = milestone.status === 'disputed';
          const isApproved = milestone.status === 'approved';

          return (
            <div key={milestone.id} className="relative">
              <div
                onClick={() => handleNodeClick(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  isActive
                    ? 'bg-indigo-500/10 border-indigo-500/50 shadow-lg shadow-indigo-500/20'
                    : isDisputed
                      ? 'bg-rose-500/10 border-rose-500/50'
                      : isApproved
                        ? 'bg-emerald-500/10 border-emerald-500/50'
                        : 'bg-[#1c1c20] border-[#27272a]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1 h-4 w-4 rounded-full shrink-0 ${
                      isActive
                        ? 'bg-indigo-500 shadow-lg shadow-indigo-500/50 animate-pulse'
                        : isDisputed
                          ? 'bg-rose-500'
                          : isApproved
                            ? 'bg-emerald-500'
                            : 'bg-[#3f3f46]'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-[#e4e4e7] truncate">
                        Milestone {milestone.milestone_index + 1}: {milestone.title}
                      </h3>
                      <span className="shrink-0 text-xs px-2 py-1 rounded-md bg-[#27272a] text-[#a1a1aa]">
                        {state}
                      </span>
                    </div>
                    <p className="text-xs text-[#71717a] mt-1">{milestone.amount} {project.token || 'USDC'}</p>
                    {milestone.due_date && (
                      <p className="text-xs text-[#71717a]">Due: {new Date(milestone.due_date).toLocaleDateString()}</p>
                    )}

                    {(expandedIndex === index || hoveredIndex === index) && (
                      <div className="mt-3 space-y-2 border-t border-[#27272a] pt-3">
                        {milestone.description && (
                          <p className="text-xs text-[#a1a1aa]">{milestone.description}</p>
                        )}
                        <div className="flex flex-col gap-2">
                          {milestone.status === 'submitted' && (
                            <button className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">
                              Review Deliverable
                            </button>
                          )}
                          {milestone.status === 'in_revision' && (
                            <button className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg">
                              Request Revision
                            </button>
                          )}
                          {milestone.status === 'disputed' && (
                            <button className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg">
                              View Arbitration
                            </button>
                          )}
                          {milestone.status === 'pending' && (
                            <button className="px-3 py-1.5 text-xs font-semibold bg-[#27272a] hover:bg-[#3f3f46] text-[#a1a1aa] rounded-lg">
                              Awaiting Submission
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {index < milestones.length - 1 && (
                <div className="ml-1.5 h-3 w-1 bg-[#27272a] my-0.5" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Horizontal layout for desktop
  return (
    <div className="w-full">
      <svg width="100%" height="200" viewBox={`0 0 ${Math.max(600, milestones.length * 120)} 200`} className="overflow-x-auto">
        <defs>
          <style>{`
            @keyframes pulse-ring {
              0%, 100% { r: 16; opacity: 1; }
              50% { r: 20; opacity: 0.6; }
            }
            .pulse-node {
              animation: pulse-ring 2s infinite;
            }
          `}</style>
        </defs>

        {/* Connection line */}
        <line x1="40" y1="100" x2={Math.max(560, milestones.length * 120 - 40)} y2="100" stroke="#27272a" strokeWidth="2" />

        {/* Nodes */}
        {milestones.map((milestone, index) => {
          const x = 40 + index * 120;
          const isActive = index === activeIndex;
          const isDisputed = milestone.status === 'disputed';
          const isApproved = milestone.status === 'approved';
          const state = STATUS_TO_STATE[milestone.status] || 'Initialized';

          return (
            <g key={milestone.id}>
              {/* Pulsing background for active */}
              {isActive && (
                <circle cx={x} cy="100" r="20" fill="none" stroke="#6366f1" strokeWidth="1" opacity="0.6" className="pulse-node" />
              )}

              {/* Main node */}
              <circle
                cx={x}
                cy="100"
                r="16"
                fill={
                  isActive
                    ? '#6366f1'
                    : isDisputed
                      ? '#f43f5e'
                      : isApproved
                        ? '#10b981'
                        : '#3f3f46'
                }
                stroke={
                  isActive
                    ? '#818cf8'
                    : isDisputed
                      ? '#fb7185'
                      : isApproved
                        ? '#34d399'
                        : '#52525b'
                }
                strokeWidth="2"
                style={{ cursor: 'pointer' }}
                onClick={() => handleNodeClick(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />

              {/* Milestone index */}
              <text
                x={x}
                y="105"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="12"
                fontWeight="bold"
                style={{ cursor: 'pointer', pointerEvents: 'none' }}
              >
                {index + 1}
              </text>

              {/* Tooltip on hover */}
              {hoveredIndex === index && (
                <g>
                  <rect
                    x={x - 80}
                    y="25"
                    width="160"
                    height="50"
                    rx="6"
                    fill="#18181b"
                    stroke="#27272a"
                    strokeWidth="1"
                  />
                  <text x={x} y="40" textAnchor="middle" fill="#e4e4e7" fontSize="11" fontWeight="bold">
                    {milestone.title}
                  </text>
                  <text x={x} y="55" textAnchor="middle" fill="#a1a1aa" fontSize="10">
                    {milestone.amount} {project.token || 'USDC'}
                  </text>
                  {milestone.due_date && (
                    <text x={x} y="68" textAnchor="middle" fill="#71717a" fontSize="9">
                      Due: {new Date(milestone.due_date).toLocaleDateString()}
                    </text>
                  )}
                </g>
              )}

              {/* Label below */}
              <text
                x={x}
                y="140"
                textAnchor="middle"
                fill="#71717a"
                fontSize="10"
                style={{ pointerEvents: 'none' }}
              >
                {state}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Expanded details below for desktop */}
      {expandedIndex !== null && (
        <div className="mt-6 p-4 rounded-xl bg-[#1c1c20] border border-[#27272a]">
          {(() => {
            const milestone = milestones[expandedIndex];
            if (!milestone) return null;
            const state = STATUS_TO_STATE[milestone.status] || 'Initialized';
            return (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-[#e4e4e7]">
                      Milestone {milestone.milestone_index + 1}: {milestone.title}
                    </h3>
                    <p className="text-xs text-[#a1a1aa] mt-1">{state}</p>
                  </div>
                  <button
                    onClick={() => setExpandedIndex(null)}
                    className="text-[#71717a] hover:text-white text-sm"
                  >
                    ✕
                  </button>
                </div>

                {milestone.description && (
                  <p className="text-xs text-[#a1a1aa]">{milestone.description}</p>
                )}

                <div className="flex items-center gap-6 text-xs">
                  <div>
                    <p className="text-[#71717a]">Amount</p>
                    <p className="font-semibold text-[#e4e4e7]">{milestone.amount} {project.token || 'USDC'}</p>
                  </div>
                  {milestone.due_date && (
                    <div>
                      <p className="text-[#71717a]">Due Date</p>
                      <p className="font-semibold text-[#e4e4e7]">{new Date(milestone.due_date).toLocaleDateString()}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[#71717a]">Status</p>
                    <p className="font-semibold text-[#e4e4e7]">{state}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#27272a] flex gap-2">
                  {milestone.status === 'submitted' && (
                    <button className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">
                      Review Deliverable
                    </button>
                  )}
                  {milestone.status === 'in_revision' && (
                    <button className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg">
                      Request Revision
                    </button>
                  )}
                  {milestone.status === 'disputed' && (
                    <button className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg">
                      View Arbitration
                    </button>
                  )}
                  {milestone.status === 'pending' && (
                    <button className="px-3 py-1.5 text-xs font-semibold bg-[#27272a] hover:bg-[#3f3f46] text-[#a1a1aa] rounded-lg">
                      Awaiting Submission
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default MilestoneTimelineStepper;
