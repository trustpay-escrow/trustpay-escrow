'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useWalletStore } from '@/store/walletStore';
import { authFetch } from '@/lib/api';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import type { Project, Milestone } from '@/types';
import { StatusBadge } from './StatusBadge';

interface PendingMilestone {
  milestoneId: string;
  projectId: string;
  projectTitle: string;
  milestoneIndex: number;
  milestoneTitle: string;
  amount: number;
  token: string;
  freelancerAddress: string;
  status: string;
  deliverableHash?: string;
  deliverableNotes?: string;
  submittedAt?: string;
  dueDate?: string;
  selected?: boolean;
}

interface BatchApprovalState {
  approvals: Record<string, boolean>;
  rejections: Record<string, boolean>;
  rejectionReasons: Record<string, string>;
}

export interface BatchMilestoneApprovalDashboardProps {
  projects?: Project[];
  onApprovalComplete?: (approvedCount: number, rejectedCount: number) => void;
}

export function BatchMilestoneApprovalDashboard({
  projects = [],
  onApprovalComplete,
}: BatchMilestoneApprovalDashboardProps) {
  const { address } = useWalletStore();
  const [pendingMilestones, setPendingMilestones] = useState<PendingMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'submitted' | 'in_revision'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [selectedMilestonePreview, setSelectedMilestonePreview] = useState<PendingMilestone | null>(null);

  // Batch approval state
  const [batchState, setBatchState] = useState<BatchApprovalState>({
    approvals: {},
    rejections: {},
    rejectionReasons: {},
  });

  useEscapeKey(() => setShowPreview(false), showPreview);

  // Fetch pending milestones
  useEffect(() => {
    const fetchPendingMilestones = async () => {
      if (!address) {
        setLoading(false);
        return;
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await authFetch(`${apiUrl}/api/projects/pending-milestones`, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch pending milestones');
        }

        const data: PendingMilestone[] = await response.json();
        setPendingMilestones(data);

        // Initialize batch state
        const initialApprovals: Record<string, boolean> = {};
        data.forEach((m) => {
          initialApprovals[m.milestoneId] = false;
        });
        setBatchState((prev) => ({ ...prev, approvals: initialApprovals }));
      } catch (error) {
        console.error('Error fetching pending milestones:', error);
        toast.error('Failed to load pending milestones');
      } finally {
        setLoading(false);
      }
    };

    fetchPendingMilestones();
  }, [address]);

  // Filter and search milestones
  const filteredMilestones = useMemo(() => {
    return pendingMilestones.filter((m) => {
      const matchesStatus = filterStatus === 'all' || m.status === filterStatus;
      const matchesSearch =
        searchTerm === '' ||
        m.projectTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.milestoneTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.freelancerAddress.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [pendingMilestones, filterStatus, searchTerm]);

  // Calculate batch stats
  const stats = useMemo(() => {
    const selectedForApproval = Object.entries(batchState.approvals)
      .filter(([_, approved]) => approved)
      .map(([id]) => id);
    const selectedForRejection = Object.entries(batchState.rejections)
      .filter(([_, rejected]) => rejected)
      .map(([id]) => id);
    const totalAmount = filteredMilestones
      .filter((m) => selectedForApproval.includes(m.milestoneId))
      .reduce((sum, m) => sum + m.amount, 0);

    return {
      selectedForApproval: selectedForApproval.length,
      selectedForRejection: selectedForRejection.length,
      totalAmount,
      totalMilestones: filteredMilestones.length,
    };
  }, [batchState, filteredMilestones]);

  const handleSelectMilestone = (milestoneId: string, approve: boolean) => {
    setBatchState((prev) => {
      const newState = { ...prev };
      if (approve) {
        newState.approvals[milestoneId] = !newState.approvals[milestoneId];
        if (newState.approvals[milestoneId]) {
          newState.rejections[milestoneId] = false;
          delete newState.rejectionReasons[milestoneId];
        }
      } else {
        newState.rejections[milestoneId] = !newState.rejections[milestoneId];
        if (newState.rejections[milestoneId]) {
          newState.approvals[milestoneId] = false;
        }
      }
      return newState;
    });
  };

  const handleSetRejectionReason = (milestoneId: string, reason: string) => {
    setBatchState((prev) => ({
      ...prev,
      rejectionReasons: { ...prev.rejectionReasons, [milestoneId]: reason },
    }));
  };

  const handleSelectAll = (approve: boolean) => {
    setBatchState((prev) => {
      const newState = { ...prev };
      filteredMilestones.forEach((m) => {
        if (approve) {
          newState.approvals[m.milestoneId] = true;
          newState.rejections[m.milestoneId] = false;
          delete newState.rejectionReasons[m.milestoneId];
        } else {
          newState.approvals[m.milestoneId] = false;
        }
      });
      return newState;
    });
  };

  const handleClearAll = () => {
    setBatchState({
      approvals: {},
      rejections: {},
      rejectionReasons: {},
    });
  };

  const handleSubmitBatch = async () => {
    const approvalsToSubmit = Object.entries(batchState.approvals)
      .filter(([_, approved]) => approved)
      .map(([id]) => id);

    const rejectionsToSubmit = Object.entries(batchState.rejections)
      .filter(([_, rejected]) => rejected)
      .map(([id]) => id);

    if (approvalsToSubmit.length === 0 && rejectionsToSubmit.length === 0) {
      toast.warning('Please select at least one milestone to approve or reject');
      return;
    }

    setSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // Submit batch approvals
      if (approvalsToSubmit.length > 0) {
        const approvalResponse = await authFetch(`${apiUrl}/api/milestones/batch-approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ milestoneIds: approvalsToSubmit }),
        });

        if (!approvalResponse.ok) {
          throw new Error('Failed to approve milestones');
        }
      }

      // Submit batch rejections
      if (rejectionsToSubmit.length > 0) {
        const rejectionResponse = await authFetch(`${apiUrl}/api/milestones/batch-reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            milestoneIds: rejectionsToSubmit,
            reasons: rejectionsToSubmit.reduce(
              (acc, id) => {
                acc[id] = batchState.rejectionReasons[id] || 'No reason provided';
                return acc;
              },
              {} as Record<string, string>
            ),
          }),
        });

        if (!rejectionResponse.ok) {
          throw new Error('Failed to reject milestones');
        }
      }

      toast.success(
        `Batch processed: ${approvalsToSubmit.length} approved, ${rejectionsToSubmit.length} rejected`
      );

      // Refresh pending milestones
      setPendingMilestones((prev) =>
        prev.filter((m) => ![...approvalsToSubmit, ...rejectionsToSubmit].includes(m.milestoneId))
      );

      // Clear selections
      setBatchState({ approvals: {}, rejections: {}, rejectionReasons: {} });

      // Notify parent
      onApprovalComplete?.(approvalsToSubmit.length, rejectionsToSubmit.length);
    } catch (error) {
      console.error('Error submitting batch:', error);
      toast.error('Failed to process batch approvals');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-700 rounded animate-pulse w-48" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (pendingMilestones.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-16 h-16 text-gray-500 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-white mb-2">No Pending Milestones</h3>
        <p className="text-gray-400">All milestones have been reviewed or are awaiting submission.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-800">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Pending</p>
          <p className="text-2xl font-bold text-white">{stats.totalMilestones}</p>
        </div>
        <div className="p-4 rounded-lg bg-emerald-900/20 border border-emerald-800/40">
          <p className="text-xs text-emerald-300 uppercase tracking-wider mb-1">Selected Approve</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.selectedForApproval}</p>
        </div>
        <div className="p-4 rounded-lg bg-rose-900/20 border border-rose-800/40">
          <p className="text-xs text-rose-300 uppercase tracking-wider mb-1">Selected Reject</p>
          <p className="text-2xl font-bold text-rose-400">{stats.selectedForRejection}</p>
        </div>
        <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-800/40">
          <p className="text-xs text-blue-300 uppercase tracking-wider mb-1">Total Amount</p>
          <p className="text-2xl font-bold text-blue-400">{stats.totalAmount.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by project, milestone, or freelancer address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'submitted' | 'in_revision')}
            className="px-4 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="in_revision">In Revision</option>
          </select>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleSelectAll(true)}
            className="px-3 py-2 text-xs rounded-lg bg-emerald-900/30 border border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/50 transition-all"
          >
            Select All for Approval
          </button>
          <button
            onClick={handleClearAll}
            className="px-3 py-2 text-xs rounded-lg bg-gray-900/50 border border-gray-700/50 text-gray-300 hover:bg-gray-900/70 transition-all"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Milestones Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left font-semibold text-gray-300">Project</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-300">Milestone</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-300">Freelancer</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-300">Amount</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-300">Status</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-300">Approve</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-300">Reject</th>
            </tr>
          </thead>
          <tbody>
            {filteredMilestones.map((milestone) => (
              <tr key={milestone.milestoneId} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                <td className="px-4 py-3 text-white font-medium">{milestone.projectTitle}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => {
                      setSelectedMilestonePreview(milestone);
                      setShowPreview(true);
                    }}
                    className="text-blue-400 hover:text-blue-300 font-medium"
                  >
                    {milestone.milestoneTitle}
                  </button>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-gray-400">
                  {milestone.freelancerAddress.slice(0, 8)}...{milestone.freelancerAddress.slice(-4)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-white">
                  {milestone.amount} {milestone.token}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={milestone.status} size="sm" />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={batchState.approvals[milestone.milestoneId] || false}
                    onChange={() => handleSelectMilestone(milestone.milestoneId, true)}
                    disabled={submitting}
                    className="w-4 h-4 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={batchState.rejections[milestone.milestoneId] || false}
                    onChange={() => handleSelectMilestone(milestone.milestoneId, false)}
                    disabled={submitting}
                    className="w-4 h-4 cursor-pointer"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-800">
        <button
          onClick={handleSubmitBatch}
          disabled={
            submitting ||
            (Object.values(batchState.approvals).every((v) => !v) &&
              Object.values(batchState.rejections).every((v) => !v))
          }
          className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold disabled:opacity-50 transition-all"
        >
          {submitting ? 'Processing...' : `Submit Batch (${stats.selectedForApproval + stats.selectedForRejection})`}
        </button>
        <button
          onClick={handleClearAll}
          disabled={
            submitting ||
            (Object.values(batchState.approvals).every((v) => !v) &&
              Object.values(batchState.rejections).every((v) => !v))
          }
          className="px-6 py-3 rounded-lg bg-gray-900/50 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 font-semibold disabled:opacity-50 transition-all"
        >
          Reset
        </button>
      </div>

      {/* Preview Modal */}
      {showPreview && selectedMilestonePreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedMilestonePreview.milestoneTitle}</h3>
                <p className="text-sm text-gray-400">{selectedMilestonePreview.projectTitle}</p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Amount</p>
                <p className="text-lg font-semibold text-white">
                  {selectedMilestonePreview.amount} {selectedMilestonePreview.token}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
                <StatusBadge status={selectedMilestonePreview.status} />
              </div>
              {selectedMilestonePreview.dueDate && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Due Date</p>
                  <p className="text-sm text-white">{new Date(selectedMilestonePreview.dueDate).toLocaleDateString()}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Freelancer</p>
                <p className="text-sm font-mono text-gray-400 truncate">
                  {selectedMilestonePreview.freelancerAddress}
                </p>
              </div>
            </div>
            {selectedMilestonePreview.deliverableNotes && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Deliverable Notes</p>
                <p className="text-sm text-gray-300">{selectedMilestonePreview.deliverableNotes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BatchMilestoneApprovalDashboard;
