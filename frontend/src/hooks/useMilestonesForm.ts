import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { milestoneArraySchema, MilestoneFormData } from '@/lib/validators';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';

const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function submitMilestones(
  projectId: string,
  milestones: MilestoneFormData[]
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (!projectId) {
    return { success: false, error: 'Project ID is required' };
  }

  const validation = milestoneArraySchema.safeParse(milestones);
  if (!validation.success) {
    const errorMessages = validation.error.issues
      .map((issue) => `${issue.path.join('.') || 'field'}: ${issue.message}`)
      .join(' | ');
    toast.error(`Validation failed: ${errorMessages}`);
    return { success: false, error: errorMessages };
  }

  try {
    const res = await authFetch(`${getApiUrl()}/api/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, milestones: validation.data }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error || data.message || 'Failed to create milestones';
      toast.error(message);
      return { success: false, error: message, data };
    }

    toast.success('Milestones added successfully!');
    return { success: true, data };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create milestones';
    toast.error(message);
    return { success: false, error: message };
  }
}

export interface UseMilestonesFormOptions {
  totalBudget?: number;
  initialMilestones?: MilestoneFormData[];
}

export function useMilestonesForm(projectId: string, options: UseMilestonesFormOptions = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const unsavedWarning = useUnsavedChangesWarning({ isDirty });
  const totalBudget = options.totalBudget || 0;
  
  const [errors, setErrors] = useState<Array<Partial<Record<keyof MilestoneFormData, string>>>>([{}]);
  
  const [milestones, setMilestones] = useState<MilestoneFormData[]>(
    options.initialMilestones && options.initialMilestones.length > 0
      ? options.initialMilestones
      : [
          {
            title: 'Initial Phase & Design',
            description: 'Architecture design, scope documentation, and prototypes',
            amount: totalBudget > 0 ? totalBudget * 0.4 : 100,
            due_date: '',
            milestone_index: 0,
            revision_limit: 1,
            deliverable_type: 'GitHub Repository',
          },
          {
            title: 'Final Implementation & Deployment',
            description: 'Production deployment, testing, and delivery',
            amount: totalBudget > 0 ? totalBudget * 0.6 : 150,
            due_date: '',
            milestone_index: 1,
            revision_limit: 1,
            deliverable_type: 'GitHub Repository',
          },
        ]
  );

  const totalAllocatedAmount = useMemo(
    () => milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0),
    [milestones]
  );

  const totalAllocatedPercent = useMemo(
    () => (totalBudget > 0 ? Math.round((totalAllocatedAmount / totalBudget) * 1000) / 10 : 100),
    [totalAllocatedAmount, totalBudget]
  );

  const isBalanced = useMemo(() => {
    if (totalBudget <= 0) return true;
    return Math.abs(totalAllocatedPercent - 100) <= 0.1;
  }, [totalBudget, totalAllocatedPercent]);

  const handleMilestoneChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setIsDirty(true);
    const numericFields = ['amount', 'milestone_index', 'revision_limit'];
    const newValue = numericFields.includes(name) ? Number(value) : value;

    setMilestones((prev) => {
      const newMilestones = [...prev];
      newMilestones[index] = { ...newMilestones[index], [name]: newValue };
      return newMilestones;
    });

    setErrors((prev) => {
      const newErrors = [...prev];
      if (newErrors[index] && newErrors[index][name as keyof MilestoneFormData]) {
        newErrors[index] = { ...newErrors[index], [name]: undefined };
      }
      return newErrors;
    });
  };

  const reorderMilestones = useCallback((fromIndex: number, toIndex: number) => {
    setIsDirty(true);
    setMilestones((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const reordered = [...prev];
      const [movedItem] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, movedItem);
      return reordered.map((m, i) => ({ ...m, milestone_index: i }));
    });
  }, []);

  const autoBalance = useCallback(
    (budgetOverride?: number) => {
      const targetBudget = budgetOverride || totalBudget;
      if (targetBudget <= 0 || milestones.length === 0) return;

      setIsDirty(true);
      const count = milestones.length;
      const baseAmt = Math.floor((targetBudget / count) * 100) / 100;
      let allocated = 0;

      const updated = milestones.map((m, i) => {
        const isLast = i === count - 1;
        const amt = isLast ? Math.round((targetBudget - allocated) * 100) / 100 : baseAmt;
        allocated += amt;
        return {
          ...m,
          amount: amt,
        };
      });

      setMilestones(updated);
      toast.success(`Milestones auto-balanced to 100% of budget (${targetBudget})`);
    },
    [totalBudget, milestones]
  );

  const addMilestone = () => {
    setIsDirty(true);
    const nextIdx = milestones.length;
    const remaining = totalBudget > 0 ? Math.max(0, totalBudget - totalAllocatedAmount) : 0;
    setMilestones((prev) => [
      ...prev,
      {
        title: `Milestone ${nextIdx + 1}`,
        description: '',
        amount: remaining > 0 ? remaining : 0,
        due_date: '',
        milestone_index: nextIdx,
        revision_limit: 1,
        deliverable_type: 'GitHub Repository',
      },
    ]);
    setErrors((prev) => [...prev, {}]);
  };

  const removeMilestone = (index: number) => {
    if (milestones.length <= 1) return;
    setIsDirty(true);
    setMilestones((prev) => {
      const newM = [...prev];
      newM.splice(index, 1);
      return newM.map((m, i) => ({ ...m, milestone_index: i }));
    });
    setErrors((prev) => {
      const newE = [...prev];
      newE.splice(index, 1);
      return newE;
    });
  };

  const validateForm = (): boolean => {
    // 1. Total budget allocation verification
    if (totalBudget > 0 && !isBalanced) {
      if (totalAllocatedPercent < 99.9) {
        toast.error(
          `Cannot submit: Milestones are under-allocated (${totalAllocatedPercent}% / 100%). Please auto-balance or allocate remaining ${Math.max(0, totalBudget - totalAllocatedAmount).toFixed(2)}.`
        );
        return false;
      }
      if (totalAllocatedPercent > 100.1) {
        toast.error(
          `Cannot submit: Milestones are over-allocated (${totalAllocatedPercent}% / 100%). Total exceeds budget by ${(totalAllocatedAmount - totalBudget).toFixed(2)}.`
        );
        return false;
      }
    }

    try {
      milestoneArraySchema.parse(milestones);
      setErrors(milestones.map(() => ({})));
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Array<Partial<Record<keyof MilestoneFormData, string>>> = milestones.map(() => ({}));
        const errorMessages: string[] = [];
        
        error.issues.forEach((err) => {
          const index = err.path[0] as number;
          const field = err.path[1] as keyof MilestoneFormData;
          
          if (typeof index === 'number' && field) {
            newErrors[index][field] = err.message;
            errorMessages.push(`Milestone ${index + 1}: ${err.message}`);
          } else {
            errorMessages.push(err.message);
          }
        });
        
        setErrors(newErrors);
        toast.error(`Validation failed:\n${errorMessages.join('\n')}`);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const result = await submitMilestones(projectId, milestones);
      if (!result.success) {
        setLoading(false);
        return;
      }

      setIsDirty(false);
      router.push(`/projects/${projectId}`);
    } finally {
      setLoading(false);
    }
  };

  return {
    milestones,
    setMilestones,
    loading,
    errors,
    totalAllocatedAmount,
    totalAllocatedPercent,
    isBalanced,
    reorderMilestones,
    autoBalance,
    handleMilestoneChange,
    addMilestone,
    removeMilestone,
    handleSubmit,
    isDirty,
    setIsDirty,
    unsavedWarning,
  };
}
