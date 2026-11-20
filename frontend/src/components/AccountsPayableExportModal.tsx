'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Project } from '@/types';
import {
  buildPayableRows,
  summarizePayableRows,
  exportPayableRowsCsv,
  exportPayableRowsExcel,
} from '@/lib/ap-exporter';

export interface AccountsPayableExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function AccountsPayableExportModal({ isOpen, onClose, projects }: AccountsPayableExportModalProps) {
  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(todayStr());

  const rows = useMemo(
    () => buildPayableRows(projects, startDate || undefined, endDate || undefined),
    [projects, startDate, endDate]
  );
  const totals = useMemo(() => summarizePayableRows(rows), [rows]);

  if (!isOpen) return null;

  const stamp = `${startDate || 'start'}_to_${endDate || 'today'}`;

  const handleExportCsv = () => {
    if (rows.length === 0) {
      toast.error('No payable disbursements in the selected range.');
      return;
    }
    exportPayableRowsCsv(rows, totals, `accounts-payable-${stamp}.csv`);
    toast.success(`Exported ${rows.length} AP ledger rows to CSV.`);
  };

  const handleExportExcel = () => {
    if (rows.length === 0) {
      toast.error('No payable disbursements in the selected range.');
      return;
    }
    exportPayableRowsExcel(rows, totals, `accounts-payable-${stamp}.xls`);
    toast.success(`Exported ${rows.length} AP ledger rows to Excel.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-3xl w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Accounts Payable</span>
          <h3 className="text-xl font-bold text-white mt-1">Enterprise Contractor Disbursement Export</h3>
          <p className="text-xs text-slate-400 mt-1">
            Batch milestone payouts across {projects.length} project(s) into a GAAP/IFRS-ready AP schedule with on-chain tx hashes for audit compliance.
          </p>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Gross Disbursement</span>
            <span className="text-lg font-black text-white">${totals.grossDisbursement.toFixed(2)}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Platform Service Fee</span>
            <span className="text-lg font-black text-amber-400">${totals.platformFees.toFixed(2)}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Net Contractor Payout</span>
            <span className="text-lg font-black text-emerald-400">${totals.netContractorPayout.toFixed(2)}</span>
          </div>
        </div>

        {/* Preview table */}
        <div className="rounded-2xl border border-slate-800 overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-950 sticky top-0">
                <tr className="text-left text-slate-400 uppercase tracking-wider">
                  <th className="px-3 py-2">Contractor</th>
                  <th className="px-3 py-2">Milestone</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">USD</th>
                  <th className="px-3 py-2">Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      No milestone disbursements in the selected date range.
                    </td>
                  </tr>
                ) : (
                  rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-slate-800/60 text-slate-300">
                      <td className="px-3 py-2 max-w-[140px] truncate" title={r.contractorAddress || r.contractorName}>
                        {r.contractorName}
                      </td>
                      <td className="px-3 py-2 max-w-[160px] truncate" title={r.milestoneTitle}>
                        {r.milestoneTitle}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-semibold">
                        {r.tokenAmount} {r.token}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">${r.usdValue.toFixed(2)}</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-indigo-300 max-w-[120px] truncate" title={r.txHash}>
                        {r.txHash ? `${r.txHash.slice(0, 10)}…${r.txHash.slice(-6)}` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {rows.length > 50 && (
            <p className="px-3 py-2 text-[10px] text-slate-500 border-t border-slate-800">
              Showing first 50 of {rows.length} rows — full schedule is included in the export.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
          >
            Close
          </Button>
          <Button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold px-5"
          >
            Export Excel (.xls)
          </Button>
          <Button
            onClick={handleExportCsv}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold px-5"
          >
            Export CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
