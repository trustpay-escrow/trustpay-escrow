'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import { Milestone, Project } from '@/types';
import { ImageLightboxModal } from '@/components/ImageLightboxModal';
import { ProjectDetailSkeleton } from '@/components/skeletons';
import { useWalletStore } from '@/store/walletStore';
import { SUPPORTED_TOKENS } from '@/config/tokens';
import {
  createProjectOnChain,
  submitMilestoneOnChain,
  approveMilestoneOnChain,
  raiseDisputeOnChain,
  resolveDisputeOnChain,
  getStellarExplorerUrl,
  DEFAULT_ESCROW_CONTRACT_ID,
  DEFAULT_ARBITER_ADDRESS,
  TxStage,
} from '@/lib/soroban';

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const { address, activeRole } = useWalletStore();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name?: string } | null>(null);

  // Active Transaction State for on-chain feedback
  const [txState, setTxState] = useState<{
    isOpen: boolean;
    stage: TxStage;
    message: string;
    txHash?: string;
    error?: string;
  }>({
    isOpen: false,
    stage: 'preparing',
    message: '',
  });

  // Modal states for milestone actions
  const [activeDeliverableModal, setActiveDeliverableModal] = useState<Milestone | null>(null);
  const [deliverableUrl, setDeliverableUrl] = useState('');
  const [deliverableNotes, setDeliverableNotes] = useState('');

  const [activeApproveModal, setActiveApproveModal] = useState<Milestone | null>(null);
  const [activeDisputeModal, setActiveDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  const [activeResolveModal, setActiveResolveModal] = useState(false);
  const [resolveClientAmount, setResolveClientAmount] = useState<number | ''>('');
  const [resolveFreelancerAmount, setResolveFreelancerAmount] = useState<number | ''>('');

  const [showFundEscrowModal, setShowFundEscrowModal] = useState(false);
  const [fundFreelancerAddress, setFundFreelancerAddress] = useState('');

  const fetchProject = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/projects/${projectId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch project details');
      }

      setProject(data.project);
      if (data.project?.freelancer_address) {
        setFundFreelancerAddress(data.project.freelancer_address);
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not load project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    fetchProject();
  }, [projectId]);

  if (loading) {
    return <ProjectDetailSkeleton />;
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mb-4 border border-red-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Project Not Found</h1>
        <p className="text-slate-400 max-w-md mb-6">
          We couldn&apos;t find details for project ID <code className="text-indigo-400">{projectId}</code>.
        </p>
        <Button onClick={() => router.push('/')} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">
          Return Home
        </Button>
      </div>
    );
  }

  const isClient = Boolean(
    address && (
      (project.client_address && address.toUpperCase() === project.client_address.toUpperCase()) ||
      activeRole === 'client'
    )
  );

  const isFreelancer = Boolean(
    address && (
      (project.freelancer_address && address.toUpperCase() === project.freelancer_address.toUpperCase()) ||
      activeRole === 'freelancer'
    )
  );

  const isArbiter = Boolean(
    address && (
      (project.arbiter_address && address.toUpperCase() === project.arbiter_address.toUpperCase()) ||
      address.toUpperCase() === DEFAULT_ARBITER_ADDRESS.toUpperCase()
    )
  );

  const hasOnChainEscrow = Boolean(project.project_id_onchain !== undefined && project.project_id_onchain !== null);
  const tokenSymbol = project.token || 'USDC';

  // 1. Client Action: Fund Escrow on Soroban
  const handleFundEscrowOnChain = async () => {
    if (!address) {
      toast.error('Please connect your client wallet first.');
      return;
    }
    const freelancerToUse = fundFreelancerAddress.trim() || project.freelancer_address;
    if (!freelancerToUse) {
      toast.error('Please specify a designated freelancer address to lock escrow for.');
      return;
    }

    const milestoneAmounts = (project.milestones && project.milestones.length > 0)
      ? project.milestones.map((m) => Number(m.amount))
      : [Number(project.budget) || 100];

    const tokenConfig = SUPPORTED_TOKENS[tokenSymbol] || SUPPORTED_TOKENS.USDC;

    setTxState({
      isOpen: true,
      stage: 'preparing',
      message: 'Preparing on-chain milestone escrow initialization...',
    });

    try {
      const res = await createProjectOnChain({
        clientAddress: address,
        freelancerAddress: freelancerToUse,
        tokenAddress: project.token_address || tokenConfig.issuerOrContractAddress,
        milestoneAmounts,
        yieldEnabled: Boolean(project.yield_enabled),
        onStatusUpdate: (stage, message) => {
          setTxState((prev) => ({ ...prev, stage, message }));
        },
      });

      const onChainId = res.onChainProjectId ? Number(res.onChainProjectId) : 1;
      setTxState((prev) => ({ ...prev, stage: 'success', txHash: res.txHash, message: `Escrow project #${onChainId} created on Stellar!` }));

      // Update backend metadata
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'in_progress',
          freelancer_address: freelancerToUse,
          contract_id: DEFAULT_ESCROW_CONTRACT_ID,
          project_id_onchain: onChainId,
        }),
      });

      toast.success('Funds successfully locked into Soroban smart contract!');
      setShowFundEscrowModal(false);
      await fetchProject();
    } catch (err: any) {
      setTxState((prev) => ({ ...prev, stage: 'error', error: err.message || String(err) }));
      toast.error(`Escrow funding failed: ${err.message || err}`);
    }
  };

  // 2. Freelancer Action: Submit Deliverable on-chain
  const handleSubmitDeliverable = async () => {
    if (!activeDeliverableModal) return;
    if (!address) {
      toast.error('Please connect your freelancer wallet first.');
      return;
    }

    const onChainId = project.project_id_onchain ?? 1;

    setTxState({
      isOpen: true,
      stage: 'preparing',
      message: `Submitting deliverables for milestone #${activeDeliverableModal.milestone_index + 1}...`,
    });

    try {
      const res = await submitMilestoneOnChain({
        freelancerAddress: address,
        projectIdOnChain: onChainId,
        milestoneIndex: activeDeliverableModal.milestone_index,
        onStatusUpdate: (stage, message) => {
          setTxState((prev) => ({ ...prev, stage, message }));
        },
      });

      setTxState((prev) => ({ ...prev, stage: 'success', txHash: res.txHash, message: 'Milestone submitted on Stellar ledger!' }));

      // Update backend milestone status
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await fetch(`${apiUrl}/api/milestones/${activeDeliverableModal.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'submitted',
          actor_address: address,
          deliverable_url: deliverableUrl,
          deliverable_notes: deliverableNotes,
        }),
      });

      toast.success('Deliverable submitted on-chain! Timelock countdown activated.');
      setActiveDeliverableModal(null);
      setDeliverableUrl('');
      setDeliverableNotes('');
      await fetchProject();
    } catch (err: any) {
      setTxState((prev) => ({ ...prev, stage: 'error', error: err.message || String(err) }));
      toast.error(`Milestone submission failed: ${err.message || err}`);
    }
  };

  // 3. Client Action: Approve Milestone & Release on-chain funds
  const handleApproveMilestone = async () => {
    if (!activeApproveModal) return;
    if (!address) {
      toast.error('Please connect your client wallet first.');
      return;
    }

    const onChainId = project.project_id_onchain ?? 1;

    setTxState({
      isOpen: true,
      stage: 'preparing',
      message: `Releasing ${activeApproveModal.amount} ${tokenSymbol} to freelancer...`,
    });

    try {
      const res = await approveMilestoneOnChain({
        clientAddress: address,
        projectIdOnChain: onChainId,
        milestoneIndex: activeApproveModal.milestone_index,
        onStatusUpdate: (stage, message) => {
          setTxState((prev) => ({ ...prev, stage, message }));
        },
      });

      setTxState((prev) => ({
        ...prev,
        stage: 'success',
        txHash: res.txHash,
        message: `Milestone #${activeApproveModal.milestone_index + 1} funds released on-chain!`,
      }));

      // Update backend milestone status
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await fetch(`${apiUrl}/api/milestones/${activeApproveModal.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          actor_address: address,
        }),
      });

      toast.success(`Milestone approved! ${activeApproveModal.amount} ${tokenSymbol} transferred.`);
      setActiveApproveModal(null);
      await fetchProject();
    } catch (err: any) {
      setTxState((prev) => ({ ...prev, stage: 'error', error: err.message || String(err) }));
      toast.error(`Milestone approval failed: ${err.message || err}`);
    }
  };

  // 4. Client or Freelancer Action: Raise Dispute on-chain
  const handleRaiseDispute = async () => {
    if (!address) {
      toast.error('Please connect your wallet first.');
      return;
    }

    const onChainId = project.project_id_onchain ?? 1;

    setTxState({
      isOpen: true,
      stage: 'preparing',
      message: 'Raising formal dispute on-chain to freeze funds for arbiter review...',
    });

    try {
      const res = await raiseDisputeOnChain({
        callerAddress: address,
        projectIdOnChain: onChainId,
        onStatusUpdate: (stage, message) => {
          setTxState((prev) => ({ ...prev, stage, message }));
        },
      });

      setTxState((prev) => ({
        ...prev,
        stage: 'success',
        txHash: res.txHash,
        message: 'Dispute recorded on Stellar! Arbiter notified.',
      }));

      // Update backend project status
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'disputed',
        }),
      });

      toast.warning('Dispute raised! Project funds frozen in smart contract for arbiter arbitration.');
      setActiveDisputeModal(false);
      await fetchProject();
    } catch (err: any) {
      setTxState((prev) => ({ ...prev, stage: 'error', error: err.message || String(err) }));
      toast.error(`Failed to raise dispute: ${err.message || err}`);
    }
  };

  // 5. Arbiter Action: Resolve Dispute Ruling
  const handleResolveDispute = async () => {
    if (!address) {
      toast.error('Please connect the arbiter wallet first.');
      return;
    }

    const cAmt = Number(resolveClientAmount) || 0;
    const fAmt = Number(resolveFreelancerAmount) || 0;
    const total = cAmt + fAmt;

    if (total <= 0) {
      toast.error('Please enter non-zero settlement amounts.');
      return;
    }

    const onChainId = project.project_id_onchain ?? 1;

    setTxState({
      isOpen: true,
      stage: 'preparing',
      message: `Executing dispute split (${cAmt} to Client / ${fAmt} to Freelancer)...`,
    });

    try {
      const res = await resolveDisputeOnChain({
        arbiterAddress: address,
        projectIdOnChain: onChainId,
        clientAmount: cAmt,
        freelancerAmount: fAmt,
        onStatusUpdate: (stage, message) => {
          setTxState((prev) => ({ ...prev, stage, message }));
        },
      });

      setTxState((prev) => ({
        ...prev,
        stage: 'success',
        txHash: res.txHash,
        message: 'Dispute settlement executed and disbursed on Stellar!',
      }));

      // Update backend project status
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
        }),
      });

      toast.success('Dispute resolved! Funds disbursed to parties according to ruling.');
      setActiveResolveModal(false);
      await fetchProject();
    } catch (err: any) {
      setTxState((prev) => ({ ...prev, stage: 'error', error: err.message || String(err) }));
      toast.error(`Dispute resolution failed: ${err.message || err}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-24">
      {/* Top Banner Gradient */}
      <div className="h-64 bg-gradient-to-r from-indigo-900 via-slate-900 to-purple-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent"></div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-44 relative z-10">
        {/* Navigation / Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to Projects
          </button>

          <div className="flex items-center gap-2.5 flex-wrap">
            {hasOnChainEscrow ? (
              <a
                href={getStellarExplorerUrl(DEFAULT_ESCROW_CONTRACT_ID, 'contract')}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 hover:bg-emerald-500/20 transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Soroban Escrow #{project.project_id_onchain?.toString()}</span>
                <span className="text-[10px] text-emerald-300">↗</span>
              </a>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Off-Chain Draft</span>
              </span>
            )}

            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                project.status === 'draft'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : project.status === 'in_progress'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                  : project.status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/10 text-red-400 border-red-500/30'
              }`}
            >
              {project.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Project Header Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
                  {project.category || 'General'}
                </span>
                <span className="text-xs text-slate-400 uppercase tracking-widest">
                  {project.visibility} Escrow
                </span>
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">{project.title}</h1>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-2xl flex items-center gap-6 min-w-[220px] justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium block">Total Locked Escrow</span>
                <span className="text-2xl font-black text-indigo-400">
                  {project.budget} {tokenSymbol}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Project Overview</h3>
            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{project.description}</p>
          </div>

          {/* Participant Wallets Strip */}
          <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-0.5">👤 Client Wallet</span>
              <span className="font-mono text-slate-200 truncate block">
                {project.client_address
                  ? `${project.client_address.slice(0, 8)}...${project.client_address.slice(-6)}`
                  : 'Unassigned'}
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-0.5">🛠️ Freelancer Wallet</span>
              <span className="font-mono text-slate-200 truncate block">
                {project.freelancer_address
                  ? `${project.freelancer_address.slice(0, 8)}...${project.freelancer_address.slice(-6)}`
                  : 'Pending Assignment'}
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-0.5">⚖️ Designated Arbiter</span>
              <span className="font-mono text-slate-200 truncate block">
                {project.arbiter_address
                  ? `${project.arbiter_address.slice(0, 8)}...${project.arbiter_address.slice(-6)}`
                  : `${DEFAULT_ARBITER_ADDRESS.slice(0, 8)}...${DEFAULT_ARBITER_ADDRESS.slice(-6)}`}
              </span>
            </div>
          </div>

          {/* On-Chain Deposit Callout if project has not been locked on-chain yet */}
          {!hasOnChainEscrow && isClient && (
            <div className="mt-6 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>🛡️</span> Escrow Not Yet Funded on Stellar
                </h4>
                <p className="text-xs text-indigo-300/80 mt-0.5">
                  Deposit and lock total funds ({project.budget} {tokenSymbol}) directly into the Soroban smart contract to guarantee trustless settlement.
                </p>
              </div>
              <Button
                onClick={() => setShowFundEscrowModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold px-4 py-2 shrink-0 shadow-lg shadow-indigo-600/30"
              >
                Deposit & Lock Funds
              </Button>
            </div>
          )}

          {/* Dispute Alert Bar if project is Disputed */}
          {project.status === 'disputed' && (
            <div className="mt-6 p-5 rounded-2xl bg-red-950/50 border border-red-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-red-300 flex items-center gap-2">
                  <span>🚨</span> Project Funds Frozen in Dispute Arbitration
                </h4>
                <p className="text-xs text-red-200/80 mt-1">
                  Remaining escrow funds cannot be released until the designated arbiter submits an on-chain settlement ruling.
                </p>
              </div>

              {isArbiter && (
                <Button
                  onClick={() => setActiveResolveModal(true)}
                  className="bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold px-4 py-2 shrink-0 shadow-lg"
                >
                  Submit Dispute Ruling
                </Button>
              )}
            </div>
          )}

          {/* Attached Files Section */}
          {((project.attachments && project.attachments.length > 0) || (project.files && project.files.length > 0)) && (
            <div className="mt-6 pt-6 border-t border-slate-800">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Project Files & Attachments
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                {(project.files || project.attachments || []).map((file: any, fIdx: number) => {
                  const fileUrl = typeof file === 'string' ? file : (file.file_url || file.url || file.file_name || file.name);
                  const fileName = typeof file === 'string' ? file : (file.file_name || file.name || 'Attachment');
                  const isImage = typeof fileUrl === 'string' && (fileUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) || fileUrl.startsWith('data:image'));

                  if (isImage) {
                    return (
                      <div
                        key={fIdx}
                        onClick={() => setLightboxImage({ url: fileUrl, name: fileName })}
                        className="relative group/img cursor-pointer overflow-hidden rounded-xl border border-slate-800 hover:border-indigo-500 transition-all shadow-md bg-slate-900"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fileUrl} alt={fileName} className="w-20 h-20 object-cover transform group-hover/img:scale-110 transition-transform duration-200" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                          🔍 View
                        </div>
                      </div>
                    );
                  }

                  return (
                    <a
                      key={fIdx}
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl border border-slate-800 font-mono flex items-center gap-2 transition-colors"
                    >
                      <span>📄</span>
                      <span className="truncate max-w-[200px]">{fileName}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Milestones Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              Milestones & Releases
              <span className="text-xs bg-indigo-500/20 text-indigo-300 font-semibold px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                {project.milestones?.length || 0}
              </span>
            </h2>

            {project.status !== 'completed' && project.status !== 'disputed' && (
              <Button
                onClick={() => setActiveDisputeModal(true)}
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl text-xs"
              >
                ⚖️ Raise Dispute
              </Button>
            )}
          </div>

          {!project.milestones || project.milestones.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-10 text-center flex flex-col items-center justify-center">
              <p className="text-slate-300 font-medium">No milestones created for this project.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {project.milestones
                .sort((a, b) => a.milestone_index - b.milestone_index)
                .map((m, idx) => (
                  <div
                    key={m.id || idx}
                    className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <h3 className="text-lg font-bold text-white">{m.title}</h3>

                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded border uppercase tracking-wider ${
                            m.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : m.status === 'submitted'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : m.status === 'disputed'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {m.status}
                        </span>

                        {m.status === 'submitted' && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                            <span>⏳</span>
                            <span>Review Period Active (7-Day Auto-Release)</span>
                          </span>
                        )}
                      </div>

                      {m.description && <p className="text-sm text-slate-400 pl-10">{m.description}</p>}

                      <div className="flex flex-wrap gap-4 pl-10 pt-1 text-xs text-slate-500 font-medium">
                        {m.deliverable_type && (
                          <span>
                            Deliverable: <strong className="text-slate-300">{m.deliverable_type}</strong>
                          </span>
                        )}
                        {m.due_date && (
                          <span>
                            Due: <strong className="text-slate-300">{new Date(m.due_date).toLocaleDateString()}</strong>
                          </span>
                        )}
                        {m.submitted_at && (
                          <span>
                            Submitted: <strong className="text-slate-300">{new Date(m.submitted_at).toLocaleDateString()}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right side: Amount & Action Buttons */}
                    <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center border-t lg:border-t-0 lg:border-l border-slate-800 pt-4 lg:pt-0 lg:pl-6 gap-3 shrink-0">
                      <div className="text-left lg:text-right">
                        <span className="text-xs text-slate-500 font-medium block">Milestone Amount</span>
                        <span className="text-xl font-bold text-indigo-400">
                          {m.amount} {tokenSymbol}
                        </span>
                      </div>

                      {/* On-Chain Action Controls */}
                      <div className="flex items-center gap-2">
                        {/* Freelancer Submit Button */}
                        {m.status === 'pending' && (
                          <Button
                            onClick={() => setActiveDeliverableModal(m)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold px-4 py-2"
                          >
                            Submit Work 🚀
                          </Button>
                        )}

                        {/* Client Approve & Release Button */}
                        {m.status === 'submitted' && (
                          <Button
                            onClick={() => setActiveApproveModal(m)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold px-4 py-2 shadow-lg shadow-emerald-600/20"
                          >
                            Approve & Release 💰
                          </Button>
                        )}

                        {m.status === 'approved' && (
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 flex items-center gap-1.5">
                            <span>✓</span> Released On-Chain
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Freelancer Submit Deliverable Modal */}
      {activeDeliverableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Milestone #{activeDeliverableModal.milestone_index + 1} Deliverable
              </span>
              <h3 className="text-xl font-bold text-white mt-1">{activeDeliverableModal.title}</h3>
              <p className="text-xs text-slate-400 mt-1">
                Submitting this deliverable invokes <code className="text-indigo-300">submit_milestone</code> on the Soroban smart contract, starting the 7-day client review timelock.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Deliverable URL / Repository PR / IPFS Hash</label>
                <input
                  type="text"
                  value={deliverableUrl}
                  onChange={(e) => setDeliverableUrl(e.target.value)}
                  placeholder="https://github.com/organization/repo/pull/1 or ipfs://..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Submission Notes & Completion Summary</label>
                <textarea
                  rows={3}
                  value={deliverableNotes}
                  onChange={(e) => setDeliverableNotes(e.target.value)}
                  placeholder="Summarize the delivered components, tests passed, and verification steps..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                onClick={() => setActiveDeliverableModal(null)}
                className="border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitDeliverable}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold px-5"
              >
                Sign & Submit via Freighter ↗
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Client Approve Milestone Modal */}
      {activeApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Release Milestone Payment</span>
              <h3 className="text-xl font-bold text-white mt-1">{activeApproveModal.title}</h3>
              <p className="text-xs text-slate-400 mt-1">
                Approving this milestone will execute <code className="text-emerald-300">approve_milestone</code> on Stellar, immediately releasing locked tokens to the freelancer wallet.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Release Amount:</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {activeApproveModal.amount} {tokenSymbol}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Recipient Freelancer:</span>
                <span className="font-mono text-slate-400">
                  {project.freelancer_address
                    ? `${project.freelancer_address.slice(0, 8)}...${project.freelancer_address.slice(-6)}`
                    : 'Designated Freelancer'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                onClick={() => setActiveApproveModal(null)}
                className="border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleApproveMilestone}
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold px-5"
              >
                Confirm On-Chain Release ↗
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Fund Escrow on Soroban Modal */}
      {showFundEscrowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Soroban Smart Contract Funding</span>
              <h3 className="text-xl font-bold text-white mt-1">Lock Escrow Deposit</h3>
              <p className="text-xs text-slate-400 mt-1">
                Deposit {project.budget} {tokenSymbol} into the TrustPay Soroban escrow contract on Stellar Testnet.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Designated Freelancer Stellar Address (G...)</label>
                <input
                  type="text"
                  value={fundFreelancerAddress}
                  onChange={(e) => setFundFreelancerAddress(e.target.value)}
                  placeholder="G..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-slate-400">
                <div className="flex justify-between">
                  <span>Contract Target:</span>
                  <span className="font-mono text-indigo-300 text-[11px] truncate max-w-[200px]">{DEFAULT_ESCROW_CONTRACT_ID}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Escrow Deposit:</span>
                  <span className="font-bold text-white">{project.budget} {tokenSymbol}</span>
                </div>
                <div className="flex justify-between">
                  <span>Milestones Count:</span>
                  <span className="text-slate-300">{project.milestones?.length || 1}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                onClick={() => setShowFundEscrowModal(false)}
                className="border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleFundEscrowOnChain}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold px-5"
              >
                Sign & Lock Escrow ↗
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Raise Dispute Modal */}
      {activeDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-red-400">Formal Arbitration Request</span>
              <h3 className="text-xl font-bold text-white mt-1">Initiate Dispute on Stellar</h3>
              <p className="text-xs text-slate-400 mt-1">
                Calling <code className="text-red-300">raise_dispute</code> transitions the smart contract to Disputed, freezing unreleased funds until the arbiter rules.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Reason for Dispute</label>
                <textarea
                  rows={3}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Detail the failure to deliver agreed specifications, missed deadlines, or communication breakdown..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                onClick={() => setActiveDisputeModal(false)}
                className="border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRaiseDispute}
                className="bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold px-5"
              >
                Sign & Raise Dispute ↗
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Arbiter Resolve Dispute Modal */}
      {activeResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Arbiter Settlement Verdict</span>
              <h3 className="text-xl font-bold text-white mt-1">Resolve Escrow Allocation</h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter the settlement amounts. Total allocation cannot exceed the project budget ({project.budget} {tokenSymbol}).
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Client Refund Amount ({tokenSymbol})</label>
                <input
                  type="number"
                  value={resolveClientAmount}
                  onChange={(e) => setResolveClientAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Amount refunded to client"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Freelancer Payout Amount ({tokenSymbol})</label>
                <input
                  type="number"
                  value={resolveFreelancerAmount}
                  onChange={(e) => setResolveFreelancerAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Amount paid to freelancer"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                onClick={() => setActiveResolveModal(false)}
                className="border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleResolveDispute}
                className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold px-5"
              >
                Execute Ruling on Stellar ↗
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TRANSACTION PROGRESS OVERLAY MODAL */}
      {txState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
            {txState.stage === 'error' ? (
              <div className="w-14 h-14 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-2xl">
                ✕
              </div>
            ) : txState.stage === 'success' ? (
              <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto text-2xl">
                ✓
              </div>
            ) : (
              <div className="w-14 h-14 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto">
                <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}

            <h3 className="text-lg font-bold text-white capitalize">
              {txState.stage === 'simulating' && 'Simulating Contract Call...'}
              {txState.stage === 'signing' && 'Awaiting Wallet Signature...'}
              {txState.stage === 'submitting' && 'Broadcasting to Stellar...'}
              {txState.stage === 'polling' && 'Confirming on Ledger...'}
              {txState.stage === 'success' && 'Transaction Confirmed!'}
              {txState.stage === 'error' && 'Transaction Error'}
              {txState.stage === 'preparing' && 'Preparing Transaction...'}
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              {txState.error || txState.message}
            </p>

            {txState.txHash && (
              <a
                href={getStellarExplorerUrl(txState.txHash, 'tx')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 underline font-mono block pt-1"
              >
                View on Stellar.Expert ({txState.txHash.slice(0, 8)}...) ↗
              </a>
            )}

            {(txState.stage === 'success' || txState.stage === 'error') && (
              <Button
                onClick={() => setTxState((prev) => ({ ...prev, isOpen: false }))}
                className="mt-2 w-full bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs py-2"
              >
                Close
              </Button>
            )}
          </div>
        </div>
      )}

      {lightboxImage && (
        <ImageLightboxModal
          imageUrl={lightboxImage.url}
          imageAlt={lightboxImage.name}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
}
