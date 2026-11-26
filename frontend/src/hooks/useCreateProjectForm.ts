import { useState, useEffect, useCallback, useRef } from 'react';
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
import { useOfflineSync, OfflineStatusPill } from '@/hooks/useOfflineSync';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';

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

/**
 * Returns the compact prefix badge label (`$`, `€`, or `XLM`) displayed inside amount inputs.
 */
export function getCurrencySymbolPrefix(token: string | null | undefined): string {
  const normalized = (token || "").trim().toUpperCase();
  if (!normalized || normalized === "USDC" || normalized === "PYUSD") return "$";
  if (normalized === "EURC") return "€";
  if (normalized === "XLM") return "XLM";
  return normalized;
}

/**
 * Computes left input padding so right-aligned numbers never collide with the currency prefix badge.
 */
export function getCurrencyInputPaddingClass(prefix: string): string {
  const len = prefix.trim().length;
  if (len <= 1) return "pl-11";
  if (len <= 3) return "pl-16";
  return "pl-20";
}

/**
 * Parses raw numeric text into a clean finite number (or `""` when cleared), stripping any stray
 * currency symbols, whitespace, or grouping commas.
 */
export function parseCurrencyNumericInput(rawValue: string | number): number | "" {
  if (typeof rawValue === "number") {
    return Number.isFinite(rawValue) ? rawValue : "";
  }
  const stripped = rawValue
    .replace(/(?:^|[^a-zA-Z])(?:USDC|EURC|PYUSD|XLM)(?=[\s\d.,$€₱✦]|$)/gi, "")
    .replace(/[$€₱✦,\s]/g, "")
    .trim();
  if (stripped === "" || stripped === "-" || stripped === "." || stripped === "-.") {
    return "";
  }
  const parsed = Number(stripped);
  return Number.isFinite(parsed) ? parsed : "";
}

export function isBalanceSufficient(balance: number | null, budget: number): boolean {
  return getBalanceShortfall(balance, budget) === 0;
}

