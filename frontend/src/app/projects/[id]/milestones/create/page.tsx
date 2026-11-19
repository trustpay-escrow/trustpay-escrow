'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useMilestonesForm } from '@/hooks/useMilestonesForm';
import { MilestoneBuilderCanvas, MilestoneItem } from '@/components/MilestoneBuilderCanvas';
import { useParams } from 'next/navigation';
import { authFetch } from '@/lib/api';

export default function CreateMilestonesPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [projectBudget, setProjectBudget] = useState<number>(500);
  const [projectToken, setProjectToken] = useState<string>('USDC');
  const [isCanvasValid, setIsCanvasValid] = useState<boolean>(true);

  // Fetch project details to get the exact total budget & currency
  useEffect(() => {
    async function fetchProjectMeta() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await authFetch(`${apiUrl}/api/projects/${projectId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.project) {
            setProjectBudget(Number(data.project.budget) || 500);
            setProjectToken(data.project.token || 'USDC');
          }
        }
      } catch {
        // fallback to default budget
      }
    }
    if (projectId) {
      fetchProjectMeta();
    }
  }, [projectId]);

  const {
    milestones,
    setMilestones,
    loading,
    handleSubmit,
    isBalanced,
  } = useMilestonesForm(projectId, { totalBudget: projectBudget });

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] py-12 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-300">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-[#18181b] rounded-3xl shadow-2xl overflow-hidden border border-[#27272a]">
          <div className="px-8 py-10 sm:px-12 border-b border-[#27272a] bg-gradient-to-r from-blue-900/20 via-indigo-900/20 to-purple-900/20">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 px-3.5 py-1 rounded-full border border-blue-500/20 mb-3 inline-block">
              Interactive Canvas
            </span>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Milestone Builder & Budget Allocator
            </h1>
            <p className="mt-2 text-sm text-[#a1a1aa] max-w-2xl leading-relaxed">
              Drag and drop milestone cards to reorder delivery sequence. Use percentage sliders to
              auto-balance funds so total milestone allocations match 100% of the project budget.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-10 sm:px-12 space-y-8">
            <MilestoneBuilderCanvas
              milestones={milestones as MilestoneItem[]}
              totalBudget={projectBudget}
              currency={projectToken}
              onChange={(updated) => setMilestones(updated as any)}
              onValidationChange={(valid) => setIsCanvasValid(valid)}
            />

            <div className="pt-6 border-t border-[#27272a] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-[#a1a1aa]">
                {!isBalanced && (
                  <span className="text-amber-400 font-semibold">
                    ⚠️ Form cannot be submitted until milestones are balanced to 100%.
                  </span>
                )}
                {isBalanced && (
                  <span className="text-emerald-400 font-semibold">
                    ✓ 100% of budget successfully allocated across milestones.
                  </span>
                )}
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading || !isBalanced || !isCanvasValid}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-blue-600/30 transition-all duration-200 transform hover:-translate-y-0.5 px-10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : 'Save & Publish Milestones 🚀'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
