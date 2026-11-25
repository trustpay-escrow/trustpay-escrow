'use client';

import React, { useState, useEffect, useMemo } from 'react';
import NumberRoll from './NumberRoll';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useWalletStore, useActiveWalletAddress, canRaiseDispute } from '@/store/walletStore';
import { authFetch } from '@/lib/api';
import { useEscapeKey } from '@/hooks/useEscapeKey';

import { Milestone, Project, Applicant } from '@/types';
import { ImageLightboxModal } from './ImageLightboxModal';
import { ApplicantCard, type ApplicantCardData } from './ApplicantCard';
import { FreelancerProfileModal } from './FreelancerProfileModal';
import { ProjectChatModal } from './ProjectChatModal';
import { MilestoneBuilderCanvas } from './MilestoneBuilderCanvas';
import { ProjectCardSkeletonList } from '@/components/skeletons';
import { SUPPORTED_TOKENS } from '@/config/tokens';
import { useTokenBalance, useTokenBalances, getBalanceShortfall } from '@/hooks/useCreateProjectForm';
import { TokenSelector } from '@/components/TokenSelector';
import { CurrencyAmountInput } from '@/components/CurrencyAmountInput';
import { usePersistentTab } from '@/hooks/usePersistentTab';
import { BalanceWarningBadge } from '@/components/BalanceWarningBadge';
import { LiquidityDepthOptimizer } from '@/components/LiquidityDepthOptimizer';
import { TokenPriceAlertWidget } from '@/components/TokenPriceAlertWidget';
import { StarredFreelancersList } from '@/components/StarredFreelancersList';
import { NotificationScheduleModal } from '@/components/NotificationScheduleModal';
import { ProposalCounterOfferModal } from '@/components/ProposalCounterOfferModal';
import { useStarredFreelancers } from '@/hooks/useStarredFreelancers';
import type { CounterOffer } from '@/lib/counter-offer';
import { showSorobanErrorToast } from '@/components/SorobanErrorToast';
import { ProjectAuditLog } from '@/components/ProjectAuditLog';
import { CalendarExportButton } from '@/components/CalendarExportButton';
import { DownloadReceiptButton } from '@/components/DownloadReceiptButton';
import { AccountsPayableExportModal } from '@/components/AccountsPayableExportModal';
import { GasFeeEstimatorWidget } from '@/components/GasFeeEstimatorWidget';
import { BlendYieldVisualizer } from '@/components/BlendYieldVisualizer';
import { CurrencyConverterWidget } from '@/components/CurrencyConverterWidget';
import { BLEND_ALLOCATION_RATIO } from '@/lib/blend-yield';
import {
  createProjectOnChain,
  lockEscrowOnChain,
  assignFreelancerOnChain,
  getStellarExplorerUrl,
  DEFAULT_ESCROW_CONTRACT_ID,
  setSorobanBaseFee,
  fetchMultisigAccountInfo,
  isMultisigAccount,
  cancelUnassignedProjectOnChain,
  raiseDisputeOnChain,
  buildCreateProjectArgs,
  SorobanResourceFootprint,
} from '@/lib/soroban';
import { nativeToScVal, xdr, Address } from '@stellar/stellar-sdk';
import { SorobanResourceInspectorModal } from '@/components/SorobanResourceInspectorModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  MultisigApprovalModal,
  PendingSignaturesDrawer,
} from '@/components/MultisigApprovalModal';
import type { PendingMultisigRequest } from '@/store/walletStore';
import { EmptyState } from '@/components/EmptyState';
import { ProjectActionsDropdown } from '@/components/ProjectActionsDropdown';
import { OfflineStatusPill } from '@/components/OfflineStatusPill';

export interface ClientDashboardProps {
  defaultTab?: 'projects' | 'create' | 'applicants' | 'saved';
}

