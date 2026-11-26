'use client';

import React, { useState, useMemo } from 'react';
import { AddressBadge } from './AddressBadge';
import { TransactionActivity, TransactionOperationType } from '@/types';

export interface TransactionLedgerTableProps {
  transactions?: TransactionActivity[];
  isTestnet?: boolean;
  isLoading?: boolean;
  pageSize?: number;
  className?: string;
}

const DEFAULT_MOCK_TRANSACTIONS: TransactionActivity[] = [
  {
    id: 'tx-1',
    hash: '6a87b5c4d3e2f10987654321fedcba0987654321fedcba0987654321abcdef01',
    ledger: 1045230,
    timestamp: '2026-11-19T10:15:30Z',
    operation_type: 'Deposit',
    amount: 1500,
    asset: 'USDC',
    counterparty: 'GB7TND7...4W2K',
    status: 'success',
  },
  {
    id: 'tx-2',
    hash: '1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f8091',
    ledger: 1045280,
    timestamp: '2026-11-19T11:22:15Z',
    operation_type: 'Release',
    amount: 750,
    asset: 'USDC',
    counterparty: 'GCR45KD...9P1X',
    status: 'success',
  },
  {
    id: 'tx-3',
    hash: '9081726354a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8',
    ledger: 1045350,
    timestamp: '2026-11-19T12:05:00Z',
    operation_type: 'Fee',
    amount: 7.5,
    asset: 'USDC',
    counterparty: 'GA3X89L...2M4N',
    status: 'success',
  },
  {
    id: 'tx-4',
    hash: 'abcdef0123456789fedcba9876543210123456789abcdef0123456789fedcba9',
    ledger: 1045410,
    timestamp: '2026-11-19T13:40:10Z',
    operation_type: 'Dispute',
    amount: 500,
    asset: 'USDC',
    counterparty: 'GD77QLE...0S5T',
    status: 'pending',
  },
];

export function TransactionLedgerTable({
  transactions = DEFAULT_MOCK_TRANSACTIONS,
  isTestnet = true,
  isLoading = false,
  pageSize = 5,
  className = '',
}: TransactionLedgerTableProps) {
  const [filterType, setFilterType] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filterOptions: ('All' | TransactionOperationType)[] = [
    'All',
    'Deposit',
    'Release',
    'Dispute',
    'Fee',
  ];

  const filtered = useMemo(() => {
    if (filterType === 'All') return transactions;
    return transactions.filter((tx) => tx.operation_type === filterType);
  }, [transactions, filterType]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const getStellarExpertUrl = (hash: string) => {
    const network = isTestnet ? 'testnet' : 'public';
    return `https://stellar.expert/explorer/${network}/tx/${hash}`;
  };

  const formatShortHash = (hash: string) => {
    if (hash.length <= 12) return hash;
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  const getOpBadgeClass = (op: TransactionOperationType) => {
    switch (op) {
      case 'Deposit':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Release':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Dispute':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Fee':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className={`w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">On-Chain Activity Ledger</h3>
          <p className="text-sm text-slate-400">Verifiable transaction audit trail with Stellar Expert links</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {filterOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                setFilterType(opt);
                setCurrentPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors border ${
                filterType === opt
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                  : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-white'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="border-b border-slate-800 bg-slate-900/40 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Operation</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Counterparty</th>
              <th className="px-4 py-3">Tx Hash & Explorer</th>
              <th className="px-4 py-3">Timestamp / Ledger</th>
              <th className="px-4 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Loading on-chain ledger records...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No transaction records found matching this filter.
                </td>
              </tr>
            ) : (
              paginated.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-900/30 transition-colors">
                  <td className="px-4 py-3.5">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getOpBadgeClass(tx.operation_type)}`}>
                      {tx.operation_type}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-white">
                    {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}{' '}
                    <span className="text-xs text-slate-400 font-normal">{tx.asset}</span>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-slate-400">
                    {tx.counterparty}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-300">{formatShortHash(tx.hash)}</span>
                      <AddressBadge value={tx.hash} label="Copy Transaction Hash" />
                      <a
                        href={getStellarExpertUrl(tx.hash)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 ml-1"
                      >
                        Stellar Expert ↗
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-400">
                    <div>{new Date(tx.timestamp).toLocaleString()}</div>
                    <div className="text-[11px] text-slate-500">Ledger #{tx.ledger}</div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium uppercase ${
                        tx.status === 'success'
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : tx.status === 'pending'
                          ? 'text-amber-400 bg-amber-500/10'
                          : 'text-rose-400 bg-rose-500/10'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-slate-400">
          <div>
            Page {currentPage} of {totalPages} ({filtered.length} total)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1 rounded bg-slate-800 disabled:opacity-50 hover:bg-slate-700 text-white transition"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 rounded bg-slate-800 disabled:opacity-50 hover:bg-slate-700 text-white transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
