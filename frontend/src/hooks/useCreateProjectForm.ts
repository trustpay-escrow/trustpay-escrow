import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { projectSchema, ProjectFormData } from '@/lib/validators';
import { z } from 'zod';
import { useWalletStore } from '@/store/walletStore';
import { useRouter } from 'next/navigation';

import { SUPPORTED_TOKENS } from '@/config/tokens';

export function useCreateProjectForm() {
  const router = useRouter();
  const { address } = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectFormData, string>>>({});
  
  const [formData, setFormData] = useState<ProjectFormData>({
    title: '',
    description: '',
    category: 'Development',
    custom_category: '',
    budget: 0,
    token: 'USDC',
    token_address: SUPPORTED_TOKENS.USDC.issuerOrContractAddress,
    deadline: '',
    visibility: 'Public',
    attachments: [],
    client_address: address || '',
    yield_enabled: false,
    estimated_yield: 0,
  });

  useEffect(() => {
    if (address && formData.client_address !== address) {
      setFormData(prev => ({ ...prev, client_address: address }));
    }
  }, [address]);

  // Recalculate estimated yield whenever budget, deadline, or yield_enabled changes
  useEffect(() => {
    if (formData.yield_enabled && formData.budget > 0) {
      const days = calculateDaysFromDeadline(formData.deadline);
      // 70% of budget into Blend pool earning ~4.5% APY
      const blendAmount = formData.budget * 0.70;
      const estYield = (blendAmount * 0.045 * days) / 365;
      setFormData(prev => ({ ...prev, estimated_yield: Number(estYield.toFixed(2)) }));
    } else {
      setFormData(prev => ({ ...prev, estimated_yield: 0 }));
    }
  }, [formData.budget, formData.deadline, formData.yield_enabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newValue = name === 'budget' ? Number(value) : value;
    setFormData(prev => ({ ...prev, [name]: newValue }));
    
    // Clear error for this field when user types
    if (errors[name as keyof ProjectFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const toggleYield = (enabled: boolean) => {
    setFormData(prev => ({ ...prev, yield_enabled: enabled }));
  };

  const handleFileUploadMock = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileNames = Array.from(e.target.files).map(f => f.name);
      setFormData(prev => ({ ...prev, attachments: [...(prev.attachments || []), ...fileNames] }));
      toast.success(`${fileNames.length} file(s) attached (mock)`);
    }
  };

  const validateForm = (): boolean => {
    try {
      projectSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof ProjectFormData, string>> = {};
        error.issues.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as keyof ProjectFormData] = err.message;
          }
        });
        setErrors(newErrors);
        
        // Show specific error messages in the toast
        const errorMessages = error.issues.map(err => err.message).join(' • ');
        toast.error(`Validation failed: ${errorMessages}`);
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
      const res = await fetch('http://localhost:3001/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) {
            // Zod error from backend
            console.error('Backend validation details:', data.details);
            throw new Error(data.error || 'Backend validation failed');
        }
        throw new Error(data.error || 'Failed to create project');
      }

      toast.success('Project created successfully!');
      
      // Redirect to milestones creation page
      if (data.project && data.project.id) {
        router.push(`/projects/${data.project.id}/milestones/create`);
      } else {
        // Fallback reset if no ID returned (shouldn't happen)
        setFormData({
          title: '',
          description: '',
          category: 'Development',
          custom_category: '',
          budget: 0,
          token: 'USDC',
          token_address: SUPPORTED_TOKENS.USDC.issuerOrContractAddress,
          deadline: '',
          visibility: 'Public',
          attachments: [],
          client_address: address || '',
          yield_enabled: false,
          estimated_yield: 0,
        });
        setErrors({});
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    loading,
    errors,
    handleChange,
    toggleYield,
    handleFileUploadMock,
    handleSubmit
  };
}

export function calculateDaysFromDeadline(deadlineStr: string): number {
  if (!deadlineStr) return 14; // Default fallback duration 14 days
  const deadlineDate = new Date(deadlineStr);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 14;
}
