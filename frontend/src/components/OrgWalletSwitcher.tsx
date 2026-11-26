'use client';

import React, { useId, useRef, useState } from 'react';
import { useWalletStore, OrgWalletAccount } from '@/store/walletStore';
import { useTokenBalance } from '@/hooks/useCreateProjectForm';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { CryptoId } from '@/components/ui/CryptoId';

const STELLAR_ADDRESS_REGEX = /^G[A-Z2-7]{55}$/;

function OrgWalletBalance({ address }: { address: string }) {
  const balance = useTokenBalance(address, 'USDC');
  if (balance.loading) return <span className="text-[10px] text-[#71717a]">…</span>;
  if (balance.balance === null) return <span className="text-[10px] text-[#71717a]">—</span>;
  return <span className="text-[10px] font-bold text-emerald-300">{balance.balance.toLocaleString()} USDC</span>;
}

function OrgWalletRow({
  account,
  isActive,
  onSelect,
  onRemove,
}: {
  account: OrgWalletAccount;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
        isActive ? 'border-blue-500/50 bg-blue-500/10' : 'border-[#27272a] bg-[#1c1c20] hover:border-[#3f3f46]'
      }`}
    >
      <button type="button" onClick={onSelect} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-blue-400' : 'bg-[#3f3f46]'}`} />
          <span className="text-xs font-bold text-white truncate">{account.label}</span>
          {account.isPrimary && (
            <span className="text-[9px] font-bold uppercase tracking-wide text-[#71717a] border border-[#3f3f46] rounded px-1 py-0.5">
              Primary
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <CryptoId value={account.address} head={5} tail={3} className="text-[10px] text-[#a1a1aa] font-mono" />
          <OrgWalletBalance address={account.address} />
        </div>
      </button>
      {!account.isPrimary && (
        <button
          type="button"
          onClick={onRemove}
          className="text-[#71717a] hover:text-red-400 text-xs px-1 shrink-0"
          aria-label={`Remove ${account.label}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function OrgWalletSwitcher() {
  const { orgAccounts, activeOrgAccountId, setActiveOrgAccount, addOrgAccount, removeOrgAccount } = useWalletStore();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useFocusTrap(popoverRef, {
    isOpen: open,
    onClose: () => setOpen(false),
  });

  const activeAccount = orgAccounts.find((account) => account.id === activeOrgAccountId) || orgAccounts[0] || null;

  const handleAdd = () => {
    const trimmedAddress = address.trim();
    if (!STELLAR_ADDRESS_REGEX.test(trimmedAddress)) {
      setError('Enter a valid Stellar address (G… 56 chars)');
      return;
    }
    addOrgAccount({ label: label.trim() || 'Org wallet', address: trimmedAddress });
    setLabel('');
    setAddress('');
    setError('');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-xl border border-[#333338] bg-[#232326] px-3 py-1.5 hover:border-blue-500/50 transition-colors"
        aria-expanded={open}
        aria-label="Organization wallet switcher"
      >
        <span className="text-base leading-none">🏦</span>
        <span className="text-xs font-bold text-white max-w-[140px] truncate">
          {activeAccount?.label || 'Org wallets'}
        </span>
        <span className="text-[10px] text-[#71717a]">{orgAccounts.length}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={popoverRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="absolute right-0 top-full mt-2 z-50 w-80 max-w-[90vw] rounded-2xl border border-[#333338] bg-[#18181b] p-3 shadow-2xl space-y-2.5 focus:outline-none"
          >
            <div className="flex items-center justify-between px-1">
              <h4 id={titleId} className="text-xs font-extrabold uppercase tracking-wider text-[#e4e4e7]">Organization wallets</h4>
              <button type="button" onClick={() => setOpen(false)} className="text-[#71717a] hover:text-white text-sm" aria-label="Close wallet switcher">
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
              {orgAccounts.map((account) => (
                <OrgWalletRow
                  key={account.id}
                  account={account}
                  isActive={account.id === (activeOrgAccountId || activeAccount?.id)}
                  onSelect={() => {
                    setActiveOrgAccount(account.id);
                    setOpen(false);
                  }}
                  onRemove={() => removeOrgAccount(account.id)}
                />
              ))}
              {orgAccounts.length === 0 && (
                <p className="text-[11px] text-[#a1a1aa] px-1 py-2">No wallets configured yet.</p>
              )}
            </div>

            <div className="border-t border-[#27272a] pt-2.5 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">Add sub-account</p>
              <input
                aria-label="Sub-account label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Label (e.g. Marketing Treasury)"
                className="w-full px-3 py-2 bg-[#232326] border border-[#333338] rounded-lg text-xs text-white placeholder-[#71717a] focus:outline-none focus:border-blue-500"
              />
              <input
                aria-label="Sub-account Stellar address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Stellar address (G…)"
                className="w-full px-3 py-2 bg-[#232326] border border-[#333338] rounded-lg text-xs text-white font-mono placeholder-[#71717a] focus:outline-none focus:border-blue-500"
              />
              {error && <p role="alert" className="text-[10px] text-red-400 font-semibold">{error}</p>}
              <button
                type="button"
                onClick={handleAdd}
                className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Add wallet
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