export function ClientDashboard({ defaultTab = 'projects' }: ClientDashboardProps) {
  const router = useRouter();
  const { address, pendingMultisig, targetNetwork } = useWalletStore();
  const activeWalletAddress = useActiveWalletAddress();
  const [isMultisig, setIsMultisig] = useState(false);
  const [showPendingDrawer, setShowPendingDrawer] = useState(false);
  const [multisigRequest, setMultisigRequest] = useState<PendingMultisigRequest | null>(null);
  const [showMultisigModal, setShowMultisigModal] = useState(false);
  const accountPendingMultisig = pendingMultisig.filter(
    (r) => r.accountAddress === activeWalletAddress
  );
  const { starred, isStarred, toggle: toggleStarred, setNotes: setStarredNotes } =
    useStarredFreelancers(activeWalletAddress);
  const [activeTab, setActiveTab] = usePersistentTab<"projects" | "create" | "applicants" | "saved">({
    key: 'client_active_tab',
    defaultTab,
    allowedTabs: ['projects', 'create', 'applicants', 'saved'] as const,
    walletAddress: address,
  });
  // Search and token filters persisted across navigation (#177)
  const [projectSearch, setProjectSearch] = usePersistentFilter<string>('client_projects_search', '', address);
  const [projectToken, setProjectToken] = usePersistentFilter<string>('client_projects_token', 'All', address);
  const [showBulkPayout, setShowBulkPayout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name?: string } | null>(null);

  // Chat Modal State
  const [chatModalState, setChatModalState] = useState<{
    isOpen: boolean;
    projectId: string;
    projectTitle: string;
    senderAddress: string;
    receiverAddress: string;
    recipientRoleLabel: string;
  }>({
    isOpen: false,
    projectId: '',
    projectTitle: '',
    senderAddress: '',
    receiverAddress: '',
    recipientRoleLabel: 'Freelancer',
  });

  // Projects state initialized from backend
  const [projects, setProjects] = useState<Project[]>([]);

  const visibleProjects = React.useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesToken = projectToken === 'All' || (project.token || 'USDC') === projectToken;
      const matchesSearch =
        query.length === 0 ||
        [project.title, project.subtitle, project.description, project.category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      return matchesToken && matchesSearch;
    });
  }, [projects, projectSearch, projectToken]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProjects, setTotalProjects] = useState(0);

  // Selected project for Applicants view
  const [selectedProjectForApplicants, setSelectedProjectForApplicants] = useState<Project | null>(null);
  const [profileApplicant, setProfileApplicant] = useState<Applicant | null>(null);
  const [auditProject, setAuditProject] = useState<Project | null>(null);
  const [reminderProject, setReminderProject] = useState<Project | null>(null);

  // Create Project Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('Development');
  const [customCategory, setCustomCategory] = useState('');
  const [formProjectType, setFormProjectType] = useState('Fixed price');
  const [formBudget, setFormBudget] = useState<number | ''>('');
  const [formToken, setFormToken] = useState<'USDC' | 'EURC' | 'XLM' | 'PYUSD'>('USDC');
  const [formDeadline, setFormDeadline] = useState('');
  const [formVisibility, setFormVisibility] = useState<'Public' | 'Invite-only'>('Public');
  const [formAttachments, setFormAttachments] = useState<any[]>([]);
  const [formYieldEnabled, setFormYieldEnabled] = useState(false);
  const [formFreelancerAddress, setFormFreelancerAddress] = useState('');
  const [formLockImmediately, setFormLockImmediately] = useState(false);
  const [configuredFeeStroops, setConfiguredFeeStroops] = useState<number>(100);
  const [fundingTxMessage, setFundingTxMessage] = useState('');
  const walletBalance = useTokenBalance(activeWalletAddress, formToken);
  const tokenBalances = useTokenBalances(activeWalletAddress);
  const balanceShortfall = getBalanceShortfall(walletBalance.balance, formBudget === '' ? 0 : formBudget);
  const hasInsufficientBalance = walletBalance.balance !== null && balanceShortfall > 0;
  
  // Today's date string for restricting date pickers to current or future dates
  const todayStr = new Date().toISOString().split('T')[0];

  // Active escrows whose principal is deposited into Blend
  const blendYieldProjects = projects.filter(
    (p) => p.yield_enabled && p.status !== 'completed' && p.status !== 'draft' && p.budget > 0
  );

  const calculateEstimatedYield = () => {
    if (!formYieldEnabled || !formBudget || Number(formBudget) <= 0) return '0.00';
    const budgetNum = Number(formBudget);
    const blendPrincipal = budgetNum * 0.7;
    let days = 14;
    if (formDeadline) {
      const diffMs = new Date(formDeadline).getTime() - Date.now();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 0) days = diffDays;
    }
    const yieldVal = (blendPrincipal * 0.045 * days) / 365;
    return yieldVal.toFixed(2);
  };

  // Milestones list for form (initialized as empty)
  const [formMilestones, setFormMilestones] = useState<Milestone[]>([]);
  const [showDaoProposal, setShowDaoProposal] = useState(false);

  // Escrow terms handed to the DAO proposal generator, mirroring what the
  // on-chain create flow would submit (milestones, or one tranche for the budget).
  const daoProposalDefaults = useMemo(
    () => ({
      projectTitle: formTitle.trim(),
      description: formDescription,
      category: formCategory === 'Other' ? customCategory.trim() || 'Other' : formCategory,
      token: formToken,
      tokenAddress: SUPPORTED_TOKENS[formToken]?.issuerOrContractAddress ?? '',
      freelancerAddress: formFreelancerAddress.trim(),
      milestones:
        formMilestones.length > 0
          ? formMilestones.map((m) => ({ title: m.title, amount: Number(m.amount), due_date: m.due_date }))
          : [{ title: 'Full project', amount: Number(formBudget) || 0 }],
      yieldEnabled: formYieldEnabled,
      deadline: formDeadline || undefined,
    }),
    [
      formTitle,
      formDescription,
      formCategory,
      customCategory,
      formToken,
      formFreelancerAddress,
      formMilestones,
      formBudget,
      formYieldEnabled,
      formDeadline,
    ]
  );
  const canGenerateDaoProposal = formTitle.trim().length > 0 && Number(formBudget) > 0;

  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDescription, setNewMilestoneDescription] = useState('');
  const [newMilestoneAmount, setNewMilestoneAmount] = useState<number | ''>('');
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState('');
  const [newMilestoneRevisionLimit, setNewMilestoneRevisionLimit] = useState<number>(0);
  const [newMilestoneDeliverableType, setNewMilestoneDeliverableType] =
    useState('GitHub Repository');
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState(false);
  const [showApExportModal, setShowApExportModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Soroban Resource Inspector — pre-flight simulation state
  const [inspectorTransaction, setInspectorTransaction] = useState<{
    contractAddress: string;
    functionName: string;
    args: xdr.ScVal[];
    description: string;
  } | null>(null);
  const [inspectorResolve, setInspectorResolve] = useState<
    ((fp: SorobanResourceFootprint | null) => void) | null
  >(null);

  /**
   * Opens the Soroban Resource Inspector modal and waits for the user to
   * proceed or cancel.  Returns the footprint when the user clicks "Proceed
   * to Signing", or null if they close the modal.
   */
  const runPreflightInspection = (tx: {
    contractAddress: string;
    functionName: string;
    args: xdr.ScVal[];
    description: string;
  }): Promise<SorobanResourceFootprint | null> => {
    return new Promise((resolve) => {
      setInspectorTransaction(tx);
      setInspectorResolve(() => resolve);
    });
  };

  const handleInspectorClose = () => {
    setInspectorTransaction(null);
    if (inspectorResolve) {
      inspectorResolve(null);
      setInspectorResolve(null);
    }
  };

  const handleInspectorProceed = (fp: SorobanResourceFootprint) => {
    setInspectorTransaction(null);
    if (inspectorResolve) {
      inspectorResolve(fp);
      setInspectorResolve(null);
    }
  };

  const { isOnline, persistDraft, loadDraft, removeDraft, queueSubmission } = useOfflineSync({
    draftKey: 'client-dashboard-project-draft',
    draftType: 'project',
  });

  // Restore draft from IndexedDB on initial mount
  useEffect(() => {
    let isMounted = true;
    async function restoreLocalDraft() {
      const saved = await loadDraft<any>('client-dashboard-project-draft');
      if (saved && isMounted && (saved.formTitle || saved.formBudget)) {
        if (saved.formTitle) setFormTitle(saved.formTitle);
        if (saved.formDescription) setFormDescription(saved.formDescription);
        if (saved.formCategory) setFormCategory(saved.formCategory);
        if (saved.customCategory) setCustomCategory(saved.customCategory);
        if (saved.formProjectType) setFormProjectType(saved.formProjectType);
        if (saved.formBudget) setFormBudget(saved.formBudget);
        if (saved.formToken) setFormToken(saved.formToken);
        if (saved.formDeadline) setFormDeadline(saved.formDeadline);
        if (saved.formVisibility) setFormVisibility(saved.formVisibility);
        if (saved.formYieldEnabled !== undefined) setFormYieldEnabled(saved.formYieldEnabled);
        if (saved.formFreelancerAddress) setFormFreelancerAddress(saved.formFreelancerAddress);
        if (saved.formMilestones && saved.formMilestones.length > 0) setFormMilestones(saved.formMilestones);
        toast.info('Restored project draft from local IndexedDB storage');
      }
    }
    restoreLocalDraft();
    return () => {
      isMounted = false;
    };
  }, [loadDraft]);

  // Auto-save draft every 5 seconds to IndexedDB
  useEffect(() => {
    const timer = setInterval(() => {
      if (formTitle || formDescription || (formBudget !== '' && Number(formBudget) > 0)) {
        persistDraft({
          formTitle,
          formDescription,
          formCategory,
          customCategory,
          formProjectType,
          formBudget,
          formToken,
          formDeadline,
          formVisibility,
          formYieldEnabled,
          formFreelancerAddress,
          formMilestones,
        });
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [
    formTitle,
    formDescription,
    formCategory,
    customCategory,
    formProjectType,
    formBudget,
    formToken,
    formDeadline,
    formVisibility,
    formYieldEnabled,
    formFreelancerAddress,
    formMilestones,
    persistDraft,
  ]);

  // Function to fetch real projects from backend
  const fetchBackendProjects = async (pageToFetch = currentPage) => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const clientParam = activeWalletAddress ? `&client_address=${encodeURIComponent(activeWalletAddress)}` : '';
      const res = await authFetch(`${apiUrl}/api/projects?page=${pageToFetch}&limit=6${clientParam}`);
      if (res.ok) {
        const data = await res.json();
        if (data.projects && Array.isArray(data.projects)) {
          const mapped: Project[] = data.projects.map((p: any) => {
            const rawStatus = (p.status || 'draft').toLowerCase();
            let statusLabel: 'in_progress' | 'open' | 'completed' | 'draft' = 'open';
            if (rawStatus === 'in_progress' || rawStatus === 'in progress')
              statusLabel = 'in_progress';
            else if (rawStatus === 'completed') statusLabel = 'completed';
            else statusLabel = 'open';

            const msList: Milestone[] = (p.milestones || []).map((m: any, idx: number) => ({
              id: m.id || String(m.milestone_index),
              milestone_index: m.milestone_index ?? idx,
              title: m.title || `Milestone ${idx + 1}`,
              description: m.description,
              amount: Number(m.amount) || 0,
              status: m.status || 'pending',
              due_date: m.due_date,
              revision_limit: m.revision_limit ?? 0,
              deliverable_type: m.deliverable_type,
            }));

            // Applicants if open
            const realApplicants: Applicant[] = p.applicants || [];

            return {
              id: p.id,
              title: p.title,
              description: p.description || '',
              subtitle: `${p.budget} ${p.token || 'USDC'} - ${msList.length > 0 ? `${msList.length} milestone(s)` : 'awaiting applicants'}`,
              status: statusLabel,
              category: p.category || 'Development',
              budget: Number(p.budget) || 0,
              token: p.token || 'USDC',
              token_address:
                p.token_address || SUPPORTED_TOKENS[p.token || 'USDC']?.issuerOrContractAddress,
              deadline: p.deadline || '',
              visibility: p.visibility || 'public',
              contract_id: p.contract_id,
              project_id_onchain: p.project_id_onchain,
              client_address: p.client_address,
              freelancer_address: p.freelancer_address,
              milestones: msList,
              applicants: realApplicants,
              files: p.files || [],
              attachments: p.attachments || [],
              created_at: p.created_at,
              yield_enabled: Boolean(p.yield_enabled),
              estimated_yield: Number(p.estimated_yield) || 0,
            };
          });

          setProjects(mapped);
          if (mapped.length > 0) {
            const projectWithApplicants =
              mapped.find((p) => p.applicants && p.applicants.length > 0) || mapped[0];
            setSelectedProjectForApplicants(projectWithApplicants);
          } else {
            setSelectedProjectForApplicants(null);
          }
        }
        if (data.pagination) {
          setCurrentPage(data.pagination.page);
          setTotalPages(data.pagination.totalPages);
          setTotalProjects(data.pagination.totalProjects);
        }
      }
    } catch (err: any) {
      toast.error('Could not fetch projects from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackendProjects();
  }, [address, activeWalletAddress]);

  // Add Milestone to Form
  const handleAddMilestone = () => {
    if (!newMilestoneTitle.trim()) {
      toast.error('Please enter a milestone title');
      return;
    }
    if (!newMilestoneAmount || Number(newMilestoneAmount) <= 0) {
      toast.error('Please enter a valid milestone amount');
      return;
    }

    const newItem: Milestone = {
      id: Date.now().toString(),
      milestone_index: formMilestones.length,
      title: newMilestoneTitle.trim(),
      description: newMilestoneDescription.trim() || undefined,
      amount: Number(newMilestoneAmount),
      status: 'pending',
      due_date: newMilestoneDueDate || undefined,
      revision_limit: Number(newMilestoneRevisionLimit) || 0,
      deliverable_type: newMilestoneDeliverableType || 'GitHub Repository',
    };

    setFormMilestones((prev) => [...prev, newItem]);
    setNewMilestoneTitle('');
    setNewMilestoneDescription('');
    setNewMilestoneAmount('');
    setNewMilestoneDueDate('');
    setNewMilestoneRevisionLimit(0);
    setNewMilestoneDeliverableType('GitHub Repository');
    setShowAddMilestoneModal(false);
    toast.success('Milestone added!');
  };

  // Remove Milestone
  const handleRemoveMilestone = (id: string) => {
    setFormMilestones((prev) => prev.filter((m) => m.id !== id));
    toast.info('Milestone removed');
  };

  // Accept proposal/application with on-chain Soroban escrow funding (Option A & Option B)
  const handleAcceptProposal = async (proposalId: string) => {
    if (!address) {
      toast.error('Please connect your client wallet first');
      return;
    }

    const project = selectedProjectForApplicants;
    const applicant = project?.applicants?.find((a) => a.id === proposalId);
    const freelancerAddr = applicant?.freelancer_address || applicant?.stellar_address;

    let onChainId = project?.project_id_onchain;

    // Option B: Upfront escrow was funded on-chain without an assigned freelancer.
    // Bind winning freelancer to the existing on-chain escrow project.
    if (
      project &&
      onChainId &&
      freelancerAddr &&
      (!project.freelancer_id || !project.freelancer_address)
    ) {
      try {
        const assignArgs: xdr.ScVal[] = [
          nativeToScVal(BigInt(onChainId), { type: 'u64' }),
          Address.fromString(freelancerAddr).toScVal(),
        ];
        const assignFootprint = await runPreflightInspection({
          contractAddress: DEFAULT_ESCROW_CONTRACT_ID,
          functionName: 'assign_freelancer',
          args: assignArgs,
          description: `Bind Freelancer to Escrow #${onChainId}`,
        });
        if (!assignFootprint) return;
        toast.info(`Binding winning freelancer to on-chain escrow #${onChainId} in Freighter...`);
        await assignFreelancerOnChain({
          clientAddress: address,
          projectIdOnChain: onChainId,
          freelancerAddress: freelancerAddr,
        });
        toast.success(`Freelancer assigned to on-chain escrow #${onChainId}!`);
      } catch (assignErr: any) {
        toast.error(`Freelancer on-chain assignment failed: ${assignErr.message || assignErr}`);
        return;
      }
    }
    // Option A: Deposit on Award. The job was created as draft/open off-chain.
    // Client atomically locks escrow funds and binds the freelancer on-chain in one transaction.
    else if (!onChainId && freelancerAddr && project) {
      const milestoneAmounts =
        project.milestones && project.milestones.length > 0
          ? project.milestones.map((m) => Number(m.amount))
          : [Number(project.budget) || 100];

      const tokenConfig = SUPPORTED_TOKENS[project.token || 'USDC'] || SUPPORTED_TOKENS.USDC;

      try {
        const lockArgs = buildCreateProjectArgs({
          clientAddress: address,
          freelancerAddress: freelancerAddr,
          tokenAddress: project.token_address || tokenConfig.issuerOrContractAddress,
          milestoneAmounts,
          yieldEnabled: Boolean(project.yield_enabled),
        });
        const lockFootprint = await runPreflightInspection({
          contractAddress: DEFAULT_ESCROW_CONTRACT_ID,
          functionName: 'create_project',
          args: lockArgs,
          description: 'Lock Escrow on Award',
        });
        if (!lockFootprint) return;
        toast.info('Locking Escrow on Award: Please confirm transaction in Freighter...');
        const chainRes = await lockEscrowOnChain({
          clientAddress: address,
          freelancerAddress: freelancerAddr,
          tokenAddress: project.token_address || tokenConfig.issuerOrContractAddress,
          milestoneAmounts,
          yieldEnabled: Boolean(project.yield_enabled),
        });
        onChainId = chainRes.onChainProjectId ? Number(chainRes.onChainProjectId) : 1;
        toast.success(`Escrow project #${onChainId} locked on Stellar!`);
      } catch (chainErr: any) {
        toast.error(`On-chain escrow initialization failed: ${chainErr.message || chainErr}`);
        return;
      }
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await authFetch(`${apiUrl}/api/proposals/${proposalId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'accepted',
          project_id_onchain: onChainId,
        }),
      });

      if (res.ok) {
        if (project && onChainId) {
          await authFetch(`${apiUrl}/api/projects/${project.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'in_progress',
              freelancer_address: freelancerAddr,
              contract_id: DEFAULT_ESCROW_CONTRACT_ID,
              project_id_onchain: onChainId,
            }),
          });
        }

        toast.success('Proposal accepted & project funded on-chain!');
        setProjects((prev) =>
          prev.map((proj) => ({
            ...proj,
            status: (proj.applicants || []).some((app) => app.id === proposalId)
              ? 'in_progress'
              : proj.status,
            project_id_onchain: (proj.applicants || []).some((app) => app.id === proposalId)
              ? onChainId
              : proj.project_id_onchain,
            contract_id: (proj.applicants || []).some((app) => app.id === proposalId)
              ? DEFAULT_ESCROW_CONTRACT_ID
              : proj.contract_id,
            applicants: (proj.applicants || [])
              .filter((app) => app.id === proposalId)
              .map((app) => ({ ...app, status: 'accepted', granted: true })),
          }))
        );
        setSelectedProjectForApplicants((prev) =>
          prev
            ? {
                ...prev,
                status: 'in_progress',
                project_id_onchain: onChainId,
                contract_id: DEFAULT_ESCROW_CONTRACT_ID,
                applicants: (prev.applicants || [])
                  .filter((app) => app.id === proposalId)
                  .map((app) => ({ ...app, status: 'accepted', granted: true })),
              }
            : null
        );
        await fetchBackendProjects();
      } else {
        toast.error('Failed to accept proposal');
      }
    } catch (err) {
      toast.error('Error accepting proposal');
    }
  };

  // Deny proposal/application
  const handleDenyProposal = async (proposalId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await authFetch(`${apiUrl}/api/proposals/${proposalId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'denied' }),
      });

      if (res.ok) {
        toast.info('Proposal denied');
        setProjects((prev) =>
          prev.map((proj) => ({
            ...proj,
            applicants: (proj.applicants || []).map((app) =>
              app.id === proposalId ? { ...app, status: 'denied', granted: false } : app
            ),
          }))
        );
        setSelectedProjectForApplicants((prev) =>
          prev
            ? {
                ...prev,
                applicants: (prev.applicants || []).map((app) =>
                  app.id === proposalId ? { ...app, status: 'denied', granted: false } : app
                ),
              }
            : null
        );
      } else {
        toast.error('Failed to deny proposal');
      }
    } catch (err) {
      toast.error('Error denying proposal');
    }
  };

  // Proposal counter-offer negotiation (#150)
  const handleSubmitCounterOffer = async (offer: CounterOffer) => {
    if (!counterOfferTarget) return;
    if (!address) {
      throw new Error('Please connect your client wallet first');
    }

    setCounterOfferSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await authFetch(`${apiUrl}/api/proposals/${counterOfferTarget.id}/counter-offer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'counter',
          milestones: offer.milestones,
          note: offer.note,
          actor_address: address,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send counter-offer');
      }

      setSelectedProjectForApplicants((prev) =>
        prev
          ? {
              ...prev,
              applicants: (prev.applicants || []).map((applicant) =>
                applicant.id === counterOfferTarget.id
                  ? {
                      ...applicant,
                      counter_offer: offer,
                      negotiation_status: 'countered' as const,
                    }
                  : applicant
              ),
            }
          : prev
      );
      setCounterOfferTarget(null);
      await fetchBackendProjects();
    } finally {
      setCounterOfferSubmitting(false);
    }
  };

  const handleRespondToCounterOffer = async (
    action: 'accept' | 'decline',
    applicant: ApplicantCardData
  ) => {
    if (!address) {
      toast.error('Please connect your client wallet first');
      return;
    }

    setCounterOfferSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await authFetch(`${apiUrl}/api/proposals/${applicant.id}/counter-offer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, actor_address: address }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to ${action} counter-offer`);
      }
      toast.success(
        action === 'accept'
          ? 'Counter-offer accepted — agreed terms locked into the project.'
          : 'Counter-offer declined. The original proposal remains active.'
      );
      await fetchBackendProjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the counter-offer');
    } finally {
      setCounterOfferSubmitting(false);
    }
  };

  // File Upload Handler with data URL & file metadata for live thumbnail previews
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const fileDataUrl = event.target?.result as string;
          const isImage =
            file.type.startsWith('image/') ||
            Boolean(file.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i));

          setFormAttachments((prev) => [
            ...prev,
            {
              name: file.name,
              url: fileDataUrl,
              type: isImage ? 'image' : 'file',
              size: file.size,
            },
          ]);
        };
        reader.readAsDataURL(file);
      });
      toast.success(`${files.length} file(s) attached!`);
      e.target.value = '';
    }
  };

  // Remove / Cancel Attachment Handler
  const handleRemoveAttachment = (indexToRemove: number) => {
    setFormAttachments((prev) => {
      const target = prev[indexToRemove];
      const name =
        typeof target === 'object' && target !== null
          ? target.name || target.file_name
          : String(target);
      toast.info(`Removed ${name}`);
      return prev.filter((_, idx) => idx !== indexToRemove);
    });
  };

  // Submit Project Form to Backend
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error('Please enter a project title');
      return;
    }
    if (!formBudget || Number(formBudget) <= 0) {
      toast.error('Please enter a valid project budget');
      return;
    }

    if (!address) {
      toast.error('Please connect your Stellar wallet first');
      return;
    }

    if (formMilestones.length > 0 && formBudget && Number(formBudget) > 0) {
      const msSum = formMilestones.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
      const budgetNum = Number(formBudget);
      const diff = Math.abs(msSum - budgetNum);
      if (diff > 0.05 * budgetNum && diff > 1) {
        toast.error(
          `Cannot submit: Milestone allocations (${msSum.toFixed(2)} ${formToken}) must equal 100% of project budget (${budgetNum} ${formToken}). Please auto-balance.`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const clientAddr = address;

      let onChainProjectId: number | undefined;
      let contractId: string | undefined;

      if (formLockImmediately) {
        if (!formFreelancerAddress.trim()) {
          toast.error(
            'Please specify a designated freelancer address to lock escrow on-chain immediately'
          );
          setIsSubmitting(false);
          return;
        }

        const milestoneAmounts =
          formMilestones.length > 0
            ? formMilestones.map((m) => Number(m.amount))
            : [Number(formBudget)];

        const createArgs = buildCreateProjectArgs({
          clientAddress: clientAddr,
          freelancerAddress: formFreelancerAddress.trim(),
          tokenAddress: SUPPORTED_TOKENS[formToken]?.issuerOrContractAddress,
          milestoneAmounts,
          yieldEnabled: formYieldEnabled,
        });
        const createFootprint = await runPreflightInspection({
          contractAddress: DEFAULT_ESCROW_CONTRACT_ID,
          functionName: 'create_project',
          args: createArgs,
          description: 'Initialize Soroban Escrow',
        });
        if (!createFootprint) {
          setIsSubmitting(false);
          return;
        }
        toast.info('Initializing Soroban Escrow: Please confirm signature in Freighter...');
        const chainRes = await createProjectOnChain({
          clientAddress: clientAddr,
          freelancerAddress: formFreelancerAddress.trim(),
          tokenAddress: SUPPORTED_TOKENS[formToken]?.issuerOrContractAddress,
          milestoneAmounts,
          yieldEnabled: formYieldEnabled,
        });

        onChainProjectId = chainRes.onChainProjectId ? Number(chainRes.onChainProjectId) : 1;
        contractId = DEFAULT_ESCROW_CONTRACT_ID;
        toast.success(`Escrow project #${onChainProjectId} locked on Stellar!`);
      }

      const finalCategory =
        formCategory === 'Other'
          ? customCategory.trim() || 'Other'
          : formCategory === 'Web development'
            ? 'Development'
            : formCategory;

      const body = {
        title: formTitle,
        description: formDescription,
        category: finalCategory,
        budget: Number(formBudget),
        token: formToken,
        token_address: SUPPORTED_TOKENS[formToken]?.issuerOrContractAddress,
        deadline: formDeadline || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        visibility: formVisibility,
        client_address: activeWalletAddress || clientAddr,
        freelancer_address: formFreelancerAddress.trim() || undefined,
        status: onChainProjectId ? 'in_progress' : 'draft',
        contract_id: contractId,
        project_id_onchain: onChainProjectId,
        attachments: formAttachments,
        milestones: formMilestones,
        yield_enabled: formYieldEnabled,
        estimated_yield: Number(calculateEstimatedYield()),
      };

      if (!isOnline) {
        await queueSubmission({
          url: `${apiUrl}/api/projects`,
          method: 'POST',
          body,
          description: `Create project: ${formTitle}`,
        });
        await removeDraft('client-dashboard-project-draft');
        toast.warning(
          'Offline: Project creation queued locally. Will automatically sync to server when connection returns!',
          { duration: 6000 }
        );
        setFormTitle('');
        setFormDescription('');
        setFormBudget('');
        setFormMilestones([]);
        setIsSubmitting(false);
        setActiveTab('projects');
        return;
      }

      const res = await authFetch(`${apiUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        let errorMsg = data.error || data.message || 'Failed to save project';
        if (data.details) {
          if (Array.isArray(data.details)) {
            const detailMsgs = data.details
              .map((d: any) => `${d.path?.join('.') || 'field'}: ${d.message}`)
              .join(' | ');
            errorMsg = `Validation failed: ${detailMsgs}`;
          } else if (typeof data.details === 'string') {
            errorMsg = `${errorMsg} (${data.details})`;
          } else if (typeof data.details === 'object' && data.details.message) {
            errorMsg = `${errorMsg} (${data.details.message})`;
          }
        }
        toast.error(errorMsg, { duration: 8000 });
        setIsSubmitting(false);
        return;
      }

      toast.success('Project saved successfully!');
      await removeDraft('client-dashboard-project-draft');
      setFormTitle('');
      setFormDescription('');
      setFormBudget('');
      setFormToken('USDC');
      setFormDeadline('');
      setFormAttachments([]);
      setFormMilestones([]);
      await fetchBackendProjects();
      setActiveTab('projects');
    } catch (err: any) {
      showSorobanErrorToast(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Grant applicant handler
  const handleGrantApplicant = async (applicant: Applicant) => {
    if (!applicant.id) return;
    await handleAcceptProposal(applicant.id);
  };

  const totalVolume = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
  const activeEscrows = projects.filter(p => p.project_id_onchain !== null || p.status === 'open' || p.status === 'disputed').length;
  const completedMilestones = projects.reduce((sum, p) => sum + (p.milestones?.filter(m => m.status === 'approved').length || 0), 0);

  return (
    <div className="w-full min-h-screen bg-[#121212] text-[#f4f4f5] font-sans p-4 sm:p-6 md:p-10 transition-colors duration-200">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Bar / Mode Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#27272a]">
          <div className="flex items-center space-x-2 text-sm sm:text-base font-medium text-[#a1a1aa]">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#27272a] text-[#f4f4f5]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </span>
            <span className="text-[#e4e4e7] font-semibold">Client</span>
            <span>—</span>
            <span className="text-white capitalize">
              {activeTab === 'projects' && 'my projects'}
              {activeTab === 'create' && 'create project'}
              {activeTab === 'applicants' && 'applicants'}
              {activeTab === 'saved' && 'saved contractors'}
            </span>
            <OfflineStatusPill className="ml-2" />
          </div>

          <div className="flex items-center space-x-1 bg-[#18181b] p-1 rounded-xl border border-[#27272a]">
            <button
              onClick={() => setActiveTab('projects')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'projects'
                  ? 'bg-[#27272a] text-white shadow-sm'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]/50'
              }`}
            >
              My Projects
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'create'
                  ? 'bg-[#27272a] text-white shadow-sm'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]/50'
              }`}
            >
              Create Project
            </button>
            <button
              onClick={() => setActiveTab('applicants')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'applicants'
                  ? 'bg-[#27272a] text-white shadow-sm'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]/50'
              }`}
            >
              Applicants (<NumberRoll value={selectedProjectForApplicants?.applicants?.length || 0} />)
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'saved'
                  ? 'bg-[#27272a] text-white shadow-sm'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]/50'
              }`}
              data-testid="saved-contractors-tab"
            >
              Saved Contractors ({starred.length})
            </button>
          </div>
        </div>

        {/* Network fee gauge and token price alerts (#256, #253) */}
        {activeTab === 'projects' && (
          <div className="grid gap-4 lg:grid-cols-3">
            <GasFeeEstimatorWidget onFeeSelected={(feeStroops) => setSorobanBaseFee(feeStroops)} />
            <TokenPriceAlertWidget />
            <CurrencyConverterWidget />
          </div>
        )}

        {/* Blend yield tracker for escrows routed into lending pools (#118) */}
        {activeTab === 'projects' && blendYieldProjects.length > 0 && (
          <BlendYieldVisualizer
            principal={blendYieldProjects.reduce((sum, p) => sum + p.budget * BLEND_ALLOCATION_RATIO, 0)}
            token={blendYieldProjects[0].token}
            lockedAt={blendYieldProjects
              .map((p) => p.created_at)
              .filter((d): d is string => Boolean(d))
              .sort()[0]}
          />
        )}

        {/* VIEW 1: MY PROJECTS */}
        {activeTab === 'projects' && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 sm:p-8 shadow-2xl transition-all duration-300">
            {/* Dashboard Statistic Cards with Smooth NumberRoll Counter */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-[#121214] border border-[#27272a] rounded-xl p-4">
                <div className="text-xs text-[#a1a1aa] font-medium">Total Volume</div>
                <div className="text-xl sm:text-2xl font-black text-white mt-1">
                  <NumberRoll value={totalVolume} prefix="$" decimals={0} />
                </div>
              </div>
              <div className="bg-[#121214] border border-[#27272a] rounded-xl p-4">
                <div className="text-xs text-[#a1a1aa] font-medium">Active Escrows</div>
                <div className="text-xl sm:text-2xl font-black text-blue-400 mt-1">
                  <NumberRoll value={activeEscrows} />
                </div>
              </div>
              <div className="bg-[#121214] border border-[#27272a] rounded-xl p-4">
                <div className="text-xs text-[#a1a1aa] font-medium">Completed Milestones</div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
                  <NumberRoll value={completedMilestones} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-1.5">
                <NumberRoll value={projects.length} /> <span>{projects.length === 1 ? 'project' : 'projects'}</span>
              </h2>
              <div className="flex items-center gap-2">
                <OfflineStatusPill />
                {(isMultisig || accountPendingMultisig.length > 0) && (
                  <button
                    type="button"
                    data-testid="pending-signatures-button"
                    onClick={() => setShowPendingDrawer(true)}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-medium text-xs rounded-xl border border-amber-500/30 transition-all"
                    title="Transactions waiting for co-signers on your multi-sig account"
                  >
                    <span>✍️ Pending Signatures ({accountPendingMultisig.length})</span>
                  </button>
                )}
                <button
                  onClick={() => setShowApExportModal(true)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#232326] hover:bg-[#2d2d33] text-[#e4e4e7] font-medium text-xs rounded-xl border border-[#333338] transition-all"
                  title="Export monthly accounts payable ledger (CSV / Excel)"
                >
                  <span>📊 AP Export</span>
                </button>
                <button
                  type="button"
                  data-testid="open-bulk-payout"
                  onClick={() => setShowBulkPayout(true)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-medium text-xs rounded-xl border border-emerald-500/30 transition-all"
                  title="Approve multiple submitted milestones in one signature"
                >
                  <span>⚡ Bulk Payout</span>
                </button>
                <button
                  onClick={() => setActiveTab('create')}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-transparent hover:bg-[#27272a] text-white font-medium text-sm rounded-xl border border-[#3f3f46] transition-all hover:border-[#52525b] shadow-sm active:scale-95"
                >
                  <span className="text-lg leading-none">+</span>
                  <span>Create project</span>
                </button>
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="sr-only" htmlFor="client-project-search">
                Search projects
              </label>
              <input
                id="client-project-search"
                type="search"
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
                placeholder="Search your projects…"
                className="flex-1 rounded-xl border border-[#333338] bg-[#232326] px-3.5 py-2 text-sm text-white placeholder-[#71717a] focus:border-blue-500 focus:outline-none"
              />
              <label className="sr-only" htmlFor="client-project-token">
                Filter projects by token
              </label>
              <select
                id="client-project-token"
                value={projectToken}
                onChange={(event) => setProjectToken(event.target.value)}
                className="rounded-xl border border-[#333338] bg-[#232326] px-3.5 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="All">All Tokens</option>
                {Object.keys(SUPPORTED_TOKENS).map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-[#71717a]" data-testid="client-project-filter-count">
                Showing {visibleProjects.length} of {projects.length}
              </span>
            </div>

            {loading ? (
              <ProjectCardSkeletonList count={3} />
            ) : projects.length === 0 ? (
<EmptyState
                type="projects"
                onAction={() => setActiveTab('create')}
              />
            ) : visibleProjects.length === 0 ? (
              <div className="rounded-xl border border-[#27272a] bg-[#1c1c20]/50 py-12 text-center">
                <p className="text-sm text-[#a1a1aa]">
                  No projects match your search or token filter.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {visibleProjects.map((proj) => (
                  <div
                    key={proj.id}
                    onClick={() => {
                      if (proj.applicants && proj.applicants.length > 0) {
                        setSelectedProjectForApplicants(proj);
                        setActiveTab('applicants');
                      } else {
                        router.push(`/projects/${proj.id}`);
                      }
                    }}
                    className="group bg-[#1c1c20]/80 hover:bg-[#222227] border border-[#27272a] hover:border-[#3f3f46] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-all duration-200 card-hover-border"
                  >
                    <div className="space-y-1.5 flex-1">
                      <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                        {proj.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#a1a1aa]">{proj.subtitle}</p>

                      {/* Attached Files & Image Thumbnails */}
                      {((proj.attachments && proj.attachments.length > 0) ||
                        (proj.files && proj.files.length > 0)) && (
                        <div className="pt-2 flex flex-wrap items-center gap-2">
                          {(proj.files || proj.attachments || []).map((file: any, fIdx: number) => {
                            const fileUrl =
                              typeof file === 'string' ? file : file.file_url || file.file_name;
                            const fileName =
                              typeof file === 'string' ? file : file.file_name || 'Attachment';
                            const isImage =
                              typeof fileUrl === 'string' &&
                              (fileUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ||
                                fileUrl.startsWith('data:image'));

                            if (isImage) {
                              return (
                                <div
                                  key={fIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxImage({ url: fileUrl, name: fileName });
                                  }}
                                  className="relative group/img cursor-pointer overflow-hidden rounded-lg border border-[#333338] hover:border-blue-500 transition-all shadow-sm"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={fileUrl}
                                    alt={fileName}
                                    className="w-12 h-12 object-cover transform group-hover/img:scale-110 transition-transform duration-200"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white text-[9px] font-bold transition-opacity">
                                    🔍 Zoom
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <span
                                key={fIdx}
                                className="text-[11px] bg-[#232326] text-[#e4e4e7] px-2 py-0.5 rounded border border-[#333338] font-mono"
                              >
                                📄 {fileName}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="self-start sm:self-center flex flex-col items-end gap-1.5">
                      <ProjectActionsDropdown
                        project={proj}
                        onView={() => router.push(`/projects/${proj.id}`)}
                        onDispute={() => setConfirmAction({ type: 'dispute', project: proj })}
                        onCancel={() => setConfirmAction({ type: 'cancel', project: proj })}
                        disputeDisabledReason={getDisputeBlockReason(proj)}
                        cancelDisabledReason={getCancelBlockReason(proj)}
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setReminderProject(proj);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300 transition-colors hover:bg-amber-500/20"
                        >
                          <span aria-hidden="true">⏰</span> Reminders
                        </button>
                        <button
                          type="button"
                          data-testid="client-audit-log-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setAuditProject(proj);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-bold text-indigo-300 transition-colors hover:bg-indigo-500/20"
                        >
                          <span aria-hidden="true">🔗</span> Audit Log
                        </button>
                      </div>
                      <CalendarExportButton project={proj} compact label="Calendar" />
                      {proj.project_id_onchain !== undefined && proj.project_id_onchain !== null && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                          <span>✦</span> Soroban Escrow #{proj.project_id_onchain.toString()}
                        </span>
                      )}
                      {proj.milestones?.some((m) => m.status === 'submitted') && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                          <span>⏳</span> Timelock Active
                        </span>
                      )}
                      {(proj.status === 'in_progress' || (proj.status as string) === 'In progress') && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#052e16] text-[#22c55e] border border-[#14532d]">
                          In progress
                        </span>
                      )}
                      {(proj.status === 'open' ||
                        proj.status === 'draft' ||
                        (proj.status as string) === 'Open') && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#451a03] text-[#f97316] border border-[#78350f]">
                          Open
                        </span>
                      )}
                      {(proj.status === 'completed' || (proj.status as string) === 'Completed') && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#27272a] text-[#a1a1aa] border border-[#3f3f46]">
                          Completed
                        </span>
                      )}
                      {(proj.status === 'completed' || (proj.status as string) === 'Completed') && (
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <MilestoneCertificateButton project={proj} />
                          <DownloadReceiptButton project={proj} />
                        </div>
                      )}
                      <ShareMilestoneButton project={proj} />
                    </div>
                  </div>
                ))}

                {/* Pagination Bar */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#27272a]">
                    <div className="text-xs text-[#a1a1aa]">
                      Showing Page <span className="font-bold text-white">{currentPage}</span> of{' '}
                      <span className="font-bold text-white">{totalPages}</span> ({totalProjects}{' '}
                      total projects)
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => {
                          if (currentPage > 1) {
                            const prev = currentPage - 1;
                            setCurrentPage(prev);
                            fetchBackendProjects(prev);
                          }
                        }}
                        disabled={currentPage <= 1}
                        className="px-3 py-1.5 bg-[#232326] hover:bg-[#27272a] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-[#e4e4e7] rounded-xl border border-[#333338] transition-colors"
                      >
                        ← Previous
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                        <button
                          key={pg}
                          onClick={() => {
                            setCurrentPage(pg);
                            fetchBackendProjects(pg);
                          }}
                          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                            pg === currentPage
                              ? 'bg-blue-600 text-white border border-blue-500'
                              : 'bg-[#232326] hover:bg-[#27272a] text-[#a1a1aa] border border-[#333338]'
                          }`}
                        >
                          {pg}
                        </button>
                      ))}

                      <button
                        onClick={() => {
                          if (currentPage < totalPages) {
                            const next = currentPage + 1;
                            setCurrentPage(next);
                            fetchBackendProjects(next);
                          }
                        }}
                        disabled={currentPage >= totalPages}
                        className="px-3 py-1.5 bg-[#232326] hover:bg-[#27272a] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-[#e4e4e7] rounded-xl border border-[#333338] transition-colors"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: CREATE PROJECT */}
        {activeTab === 'create' && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 sm:p-8 shadow-2xl transition-all duration-300">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-6">
              Create project
            </h2>

            <form onSubmit={handleSaveProject} className="space-y-5">
              {/* Project Title */}
              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-semibold text-[#e4e4e7]">
                  Project title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Landing page redesign"
                  className="w-full px-4 py-3 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-semibold text-[#e4e4e7]">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Scope, requirements, and expectations"
                  className="w-full px-4 py-3 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none"
                />
              </div>

              {/* Grid: Category & Project Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-semibold text-[#e4e4e7]">
                    Category
                  </label>
                  <div className="relative">
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full appearance-none px-4 py-3 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                    >
                      <option value="Development">Development</option>
                      <option value="Web development">Web development</option>
                      <option value="Mobile app">Mobile app</option>
                      <option value="Design">Design</option>
                      <option value="Writing">Writing</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Other">Other</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#a1a1aa]">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>

                  {formCategory === 'Other' && (
                    <div className="pt-1.5 animate-fadeIn">
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="Please specify category (e.g. Smart Contracts, Audit)..."
                        className="w-full px-4 py-2.5 bg-[#232326] border border-blue-500/50 rounded-xl text-white text-xs placeholder-[#71717a] focus:outline-none focus:border-blue-500 font-medium"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-semibold text-[#e4e4e7]">
                    Project type
                  </label>
                  <div className="relative">
                    <select
                      value={formProjectType}
                      onChange={(e) => setFormProjectType(e.target.value)}
                      className="w-full appearance-none px-4 py-3 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                    >
                      <option value="Fixed price">Fixed price</option>
                      <option value="Milestone-based">Milestone-based</option>
                      <option value="Hourly rate">Hourly rate</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#a1a1aa]">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid: Escrow Currency, Total Budget & Overall Deadline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <TokenSelector
                    label="Escrow Currency"
                    value={formToken}
                    onChange={setFormToken}
                    balances={tokenBalances.balances}
                    balancesLoading={tokenBalances.loading}
                    network={targetNetwork}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-semibold text-[#e4e4e7]">
                    Total budget ({formToken})
                  </label>
                  <CurrencyAmountInput
                    token={formToken}
                    value={formBudget}
                    onChange={(raw) =>
                      setFormBudget(raw === '' ? '' : Number(raw))
                    }
                    placeholder="900"
                    label={`Total budget in ${formToken}`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-semibold text-[#e4e4e7]">
                    Overall deadline
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      min={todayStr}
                      value={formDeadline}
                      onChange={(e) => setFormDeadline(e.target.value)}
                      className="w-full px-4 py-3 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <BalanceWarningBadge
                address={activeWalletAddress}
                balance={walletBalance.balance}
                budget={formBudget === '' ? 0 : formBudget}
                token={formToken}
                isLoading={walletBalance.loading}
                error={walletBalance.error}
              />

              {formBudget !== '' && Number(formBudget) > 10000 && (
                <LiquidityDepthOptimizer
                  amount={Number(formBudget)}
                  sourceToken={formToken === 'USDC' ? 'EURC' : 'USDC'}
                  targetToken={formToken}
                />
              )}

              {/* Visibility Radio Buttons */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs sm:text-sm font-semibold text-[#e4e4e7]">
                  Visibility
                </label>
                <div className="flex items-center space-x-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      value="Public"
                      checked={formVisibility === 'Public'}
                      onChange={() => setFormVisibility('Public')}
                      className="w-4 h-4 text-blue-600 bg-[#232326] border-[#3f3f46] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-white">Public</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      value="Invite-only"
                      checked={formVisibility === 'Invite-only'}
                      onChange={() => setFormVisibility('Invite-only')}
                      className="w-4 h-4 text-blue-600 bg-[#232326] border-[#3f3f46] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-[#a1a1aa]">Invite-only</span>
                  </label>
                </div>
              </div>

              {/* DIRECT FREELANCER ON-CHAIN ESCROW FUNDING TOGGLE */}
              <div className="p-5 rounded-2xl border border-[#27272a] bg-[#1c1c20]/60 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-white">
                        Direct Freelancer & Immediate Escrow Lock
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                        Soroban
                      </span>
                    </div>
                    <p className="text-xs text-[#a1a1aa]">
                      Have a designated freelancer? Assign their address and lock funds into the
                      smart contract immediately.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFormLockImmediately(!formLockImmediately)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      formLockImmediately ? 'bg-indigo-600' : 'bg-[#3f3f46]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        formLockImmediately ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {formLockImmediately && (
                  <div className="pt-3 border-t border-[#27272a] space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">
                      Designated Freelancer Stellar Address (G...)
                    </label>
                    <input
                      type="text"
                      value={formFreelancerAddress}
                      onChange={(e) => setFormFreelancerAddress(e.target.value)}
                      placeholder="G..."
                      className="w-full bg-[#121212] border border-[#27272a] rounded-xl px-3.5 py-2 text-xs font-mono tracking-tight text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* BLEND PROTOCOL YIELD STRATEGY TOGGLE */}
              <div
                className={`p-5 rounded-2xl border transition-all duration-300 ${
                  formYieldEnabled
                    ? 'bg-gradient-to-br from-[#064e3b]/30 via-[#022c22]/40 to-[#0f172a]/60 border-emerald-500/40 shadow-lg shadow-emerald-950/40'
                    : 'bg-[#1c1c20]/60 border-[#27272a]'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-white">Earn Yield with Blend Protocol</span>
                      <TooltipHelper termKey="blend-yield" />
                      <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        ~4.5% APY
                      </span>
                    </div>
                    <p className="text-xs text-[#a1a1aa]">
                      Optionally route 70% of escrowed USDC to Stellar&apos;s Blend Protocol while
                      freelancer completes work.
                    </p>
                  </div>

                  {/* Toggle Switch Button */}
                  <button
                    type="button"
                    onClick={() => setFormYieldEnabled(!formYieldEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      formYieldEnabled ? 'bg-emerald-500' : 'bg-[#3f3f46]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        formYieldEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Expanded Yield Breakdown Card when ON */}
                {formYieldEnabled && (
                  <div className="mt-4 pt-4 border-t border-emerald-500/20 space-y-3.5 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-[#032019]/80 rounded-xl border border-emerald-500/30 gap-2">
                      <div>
                        <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider block">
                          Estimated Yield Projection
                        </span>
                        <div className="text-lg font-black text-emerald-400">
                          ~${calculateEstimatedYield()} {formToken}
                        </div>
                      </div>
                      <div className="text-xs text-[#a1a1aa] sm:text-right">
                        on{' '}
                        <span className="font-bold text-white">
                          {formBudget || 0} {formToken}
                        </span>{' '}
                        over{' '}
                        <span className="font-bold text-white">
                          {formDeadline
                            ? Math.max(
                                1,
                                Math.ceil(
                                  (new Date(formDeadline).getTime() - Date.now()) / 86400000
                                )
                              )
                            : 14}{' '}
                          days
                        </span>
                      </div>
                    </div>

                    {/* Deposit & Yield Split Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-[#111827]/80 rounded-xl border border-[#1f2937]">
                        <div className="font-semibold text-white mb-1 flex items-center justify-between">
                          <span>Deposit Split</span>
                          <span className="text-[10px] text-[#9ca3af]">Principal</span>
                        </div>
                        <div className="space-y-1 text-[#9ca3af]">
                          <div className="flex justify-between">
                            <span>📈 70% Blend Yield Pool:</span>
                            <span className="font-bold text-emerald-400">
                              ${formBudget ? (Number(formBudget) * 0.7).toFixed(2) : '0.00'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>🛡️ 30% Instant Reserve:</span>
                            <span className="font-bold text-blue-400">
                              ${formBudget ? (Number(formBudget) * 0.3).toFixed(2) : '0.00'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-[#111827]/80 rounded-xl border border-[#1f2937]">
                        <div className="font-semibold text-white mb-1 flex items-center justify-between">
                          <span>Yield Share</span>
                          <span className="text-[10px] text-[#9ca3af]">Interest</span>
                        </div>
                        <div className="space-y-1 text-[#9ca3af]">
                          <div className="flex justify-between">
                            <span>👤 Client Share:</span>
                            <span className="font-bold text-emerald-400">70%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>🏛️ Platform Fee:</span>
                            <span className="font-bold text-amber-400">30%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>🛠️ Freelancer Share:</span>
                            <span className="font-bold text-zinc-400">0% (100% principal)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#a1a1aa] italic">
                      ℹ️ 30% reserve is liquid for instant dispute payouts. The 70% in Blend is
                      withdrawn upon milestone completion or resolution.
                    </p>
                  </div>
                )}
              </div>

              {/* Attachments Dropzone */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs sm:text-sm font-semibold text-[#e4e4e7]">
                  Attachments
                </label>
                <label className="relative border-2 border-dashed border-[#3f3f46] hover:border-[#52525b] rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#1c1c20]/50 hover:bg-[#232326]/50">
                  <input type="file" multiple onChange={handleFileUpload} className="hidden" />
                  <div className="w-8 h-8 mb-2 flex items-center justify-center text-[#a1a1aa]">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-[#a1a1aa]">
                    Drop files or click to upload
                  </span>
                </label>

                {formAttachments.length > 0 && (
                  <div className="pt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#a1a1aa] font-semibold">
                      <span>Attached Files ({formAttachments.length})</span>
                      <span className="text-[11px] text-[#71717a]">
                        Click image to preview • Click ✕ to remove
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      {formAttachments.map((fileItem, idx) => {
                        const isObj = typeof fileItem === 'object' && fileItem !== null;
                        const fileName = isObj
                          ? fileItem.name || fileItem.file_name || 'Attachment'
                          : String(fileItem);
                        const fileUrl = isObj
                          ? fileItem.url || fileItem.file_url || fileItem.name
                          : String(fileItem);
                        const fileType = isObj
                          ? fileItem.type || fileItem.file_type
                          : fileName.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
                            ? 'image'
                            : 'file';
                        const fileSize =
                          isObj && fileItem.size ? `${(fileItem.size / 1024).toFixed(1)} KB` : null;
                        const isImage =
                          fileType === 'image' ||
                          (typeof fileUrl === 'string' &&
                            (fileUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ||
                              fileUrl.startsWith('data:image')));

                        return (
                          <div
                            key={idx}
                            className="group relative bg-[#232326] border border-[#333338] hover:border-[#4f4f56] rounded-xl p-2 pr-3 flex items-center space-x-2.5 max-w-[210px] sm:max-w-[230px] transition-all shadow-sm shrink-0"
                          >
                            {/* Cancel / Remove Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveAttachment(idx);
                              }}
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center text-[8px] font-extrabold leading-none shadow-md transition-transform hover:scale-110 z-10"
                              title="Remove attachment"
                            >
                              ✕
                            </button>

                            {/* Thumbnail preview or File icon */}
                            {isImage ? (
                              <div
                                onClick={() => setLightboxImage({ url: fileUrl, name: fileName })}
                                className="relative w-9 h-9 rounded-lg overflow-hidden border border-[#3f3f46] shrink-0 cursor-pointer group/img bg-[#18181b]"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={fileUrl}
                                  alt={fileName}
                                  className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-200"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-[9px] text-white font-semibold transition-opacity">
                                  🔍
                                </div>
                              </div>
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-[#18181b] border border-[#3f3f46] flex items-center justify-center shrink-0 text-blue-400">
                                <svg
                                  className="w-4.5 h-4.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.5"
                                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                  />
                                </svg>
                              </div>
                            )}

                            {/* File Info */}
                            <div className="min-w-0 flex-1">
                              <p
                                className="text-xs font-semibold text-white truncate"
                                title={fileName}
                              >
                                {fileName}
                              </p>
                              <div className="flex items-center space-x-1.5 text-[9px] text-[#a1a1aa] mt-0.5">
                                <span className="uppercase font-mono px-1 py-0.2 rounded bg-[#18181b] border border-[#27272a]">
                                  {isImage
                                    ? 'IMG'
                                    : fileName.split('.').pop()?.toUpperCase() || 'FILE'}
                                </span>
                                {fileSize && <span>{fileSize}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Milestones Builder Canvas Section */}
              <div className="pt-4 border-t border-[#27272a] space-y-4">
                <MilestoneBuilderCanvas
                  milestones={formMilestones as any}
                  totalBudget={Number(formBudget) || 0}
                  currency={formToken}
                  onChange={(updated) => setFormMilestones(updated as any)}
                />
              </div>

              {/* Network Gas & Soroban Fee Estimator */}
              <div className="pt-2">
                <GasFeeEstimatorWidget
                  onFeeSelected={(fee) => setConfiguredFeeStroops(fee)}
                />
              </div>

              {/* Save Project Button */}
              <div className="pt-6 border-t border-[#27272a] flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                {hasInsufficientBalance && (
                  <p className="text-xs text-red-300 sm:text-right">
                    Lock Funds &amp; Create Escrow is disabled until your {formToken} balance covers the budget.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setShowDaoProposal(true)}
                  disabled={!canGenerateDaoProposal}
                  title={canGenerateDaoProposal ? undefined : 'Add a title and budget first'}
                  className="px-6 py-3 bg-[#232326] hover:bg-[#2c2c30] text-white font-bold text-xs sm:text-sm rounded-xl border border-[#333338] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate DAO Proposal 🗳️
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || hasInsufficientBalance}
                  aria-label="Lock Funds & Create Escrow"
                  title={hasInsufficientBalance ? 'Insufficient wallet balance' : undefined}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? 'Saving Project...'
                    : formLockImmediately
                    ? 'Lock Funds & Create Escrow 🔒'
                    : 'Save & Publish Escrow Project 🚀'}
                </button>
              </div>
            </form>
            <DaoProposalGeneratorModal
              isOpen={showDaoProposal}
              onClose={() => setShowDaoProposal(false)}
              defaults={daoProposalDefaults}
            />
          </div>
        )}

        {/* VIEW 3: APPLICANTS FOR SELECTED PROJECT */}
        {activeTab === 'applicants' && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272a]">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Applicants
                </h2>
                <p className="text-xs sm:text-sm text-[#a1a1aa] mt-1">
                  Review proposals from freelancers and grant milestone escrows.
                </p>
              </div>

              {projects.length > 0 && (
                <select
                  value={selectedProjectForApplicants?.id || ''}
                  onChange={(e) => {
                    const p = projects.find((proj) => proj.id === e.target.value);
                    if (p) setSelectedProjectForApplicants(p);
                  }}
                  className="px-3.5 py-2 bg-[#232326] border border-[#333338] rounded-xl text-white text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.applicants?.length || 0} applicants)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-4">
              {selectedProjectForApplicants?.applicants &&
              selectedProjectForApplicants.applicants.length > 0 ? (
                selectedProjectForApplicants.applicants.map((applicant) => (
                  <ApplicantCard
                    key={applicant.id}
                    applicant={applicant}
                    onAccept={(id) => handleAcceptProposal(id)}
                    onDeny={(id) => handleDenyProposal(id)}
                    onOpenProfile={() => setProfileApplicant(applicant)}
                    projectBudget={selectedProjectForApplicants?.budget}
                    tokenSymbol={selectedProjectForApplicants?.token || 'USDC'}
                    counterOfferSubmitting={counterOfferSubmitting}
                    onCounterOffer={(target) => setCounterOfferTarget(target)}
                    onRespondToCounterOffer={handleRespondToCounterOffer}
                    isStarred={isStarred(applicant.stellar_address || applicant.freelancer_address || '')}
                    onToggleStar={(a) => {
                      const addr = a.stellar_address || a.freelancer_address || '';
                      if (!addr) {
                        toast.error('This applicant has no wallet address to save.');
                        return;
                      }
                      toggleStarred({
                        address: addr,
                        name: a.name,
                        lastProjectTitle: selectedProjectForApplicants?.title,
                      });
                    }}
                    onOpenChat={(freelancerAddr) => {
                      if (!address) {
                        toast.error('Please connect your Stellar wallet first');
                        return;
                      }
                      setChatModalState({
                        isOpen: true,
                        projectId: selectedProjectForApplicants?.id || '',
                        projectTitle: selectedProjectForApplicants?.title || 'Escrow Project',
                        senderAddress: address,
                        receiverAddress: freelancerAddr,
                        recipientRoleLabel: 'Freelancer',
                      });
                    }}
                  />
                ))
              ) : (
                <div className="text-center py-12 bg-[#1c1c20]/40 rounded-xl border border-[#27272a]">
                  <p className="text-sm text-[#a1a1aa]">
                    No applicants submitted yet for this project.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 4: SAVED CONTRACTORS (#255) */}
        {activeTab === 'saved' && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="pb-4 border-b border-[#27272a]">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Saved Contractors</h2>
              <p className="text-xs sm:text-sm text-[#a1a1aa] mt-1">
                Freelancers you have starred, with private notes only you can see.
              </p>
            </div>
            <StarredFreelancersList
              starred={starred}
              onUnstar={(addr) => toggleStarred({ address: addr })}
              onSaveNotes={setStarredNotes}
              onInvite={(f) => {
                setFormFreelancerAddress(f.address);
                setActiveTab('create');
                toast.success(`Escrow form pre-filled for ${f.name || 'your saved contractor'}.`);
              }}
            />
          </div>
        )}
      </div>

      {/* Modal for adding a new milestone with all backend fields */}
      {showAddMilestoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#18181b] border border-[#3f3f46] rounded-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
              <h3 className="text-lg font-bold text-white">Add New Milestone</h3>
              <button
                onClick={() => setShowAddMilestoneModal(false)}
                className="text-[#a1a1aa] hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#e4e4e7]">
                  Milestone Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newMilestoneTitle}
                  onChange={(e) => setNewMilestoneTitle(e.target.value)}
                  placeholder="e.g. Initial Design Drafts"
                  className="w-full px-3.5 py-2.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#e4e4e7]">Description</label>
                <textarea
                  rows={2}
                  value={newMilestoneDescription}
                  onChange={(e) => setNewMilestoneDescription(e.target.value)}
                  placeholder="Describe scope and deliverables for this milestone..."
                  className="w-full px-3.5 py-2.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#e4e4e7]">
                    Amount ({formToken}) <span className="text-red-400">*</span>
                  </label>
                  <CurrencyAmountInput
                    token={formToken}
                    min={0}
                    step="any"
                    value={newMilestoneAmount}
                    onValueChange={setNewMilestoneAmount}
                    placeholder="300"
                    data-testid="client-milestone-amount-input"
                    badgeTestId="client-milestone-amount-prefix"
                    inputClassName="w-full py-2.5 pr-3.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#e4e4e7]">Due Date</label>
                  <input
                    type="date"
                    min={todayStr}
                    value={newMilestoneDueDate}
                    onChange={(e) => setNewMilestoneDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#e4e4e7]">
                    Deliverable Type
                  </label>
                  <select
                    value={newMilestoneDeliverableType}
                    onChange={(e) => setNewMilestoneDeliverableType(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="GitHub Repository">GitHub Repository</option>
                    <option value="Figma Design Link">Figma Design Link</option>
                    <option value="PDF Document">PDF Document</option>
                    <option value="Design Asset">Design Asset</option>
                    <option value="Deployed Link">Deployed Link</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#e4e4e7]">
                    Revision Limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newMilestoneRevisionLimit}
                    onChange={(e) => setNewMilestoneRevisionLimit(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-[#27272a]">
              <button
                type="button"
                onClick={() => setShowAddMilestoneModal(false)}
                className="px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddMilestone}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                Add Milestone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      <ImageLightboxModal
        imageUrl={lightboxImage?.url || null}
        imageAlt={lightboxImage?.name}
        onClose={() => setLightboxImage(null)}
      />

      {/* Project Direct Chat Modal */}
      <ProjectChatModal
        isOpen={chatModalState.isOpen}
        onClose={() => setChatModalState((prev) => ({ ...prev, isOpen: false }))}
        projectId={chatModalState.projectId}
        projectTitle={chatModalState.projectTitle}
        senderAddress={chatModalState.senderAddress}
        receiverAddress={chatModalState.receiverAddress}
        recipientRoleLabel={chatModalState.recipientRoleLabel}
      />

      <FreelancerProfileModal
        applicant={profileApplicant}
        onClose={() => setProfileApplicant(null)}
      />

      <NotificationScheduleModal
        project={reminderProject}
        isOpen={Boolean(reminderProject)}
        onClose={() => setReminderProject(null)}
      />

      {auditProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-md sm:p-6"
          onClick={() => setAuditProject(null)}
        >
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setAuditProject(null)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white"
              >
                Close Audit Log ✕
              </button>
            </div>
            <ProjectAuditLog project={auditProject} />
          </div>
        </div>
      )}

      {/* Proposal counter-offer negotiation modal (#150) */}
      <ProposalCounterOfferModal
        key={counterOfferTarget?.id || 'closed-counter-offer'}
        isOpen={Boolean(counterOfferTarget)}
        proposal={
          counterOfferTarget
            ? {
                id: counterOfferTarget.id,
                project_title: selectedProjectForApplicants?.title,
                freelancer_address:
                  counterOfferTarget.freelancer_address || counterOfferTarget.stellar_address,
                budget: selectedProjectForApplicants?.budget,
                counter_offer: counterOfferTarget.counter_offer,
              }
            : null
        }
        originalMilestones={(selectedProjectForApplicants?.milestones || []).map(
          (milestone) => ({
            milestone_index: milestone.milestone_index,
            title: milestone.title,
            amount: milestone.amount,
            due_date: milestone.due_date,
          })
        )}
        tokenSymbol={selectedProjectForApplicants?.token || 'USDC'}
        isSubmitting={counterOfferSubmitting}
        onClose={() => setCounterOfferTarget(null)}
        onSubmit={handleSubmitCounterOffer}
      />

      {/* Destructive action confirmation (cancel escrow / raise dispute) */}
      <ConfirmModal
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmProjectAction}
        level="danger"
        title={confirmAction?.type === 'cancel' ? 'Cancel this project?' : 'Raise a dispute?'}
        impactSummary={
          confirmAction?.type === 'cancel'
            ? 'This permanently cancels the project and cannot be undone.'
            : 'This freezes all escrowed funds until an arbiter issues a ruling.'
        }
        description={
          confirmAction?.type === 'cancel'
            ? `“${confirmAction.project.title}” will be closed and any deposited escrow funds are refunded to your wallet.`
            : `Disputing “${confirmAction?.project.title ?? ''}” locks the on-chain escrow. Only raise a dispute after trying to resolve the issue with the other party.`
        }
        confirmText={confirmAction?.type === 'cancel' ? 'CANCEL' : 'DISPUTE'}
        confirmLabel={confirmAction?.type === 'cancel' ? 'Cancel project' : 'Raise dispute'}
        cancelLabel="Keep project"
      />

      {/* Multi-sig co-signing (enterprise treasury accounts) */}
      <PendingSignaturesDrawer
        isOpen={showPendingDrawer}
        onClose={() => setShowPendingDrawer(false)}
        requests={accountPendingMultisig}
        onSelect={(req) => {
          setMultisigRequest(req);
          setShowPendingDrawer(false);
          setShowMultisigModal(true);
        }}
      />
      <MultisigApprovalModal
        isOpen={showMultisigModal}
        onClose={() => setShowMultisigModal(false)}
        accountAddress={activeWalletAddress}
        request={
          multisigRequest
            ? pendingMultisig.find((r) => r.id === multisigRequest.id) || multisigRequest
            : null
        }
        onSubmitted={() => {
          setMultisigRequest(null);
          void fetchBackendProjects();
        }}
      />

      {/* Bulk milestone payout manager (#308) */}
      <BulkMilestonePayoutManager
        isOpen={showBulkPayout}
        onClose={() => setShowBulkPayout(false)}
        projects={projects}
        balance={projectToken === 'All' ? null : tokenBalances.balances[projectToken] ?? null}
        onComplete={() => void fetchBackendProjects()}
      />

      {/* Enterprise Accounts Payable Export Modal */}
      <AccountsPayableExportModal
        isOpen={showApExportModal}
        onClose={() => setShowApExportModal(false)}
        projects={projects}
      />

      {/* Soroban Resource Inspector — pre-flight simulation before wallet signing */}
      <SorobanResourceInspectorModal
        transaction={inspectorTransaction}
        onClose={handleInspectorClose}
        onProceed={handleInspectorProceed}
      />
    </div>
  );
}
