'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

export interface MilestoneItem {
  id?: string;
  milestone_index: number;
  title: string;
  description?: string;
  amount: number;
  percentage?: number;
  due_date?: string;
  revision_limit?: number;
  deliverable_type?: string;
}

export interface MilestoneBuilderCanvasProps {
  milestones: MilestoneItem[];
  totalBudget: number;
  currency?: string;
  onChange: (milestones: MilestoneItem[]) => void;
  onValidationChange?: (isValid: boolean) => void;
  readOnly?: boolean;
}

export function MilestoneBuilderCanvas({
  milestones,
  totalBudget,
  currency = 'USDC',
  onChange,
  onValidationChange,
  readOnly = false,
}: MilestoneBuilderCanvasProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const prevBudgetRef = useRef<number>(totalBudget);

  // Auto-adjust milestone amounts when total project budget is modified
  useEffect(() => {
    if (prevBudgetRef.current !== totalBudget && prevBudgetRef.current > 0 && totalBudget > 0 && milestones.length > 0) {
      const ratio = totalBudget / prevBudgetRef.current;
      const updated = milestones.map((m) => {
        const newAmt = Math.round(Number(m.amount) * ratio * 100) / 100;
        const pct = Math.round((newAmt / totalBudget) * 1000) / 10;
        return {
          ...m,
          amount: newAmt,
          percentage: pct,
        };
      });
      onChange(updated);
      toast.info(`Auto-adjusted milestone amounts to match updated total budget (${totalBudget} ${currency})`);
    }
    prevBudgetRef.current = totalBudget;
  }, [totalBudget, currency, milestones, onChange]);

  // Calculations for live progress and validation
  const totalAllocatedAmount = milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
  const totalAllocatedPercent =
    totalBudget > 0 ? Math.round((totalAllocatedAmount / totalBudget) * 1000) / 10 : 0;
  
  // Strict tolerance check (within 0.05% due to floating point)
  const isBalanced = totalBudget > 0 && Math.abs(totalAllocatedPercent - 100) <= 0.1;
  const isUnderAllocated = totalBudget > 0 && totalAllocatedPercent < 99.9;
  const isOverAllocated = totalBudget > 0 && totalAllocatedPercent > 100.1;

  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(isBalanced);
    }
  }, [isBalanced, onValidationChange]);

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (readOnly) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (readOnly || draggedIndex === null) return;
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (readOnly || draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...milestones];
    const [movedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, movedItem);

    const reindexed = reordered.map((m, idx) => ({
      ...m,
      milestone_index: idx,
    }));

    onChange(reindexed);
    toast.success(`Reordered milestone #${draggedIndex + 1} to position #${targetIndex + 1}`);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Reorder buttons for accessibility / mobile pointer
  const moveMilestone = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= milestones.length) return;
    const reordered = [...milestones];
    const [movedItem] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, movedItem);

    const reindexed = reordered.map((m, idx) => ({
      ...m,
      milestone_index: idx,
    }));

    onChange(reindexed);
  };

  // Dynamic Percentage Slider & Amount Synchronization
  const handlePercentageChange = (index: number, newPercent: number) => {
    if (readOnly) return;
    const clampedPercent = Math.min(100, Math.max(0, newPercent));
    const newAmount = totalBudget > 0 ? Math.round(((clampedPercent / 100) * totalBudget) * 100) / 100 : 0;

    const updated = milestones.map((m, i) => {
      if (i === index) {
        return {
          ...m,
          amount: newAmount,
          percentage: clampedPercent,
        };
      }
      return m;
    });

    onChange(updated);
  };

  const handleAmountChange = (index: number, rawAmount: number | string) => {
    if (readOnly) return;
    const newAmount = rawAmount === '' ? 0 : Number(rawAmount);
    const calculatedPercent =
      totalBudget > 0 ? Math.round((newAmount / totalBudget) * 1000) / 10 : 0;

    const updated = milestones.map((m, i) => {
      if (i === index) {
        return {
          ...m,
          amount: newAmount,
          percentage: calculatedPercent,
        };
      }
      return m;
    });

    onChange(updated);
  };

  const handleFieldChange = (index: number, field: keyof MilestoneItem, value: any) => {
    if (readOnly) return;
    const updated = milestones.map((m, i) => (i === index ? { ...m, [field]: value } : m));
    onChange(updated);
  };

  // Auto-Balance: Evenly split 100% across all milestones
  const autoBalanceAll = () => {
    if (milestones.length === 0 || totalBudget <= 0) {
      toast.warning('Please enter a total budget and define milestones first');
      return;
    }

    const count = milestones.length;
    const equalPercent = Math.floor((100 / count) * 10) / 10;
    const baseAmount = Math.floor((totalBudget / count) * 100) / 100;

    let allocatedAmount = 0;
    const updated = milestones.map((m, i) => {
      const isLast = i === count - 1;
      const amt = isLast ? Math.round((totalBudget - allocatedAmount) * 100) / 100 : baseAmount;
      allocatedAmount += amt;
      const pct = Math.round((amt / totalBudget) * 1000) / 10;
      return {
        ...m,
        amount: amt,
        percentage: pct,
      };
    });

    onChange(updated);
    toast.success(`Auto-balanced ${count} milestones to equal 100% of budget (${totalBudget} ${currency})`);
  };

  // Auto-balance remaining unallocated percentage to a specific milestone
  const balanceRemainingToMilestone = (index: number) => {
    if (totalBudget <= 0) return;
    const otherAmountSum = milestones.reduce((sum, m, i) => (i === index ? sum : sum + (Number(m.amount) || 0)), 0);
    const remainingAmount = Math.max(0, Math.round((totalBudget - otherAmountSum) * 100) / 100);
    const remainingPercent = Math.round((remainingAmount / totalBudget) * 1000) / 10;

    const updated = milestones.map((m, i) => {
      if (i === index) {
        return {
          ...m,
          amount: remainingAmount,
          percentage: remainingPercent,
        };
      }
      return m;
    });

    onChange(updated);
    toast.success(`Allocated remaining budget to Milestone #${index + 1}`);
  };

  // Add a new milestone
  const handleAddNewMilestone = () => {
    const nextIndex = milestones.length;
    const otherAmountSum = milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    const remainingAmount = Math.max(0, Math.round((totalBudget - otherAmountSum) * 100) / 100);
    const remainingPercent =
      totalBudget > 0 ? Math.round((remainingAmount / totalBudget) * 1000) / 10 : 0;

    const newMilestone: MilestoneItem = {
      id: `ms_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      milestone_index: nextIndex,
      title: `Milestone ${nextIndex + 1}`,
      description: '',
      amount: remainingAmount,
      percentage: remainingPercent,
      revision_limit: 1,
      deliverable_type: 'GitHub Repository',
    };

    onChange([...milestones, newMilestone]);
    toast.success(`Milestone #${nextIndex + 1} added`);
  };

  // Remove a milestone
  const handleRemoveMilestone = (index: number) => {
    if (milestones.length <= 1) {
      toast.warning('A project requires at least one milestone');
      return;
    }
    const filtered = milestones.filter((_, i) => i !== index);
    const reindexed = filtered.map((m, idx) => ({ ...m, milestone_index: idx }));
    onChange(reindexed);
    toast.info(`Milestone #${index + 1} removed`);
  };

  return (
    <div className="space-y-5 select-none">
      {/* Header & Live Budget Progress Indicator Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#1c1c20] border border-[#27272a] shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider block">
              Live Milestone Budget Allocation
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-white">
                {totalAllocatedAmount.toLocaleString()} / {totalBudget.toLocaleString()} {currency}
              </span>
              <span
                className={`text-sm font-extrabold ${
                  isBalanced
                    ? 'text-emerald-400'
                    : isUnderAllocated
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                ({totalAllocatedPercent}%)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!readOnly && (
              <>
                <button
                  type="button"
                  onClick={autoBalanceAll}
                  className="px-3 py-1.5 bg-[#232326] hover:bg-[#2a2a30] text-[#e4e4e7] hover:text-white font-bold text-xs rounded-xl border border-[#3f3f46] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                  title="Evenly distribute 100% of project budget across all milestones"
                >
                  <span>⚖️</span>
                  <span>Auto-Balance 100%</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddNewMilestone}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                >
                  <span>+</span>
                  <span>Add Milestone</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Live Multi-Color Progress Indicator */}
        <div className="w-full h-3 bg-[#121214] rounded-full overflow-hidden border border-[#27272a] relative">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isBalanced
                ? 'bg-gradient-to-r from-emerald-500 to-green-400 shadow-lg shadow-emerald-500/30'
                : isUnderAllocated
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                : 'bg-gradient-to-r from-red-600 to-rose-500 shadow-lg shadow-red-500/30'
            }`}
            style={{ width: `${Math.min(100, totalAllocatedPercent)}%` }}
          />
        </div>

        {/* Status Verification Badge */}
        <div className="flex flex-wrap items-center justify-between text-xs pt-1">
          {isBalanced ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
              <span>✓</span> Exact 100% Budget Balanced — Ready for Submission
            </span>
          ) : isUnderAllocated ? (
            <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
              <span>⚠️</span> Under-allocated: {(100 - totalAllocatedPercent).toFixed(1)}% ({Math.max(0, totalBudget - totalAllocatedAmount).toFixed(2)} {currency}) unallocated
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-red-400 font-bold">
              <span>🚨</span> Over-allocated: {(totalAllocatedPercent - 100).toFixed(1)}% ({(totalAllocatedAmount - totalBudget).toFixed(2)} {currency} over budget)
            </span>
          )}

          <span className="text-[11px] text-[#71717a]">
            {milestones.length} milestone{milestones.length === 1 ? '' : 's'} defined • Drag handles ⠿ to reorder
          </span>
        </div>
      </div>

      {/* Interactive Milestone Cards Canvas */}
      <div className="space-y-3">
        {milestones.length === 0 ? (
          <div className="p-8 rounded-2xl border-2 border-dashed border-[#27272a] bg-[#141416] text-center space-y-2">
            <p className="text-sm text-[#a1a1aa]">No milestones defined yet.</p>
            <button
              type="button"
              onClick={handleAddNewMilestone}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              + Add First Milestone
            </button>
          </div>
        ) : (
          milestones.map((milestone, index) => {
            const milestonePercent =
              totalBudget > 0
                ? Math.round((Number(milestone.amount || 0) / totalBudget) * 1000) / 10
                : 0;

            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;

            return (
              <div
                key={milestone.id || index}
                draggable={!readOnly}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`rounded-2xl border transition-all duration-200 p-4 sm:p-5 relative ${
                  isDragging
                    ? 'opacity-40 scale-[0.98] border-dashed border-blue-500 bg-[#1c1c24]'
                    : isDragOver
                    ? 'border-blue-500 bg-[#1a1a24] shadow-xl ring-2 ring-blue-500/30'
                    : 'bg-[#18181b] border-[#27272a] hover:border-[#38383f] shadow-lg'
                }`}
              >
                {/* Milestone Card Header */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#27272a]">
                  <div className="flex items-center gap-2.5">
                    {/* Drag Grip Handle */}
                    {!readOnly && (
                      <div
                        className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg text-[#71717a] hover:text-white hover:bg-[#27272a] transition-colors"
                        title="Drag to reorder sequence"
                      >
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                          <path d="M7 4a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0zM7 16a2 2 0 11-4 0 2 2 0 014 0zM17 4a2 2 0 11-4 0 2 2 0 014 0zM17 10a2 2 0 11-4 0 2 2 0 014 0zM17 16a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                    )}

                    <span className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-black flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>

                    <input
                      type="text"
                      disabled={readOnly}
                      value={milestone.title}
                      onChange={(e) => handleFieldChange(index, 'title', e.target.value)}
                      placeholder={`Milestone #${index + 1} Title`}
                      className="bg-transparent font-bold text-sm sm:text-base text-white focus:outline-none focus:border-b focus:border-blue-500 max-w-[200px] sm:max-w-xs transition-colors"
                    />
                  </div>

                  {/* Move Up/Down Controls & Delete */}
                  <div className="flex items-center gap-1">
                    {!readOnly && (
                      <>
                        <button
                          type="button"
                          onClick={() => moveMilestone(index, index - 1)}
                          disabled={index === 0}
                          className="w-7 h-7 rounded-lg bg-[#232326] hover:bg-[#2a2a30] disabled:opacity-30 disabled:cursor-not-allowed text-[#a1a1aa] hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                          title="Move up in sequence"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveMilestone(index, index + 1)}
                          disabled={index === milestones.length - 1}
                          className="w-7 h-7 rounded-lg bg-[#232326] hover:bg-[#2a2a30] disabled:opacity-30 disabled:cursor-not-allowed text-[#a1a1aa] hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                          title="Move down in sequence"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveMilestone(index)}
                          className="w-7 h-7 rounded-lg bg-[#232326] hover:bg-red-950/40 text-[#71717a] hover:text-red-400 flex items-center justify-center text-xs transition-colors cursor-pointer ml-1"
                          title="Remove milestone"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Card Body: Interactive Percentage Slider & Inputs */}
                <div className="pt-4 space-y-4">
                  {/* Dynamic Percentage Slider Bar */}
                  <div className="p-3.5 rounded-xl bg-[#121214] border border-[#27272a] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#a1a1aa]">Budget Percentage Share</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-blue-400 text-sm">
                          {milestonePercent.toFixed(1)}%
                        </span>
                        <span className="text-[#71717a]">|</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            disabled={readOnly}
                            min="0"
                            step="0.01"
                            value={milestone.amount}
                            onChange={(e) => handleAmountChange(index, e.target.value)}
                            className="w-24 px-2 py-1 bg-[#18181b] border border-[#3f3f46] rounded text-right font-mono font-bold text-white text-xs focus:outline-none focus:border-blue-500"
                          />
                          <span className="font-bold text-xs text-[#a1a1aa]">{currency}</span>
                        </div>
                      </div>
                    </div>

                    {/* Percentage Slider Range Input */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      disabled={readOnly || totalBudget <= 0}
                      value={milestonePercent}
                      onChange={(e) => handlePercentageChange(index, parseFloat(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer h-2 bg-[#232326] rounded-lg appearance-none"
                    />

                    {/* Quick Percentage Presets & Balance Remaining */}
                    {!readOnly && (
                      <div className="flex flex-wrap items-center justify-between gap-1 pt-1 text-[11px]">
                        <div className="flex gap-1.5">
                          {[10, 20, 25, 33.3, 50].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handlePercentageChange(index, preset)}
                              className="px-2 py-0.5 rounded bg-[#1f1f23] hover:bg-[#27272b] text-[#a1a1aa] hover:text-white border border-[#2e2e33] font-mono text-[10px] transition-colors cursor-pointer"
                            >
                              {preset}%
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => balanceRemainingToMilestone(index)}
                          className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                          title="Assign all remaining unallocated budget to this milestone"
                        >
                          Snap Remaining →
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Metadata Fields: Description, Deliverable Type, Due Date, Revision Limit */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        disabled={readOnly}
                        value={milestone.description || ''}
                        onChange={(e) => handleFieldChange(index, 'description', e.target.value)}
                        placeholder="Deliverable scope, specs, or task breakdown..."
                        className="w-full px-3 py-2 bg-[#202024] border border-[#2e2e34] rounded-xl text-white text-xs placeholder-[#71717a] focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#a1a1aa] uppercase mb-1">
                        Deliverable Type
                      </label>
                      <select
                        disabled={readOnly}
                        value={milestone.deliverable_type || 'GitHub Repository'}
                        onChange={(e) => handleFieldChange(index, 'deliverable_type', e.target.value)}
                        className="w-full px-3 py-2 bg-[#202024] border border-[#2e2e34] rounded-xl text-white text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="GitHub Repository">GitHub Repository</option>
                        <option value="Figma Design File">Figma Design File</option>
                        <option value="Smart Contract Code">Smart Contract Code</option>
                        <option value="IPFS Hash / Archive">IPFS Hash / Archive</option>
                        <option value="Document / Report">Document / Report</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#a1a1aa] uppercase mb-1">
                        Revision Limit
                      </label>
                      <input
                        type="number"
                        disabled={readOnly}
                        min="0"
                        value={milestone.revision_limit ?? 1}
                        onChange={(e) =>
                          handleFieldChange(
                            index,
                            'revision_limit',
                            e.target.value === '' ? 0 : Number(e.target.value)
                          )
                        }
                        className="w-full px-3 py-2 bg-[#202024] border border-[#2e2e34] rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#a1a1aa] uppercase mb-1">
                        Target Due Date
                      </label>
                      <input
                        type="date"
                        disabled={readOnly}
                        min={new Date().toISOString().split('T')[0]}
                        value={milestone.due_date || ''}
                        onChange={(e) => handleFieldChange(index, 'due_date', e.target.value)}
                        className="w-full px-3 py-2 bg-[#202024] border border-[#2e2e34] rounded-xl text-white text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default MilestoneBuilderCanvas;
