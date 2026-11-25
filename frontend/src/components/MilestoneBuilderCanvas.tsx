'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import type { Milestone } from '@/types';
import { reorderMilestoneAtInsertion } from '@/lib/milestone-reordering';

interface MilestoneBuilderCanvasProps {
  milestones: Milestone[];
  token: string;
  onReorder: (milestones: Milestone[]) => void;
  onRemove: (id: string) => void;
}

export function MilestoneBuilderCanvas({
  milestones,
  token,
  onReorder,
  onRemove,
}: MilestoneBuilderCanvasProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewMilestones, setPreviewMilestones] = useState<Milestone[] | null>(null);
  const [dropAtEnd, setDropAtEnd] = useState(false);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const previousTops = useRef<Map<string, number> | null>(null);
  const previewRef = useRef(milestones);
  const displayedMilestones = previewMilestones ?? milestones;

  useLayoutEffect(() => {
    const previous = previousTops.current;
    if (!previous) return;

    cardRefs.current.forEach((element, id) => {
      const previousTop = previous.get(id);
      if (previousTop === undefined) return;
      const offset = previousTop - element.getBoundingClientRect().top;
      if (!offset) return;

      element.style.transition = 'none';
      element.style.transform = `translateY(${offset}px)`;
      void element.offsetHeight;
      requestAnimationFrame(() => {
        element.style.transition = 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)';
        element.style.transform = 'translateY(0)';
      });
    });
    previousTops.current = null;
  }, [displayedMilestones]);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, targetId: string) => {
    if (!activeId) return;
    event.preventDefault();

    const currentPreview = previewRef.current;
    const activeIndex = currentPreview.findIndex((milestone) => milestone.id === activeId);
    const targetIndex = currentPreview.findIndex((milestone) => milestone.id === targetId);
    if (activeIndex < 0 || targetIndex < 0) return;

    const target = event.currentTarget.getBoundingClientRect();
    const insertionIndex =
      targetIndex + (event.clientY >= target.top + target.height / 2 ? 1 : 0);
    const nextPreview = reorderMilestoneAtInsertion(currentPreview, activeId, insertionIndex);
    const atEnd = insertionIndex === currentPreview.length;
    if (nextPreview === currentPreview && dropAtEnd === atEnd) return;

    previousTops.current = new Map(
      Array.from(cardRefs.current, ([id, element]) => [id, element.getBoundingClientRect().top])
    );
    previewRef.current = nextPreview;
    setPreviewMilestones(nextPreview);
    setDropAtEnd(atEnd);
  };

  const clearDrag = () => {
    setActiveId(null);
    setPreviewMilestones(null);
    previewRef.current = milestones;
    setDropAtEnd(false);
    previousTops.current = null;
  };

  const finishDrag = () => {
    if (activeId) {
      onReorder(previewRef.current);
    }
    clearDrag();
  };

  const activePreviewIndex = activeId
    ? displayedMilestones.findIndex((milestone) => milestone.id === activeId)
    : -1;

  return (
    <div className="space-y-2.5" data-testid="milestone-builder-canvas">
      {milestones.length === 0 ? (
        <div className="text-center py-6 bg-[#1c1c20]/50 border border-dashed border-[#333338] rounded-xl">
          <p className="text-xs text-[#a1a1aa]">
            No milestones added yet. Click &quot;+ Add milestone&quot; to define project milestones.
          </p>
        </div>
      ) : (
        <>
          {displayedMilestones.map((milestone, index) => {
            const isDragging = milestone.id === activeId;
            return (
              <React.Fragment key={milestone.id}>
                {isDragging &&
                  activeId &&
                  !dropAtEnd &&
                  activePreviewIndex >= 0 && (
                    <div
                      className="milestone-drop-indicator h-1 rounded-full bg-blue-400 shadow-[0_0_12px_3px_rgba(59,130,246,0.65)] animate-pulse"
                      aria-label={`Drop position before milestone ${index + 1}`}
                      data-testid="milestone-drop-indicator"
                    />
                  )}
                <div
                  ref={(element) => {
                    if (element) cardRefs.current.set(milestone.id, element);
                    else cardRefs.current.delete(milestone.id);
                  }}
                  onDragOver={(event) =>
                    handleDragOver(event, milestone.id)
                  }
                  onDrop={(event) => {
                    event.preventDefault();
                    finishDrag();
                  }}
                  className="milestone-reorder-item relative"
                >
                  <div
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', milestone.id);
                      previewRef.current = milestones;
                      setPreviewMilestones(milestones);
                      setDropAtEnd(false);
                      setActiveId(milestone.id);
                    }}
                    onDragEnd={clearDrag}
                    className={`milestone-reorder-card bg-[#1c1c20] border border-[#27272a] rounded-xl p-4 space-y-2 group transition-[transform,box-shadow,border-color] duration-200 ${
                      isDragging
                        ? 'z-10 scale-[1.02] border-blue-400/70 shadow-lg shadow-blue-500/20 cursor-grabbing'
                        : 'cursor-grab hover:border-blue-500/30'
                    }`}
                    data-testid={`milestone-card-${milestone.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                          #{index + 1}
                        </span>
                        <span className="text-sm font-bold text-white">{milestone.title}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-extrabold text-[#22c55e]">
                          {milestone.amount} {token}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemove(milestone.id)}
                          className="text-[#71717a] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          title="Remove milestone"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {milestone.description && (
                      <p className="text-xs text-[#a1a1aa] line-clamp-2">{milestone.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[#71717a]">
                      {milestone.deliverable_type && (
                        <span className="bg-[#232326] px-2 py-0.5 rounded border border-[#333338] text-[#e4e4e7]">
                          📦 {milestone.deliverable_type}
                        </span>
                      )}
                      <span>• Revisions: {milestone.revision_limit ?? 0}</span>
                      {milestone.due_date && (
                        <span>• Due: {new Date(milestone.due_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          {activeId && dropAtEnd && (
            <div
              className="milestone-drop-indicator h-1 rounded-full bg-blue-400 shadow-[0_0_12px_3px_rgba(59,130,246,0.65)] animate-pulse"
              aria-label="Drop position at end of milestones"
              data-testid="milestone-drop-indicator"
            />
          )}
        </>
      )}
    </div>
  );
}