export function readTokenBalance(account: HorizonAccountResponse, token: string): number {
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

/**
 * Loads the connected wallet's balance for every supported token in a single Horizon request so the
 * token selector can show each asset's available balance side by side.
 */
export function useTokenBalances(address: string | null | undefined) {
  const [balances, setBalances] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setBalances({});
      return;
    }
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    fetch(`${HORIZON_URL}/accounts/${encodeURIComponent(address)}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) return {} as HorizonAccountResponse;
        if (!response.ok) throw new Error(`Balance lookup failed (${response.status})`);
        return (await response.json()) as HorizonAccountResponse;
      })
      .then((account) => {
        if (!active) return;
        const next: Record<string, number | null> = {};
        Object.keys(SUPPORTED_TOKENS).forEach((symbol) => {
          next[symbol] = readTokenBalance(account, symbol);
        });
        setBalances(next);
      })
      .catch(() => {
        if (active && !controller.signal.aborted) setBalances({});
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [address]);

  return { balances, loading };
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
  const [isDirty, setIsDirty] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const unsavedWarning = useUnsavedChangesWarning({ isDirty });
  
  const {
    isOnline,
    persistDraft,
    loadDraft,
    removeDraft,
    queueSubmission,
  } = useOfflineSync({
    draftKey: 'create-project-draft',
    draftType: 'project',
    autoSyncOnOnline: true,
  });

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

  const walletBalance = useTokenBalance(address, formData.token);
  const allTokenBalances = useTokenBalances(address);
  const refreshBalance = walletBalance.refresh;
  const balanceShortfall = getBalanceShortfall(walletBalance.balance, formData.budget);
  const hasSufficientBalance = isBalanceSufficient(walletBalance.balance, formData.budget);
  const autoFundRef = useRef<'idle' | 'waiting' | 'reloading'>('idle');

  // Address sync
  useEffect(() => {
    if (address && formData.client_address !== address) {
      setFormData((prev) => ({ ...prev, client_address: address }));
    }
  }, [address]);

  // Load offline draft on mount if available
  useEffect(() => {
    let mounted = true;
    loadDraft<any>('create-project-draft').then((draft) => {
      const saved = draft && typeof draft === 'object' && 'payload' in draft ? draft.payload : draft;
      if (mounted && saved && typeof saved === 'object') {
        setFormData((prev) => ({
          ...prev,
          ...saved,
          client_address: address || saved.client_address || '',
        }));
      }
    });
    return () => {
      mounted = false;
    };
  }, [loadDraft, address]);

  // Persist draft on changes
  useEffect(() => {
    if (formData.title || formData.description || formData.budget > 0) {
      void persistDraft(formData, 'create-project-draft');
      setDraftSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [formData, persistDraft]);

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
    setIsDirty(true);
    let newValue: any = value;
    if (name === 'budget') {
      const parsed = parseCurrencyNumericInput(value);
      newValue = parsed === '' ? 0 : parsed;
    }
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
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, yield_enabled: enabled }));
  };

  const handleFileUploadMock = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileNames = Array.from(e.target.files).map((f) => f.name);
      setIsDirty(true);
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
      void removeDraft('create-project-draft');
      setFormData({ ...defaultInitialData, client_address: address || '' });
      setDraftSavedAt(null);
      setErrors({});
      setCurrentStep(1);
      toast.info('Draft cleared');
    } catch {}
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

    // If offline, queue request for automatic sync on reconnect
    if (!isOnline) {
      try {
        await queueSubmission({
          url: 'http://localhost:3001/api/projects',
          method: 'POST',
          body: formData,
          description: `Create project draft: ${formData.title}`,
        });
        await removeDraft('create-project-draft');
        setIsDirty(false);
        toast.warning(
          'Offline: Project creation queued in IndexedDB. Will automatically sync when connection returns!',
          { duration: 6000 }
        );
        router.push('/projects');
      } catch (err: any) {
        toast.error('Failed to queue offline submission');
      } finally {
        setLoading(false);
      }
      return;
    }

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

      await removeDraft('create-project-draft');
      setIsDirty(false);
      toast.success('Project created and escrow initialized successfully!');
      
      // Redirect to milestones creation page
      if (data.project && data.project.id) {
        router.push(`/projects/${data.project.id}/milestones/create`);
      } else {
        setFormData({ ...defaultInitialData, client_address: address || '' });
        setErrors({});
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  /** Called once a fiat on-ramp deposit lands: refreshes the balance, then funds the escrow automatically. */
  const handleFiatDepositDetected = useCallback(
    (result: { amount: number }) => {
      toast.success(`${result.amount} USDC received. Funding your escrow…`);
      autoFundRef.current = 'waiting';
      refreshBalance();
    },
    [refreshBalance]
  );

  /** Called after a DEX path-payment swap lands USDC in the wallet so the balance check updates. */
  const handlePathSwapComplete = useCallback(
    (result: { received: number; token: string }) => {
      toast.success(`Received at least ${result.received} ${result.token}. Balance updated.`);
      refreshBalance();
    },
    [refreshBalance]
  );

  useEffect(() => {
    const phase = autoFundRef.current;
    if (phase === 'waiting' && walletBalance.loading) {
      autoFundRef.current = 'reloading';
    } else if (phase === 'reloading' && !walletBalance.loading) {
      autoFundRef.current = 'idle';
      if (hasSufficientBalance && !loading) {
        // Defer so the submit runs after this render commits, with the refreshed balance.
        setTimeout(() => void handleSubmit(), 0);
      } else {
        toast.info(
          `Deposit received, but your ${formData.token} balance is still short. Add more funds or lower the budget.`
        );
      }
    }
    // handleSubmit intentionally omitted: it closes over the latest form state on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletBalance.loading]);

  return {
    formData,
    setFormData,
    currencyPrefix: getCurrencySymbolPrefix(formData.token),
    handleFiatDepositDetected,
    handlePathSwapComplete,
    loading,
    errors,
    currentStep,
    setCurrentStep,
    nextStep,
    prevStep,
    validateStep,
    draftSavedAt,
    clearDraft,
    isOnline,
    OfflineStatusPill,
    handleChange,
    toggleYield,
    handleFileUploadMock,
    handleSubmit,
    walletBalance: walletBalance.balance,
    balanceLoading: walletBalance.loading,
    balanceError: walletBalance.error,
    tokenBalances: allTokenBalances.balances,
    tokenBalancesLoading: allTokenBalances.loading,
    balanceShortfall,
    hasSufficientBalance,
    refreshBalance: walletBalance.refresh,
    isDirty,
    setIsDirty,
    unsavedWarning,
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
