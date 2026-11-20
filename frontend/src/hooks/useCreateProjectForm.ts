import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  projectSchema,
  step1OverviewSchema,
  step2MilestonesSchema,
  step3TokenYieldSchema,
  ProjectFormData,
} from '@/lib/validators';
import { z } from 'zod';
import { useWalletStore } from '@/store/walletStore';
import { useRouter } from 'next/navigation';

import { SUPPORTED_TOKENS } from '@/config/tokens';
import { HORIZON_URL } from '@/lib/soroban';

export const DRAFT_STORAGE_KEY = 'trustpay_project_draft';

interface HorizonBalanceLine {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

interface HorizonAccountResponse {
  balances?: HorizonBalanceLine[];
}

export function getBalanceShortfall(balance: number | null, budget: number): number {
  const requiredNumber = Number(budget);
  const availableNumber = Number(balance);
  const required = Number.isFinite(requiredNumber) && requiredNumber > 0 ? requiredNumber : 0;
  const available = Number.isFinite(availableNumber) && availableNumber > 0 ? availableNumber : 0;
  return Math.max(0, Number((required - available).toFixed(7)));
}

export function isBalanceSufficient(balance: number | null, budget: number): boolean {
  return getBalanceShortfall(balance, budget) === 0;
}

function readTokenBalance(account: HorizonAccountResponse, token: string): number {
  const tokenConfig = SUPPORTED_TOKENS[token];
  const lines = account.balances || [];
  const match = lines.find((line) => {
    if (token === 'XLM') return line.asset_type === 'native';
    if (tokenConfig && line.asset_issuer) {
      return (
        line.asset_code === tokenConfig.symbol &&
        line.asset_issuer.toLowerCase() === tokenConfig.issuerOrContractAddress.toLowerCase()
      );
    }
    return line.asset_code === token;
  });
  const value = match ? Number(match.balance) : 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function useTokenBalance(address: string | null | undefined, token: string) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadBalance() {
      if (!address) {
        if (active) {
          setBalance(null);
          setError(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${HORIZON_URL}/accounts/${encodeURIComponent(address)}`, {
          signal: controller.signal,
        });
        if (response.status === 404) {
          if (active) setBalance(0);
          return;
        }
        if (!response.ok) {
          throw new Error(`Balance lookup failed (${response.status})`);
        }
        const account = (await response.json()) as HorizonAccountResponse;
        if (active) setBalance(readTokenBalance(account, token));
      } catch (err) {
        if (controller.signal.aborted) return;
        if (active) {
          setBalance(null);
          setError(err instanceof Error ? err.message : 'Could not load wallet balance');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadBalance();
    return () => {
      active = false;
      controller.abort();
    };
  }, [address, token, reloadKey]);

  return { balance, loading, error, refresh };
}

const defaultInitialData: ProjectFormData = {
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
  client_address: '',
  yield_enabled: false,
  estimated_yield: 0,
};

export function useCreateProjectForm() {
  const router = useRouter();
  const { address } = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectFormData, string>>>({});
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const [formData, setFormData] = useState<ProjectFormData>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...defaultInitialData, ...parsed, client_address: address || parsed.client_address || '' };
        }
      } catch (e) {
        console.warn('Failed to parse draft from localStorage', e);
      }
    }
    return { ...defaultInitialData, client_address: address || '' };
  });

  const walletBalance = useTokenBalance(address, formData.token);
  const balanceShortfall = getBalanceShortfall(walletBalance.balance, formData.budget);
  const hasSufficientBalance = isBalanceSufficient(walletBalance.balance, formData.budget);

  // Address sync
  useEffect(() => {
    if (address && formData.client_address !== address) {
      setFormData((prev) => ({ ...prev, client_address: address }));
    }
  }, [address]);

  // Auto-save draft to localStorage whenever relevant fields change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (formData.title || formData.description || formData.budget > 0) {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
        setDraftSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (e) {
        console.warn('Could not auto-save draft', e);
      }
    }
  }, [formData]);

  // Recalculate estimated yield whenever budget, deadline, or yield_enabled changes
  useEffect(() => {
    if (formData.yield_enabled && formData.budget > 0) {
      const days = calculateDaysFromDeadline(formData.deadline);
      // 70% of budget into Blend pool earning ~4.5% APY
      const blendAmount = formData.budget * 0.70;
      const estYield = (blendAmount * 0.045 * days) / 365;
      setFormData((prev) => ({ ...prev, estimated_yield: Number(estYield.toFixed(2)) }));
    } else {
      setFormData((prev) => ({ ...prev, estimated_yield: 0 }));
    }
  }, [formData.budget, formData.deadline, formData.yield_enabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let newValue: any = value;
    if (name === 'budget') newValue = Number(value);
    if (name === 'token') {
      const tokenConfig = SUPPORTED_TOKENS[value as keyof typeof SUPPORTED_TOKENS];
      setFormData((prev) => ({
        ...prev,
        token: value as any,
        token_address: tokenConfig?.issuerOrContractAddress || '',
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: newValue }));

    // Clear error for this field when user types
    if (errors[name as keyof ProjectFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const toggleYield = (enabled: boolean) => {
    setFormData((prev) => ({ ...prev, yield_enabled: enabled }));
  };

  const handleFileUploadMock = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileNames = Array.from(e.target.files).map((f) => f.name);
      setFormData((prev) => ({ ...prev, attachments: [...(prev.attachments || []), ...fileNames] }));
      toast.success(`${fileNames.length} file(s) attached (mock)`);
    }
  };

  const validateStep = (stepNumber: number): boolean => {
    try {
      if (stepNumber === 1) {
        step1OverviewSchema.parse(formData);
      } else if (stepNumber === 2) {
        step2MilestonesSchema.parse(formData);
      } else if (stepNumber === 3) {
        step3TokenYieldSchema.parse(formData);
      } else if (stepNumber === 4) {
        projectSchema.parse(formData);
      }
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof ProjectFormData, string>> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as keyof ProjectFormData] = err.message;
          }
        });
        setErrors(newErrors);
        const errorMessages = error.issues.map((err) => err.message).join(' • ');
        toast.error(`Step ${stepNumber} validation failed: ${errorMessages}`);
      }
      return false;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setFormData({ ...defaultInitialData, client_address: address || '' });
      setDraftSavedAt(null);
      setErrors({});
      setCurrentStep(1);
      toast.info('Draft cleared');
    } catch (e) {}
  };

  const validateForm = (): boolean => {
    try {
      projectSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof ProjectFormData, string>> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as keyof ProjectFormData] = err.message;
          }
        });
        setErrors(newErrors);
        const errorMessages = error.issues.map((err) => err.message).join(' • ');
        toast.error(`Validation failed: ${errorMessages}`);
      }
      return false;
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (walletBalance.balance !== null && balanceShortfall > 0) {
      toast.error(
        `Insufficient ${formData.token} balance. You need ${balanceShortfall.toLocaleString()} more ${formData.token}.`
      );
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
          console.error('Backend validation details:', data.details);
          throw new Error(data.error || 'Backend validation failed');
        }
        throw new Error(data.error || 'Failed to create project');
      }

      toast.success('Project created and escrow initialized successfully!');
      // Clear draft on successful submission
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}

      if (data.project && data.project.id) {
        router.push(`/projects/${data.project.id}/milestones/create`);
      } else {
        setFormData({ ...defaultInitialData, client_address: address || '' });
        setErrors({});
        setCurrentStep(1);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    setFormData,
    loading,
    errors,
    currentStep,
    setCurrentStep,
    nextStep,
    prevStep,
    validateStep,
    draftSavedAt,
    clearDraft,
    handleChange,
    toggleYield,
    handleFileUploadMock,
    handleSubmit,
    walletBalance: walletBalance.balance,
    balanceLoading: walletBalance.loading,
    balanceError: walletBalance.error,
    balanceShortfall,
    hasSufficientBalance,
    refreshBalance: walletBalance.refresh,
  };
}

export function calculateDaysFromDeadline(deadlineStr: string): number {
  if (!deadlineStr) return 14;
  const deadlineDate = new Date(deadlineStr);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 14;
}
