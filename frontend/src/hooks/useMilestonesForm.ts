import { useState } from 'react';
import { toast } from 'sonner';
import { milestoneArraySchema, MilestoneFormData } from '@/lib/validators';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

export function useMilestonesForm(projectId: string) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [errors, setErrors] = useState<Array<Partial<Record<keyof MilestoneFormData, string>>>>([{}]);
  
  const [milestones, setMilestones] = useState<MilestoneFormData[]>([{
    title: '',
    description: '',
    amount: 0,
    due_date: '',
    milestone_index: 0,
    revision_limit: 0,
    deliverable_type: '',
  }]);

  const handleMilestoneChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    const numericFields = ['amount', 'milestone_index', 'revision_limit'];
    const newValue = numericFields.includes(name) ? Number(value) : value;

    setMilestones(prev => {
      const newMilestones = [...prev];
      newMilestones[index] = { ...newMilestones[index], [name]: newValue };
      return newMilestones;
    });
    
    setErrors(prev => {
      const newErrors = [...prev];
      if (newErrors[index] && newErrors[index][name as keyof MilestoneFormData]) {
        newErrors[index] = { ...newErrors[index], [name]: undefined };
      }
      return newErrors;
    });
  };

  const addMilestone = () => {
    setMilestones(prev => [
      ...prev,
      {
        title: '',
        description: '',
        amount: 0,
        due_date: '',
        milestone_index: prev.length,
        revision_limit: 0,
        deliverable_type: '',
      }
    ]);
    setErrors(prev => [...prev, {}]);
  };

  const removeMilestone = (index: number) => {
    if (milestones.length <= 1) return;
    
    setMilestones(prev => {
      const newM = [...prev];
      newM.splice(index, 1);
      return newM.map((m, i) => ({ ...m, milestone_index: i }));
    });
    
    setErrors(prev => {
      const newE = [...prev];
      newE.splice(index, 1);
      return newE;
    });
  };

  const validateForm = (): boolean => {
    try {
      milestoneArraySchema.parse(milestones);
      setErrors(milestones.map(() => ({})));
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Array<Partial<Record<keyof MilestoneFormData, string>>> = milestones.map(() => ({}));
        let errorMessages: string[] = [];
        
        error.issues.forEach(err => {
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
      const res = await fetch(`http://localhost:3001/api/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, milestones }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create milestones');
      }

      toast.success('Milestones added successfully!');
      router.push(`/projects/${projectId}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    milestones,
    loading,
    errors,
    handleMilestoneChange,
    addMilestone,
    removeMilestone,
    handleSubmit
  };
}
