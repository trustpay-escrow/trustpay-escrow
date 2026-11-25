'use client';

import React, { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useWalletStore } from '@/store/walletStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { CryptoId } from '@/components/ui/CryptoId';
import {
  PASSKEY_FALLBACK_MESSAGE,
  clearStoredPasskey,
  connectPasskeyWallet,
  detectPasskeySupport,
  loadStoredPasskey,
  signWithPasskey,
  sha256,
  type PasskeyCredential,
} from '@/lib/wallet-adapters';

export interface PasskeyWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Invoked when the user chooses an extension wallet instead. */
  onFallback?: () => void;
}

type ModalState = 'idle' | 'registering' | 'signing' | 'connected';

export function PasskeyWalletModal({ isOpen, onClose, onFallback }: PasskeyWalletModalProps) {
  const headingId = useId();
  const nameId = useId();
  const setWalletInfo = useWalletStore((state) => state.setWalletInfo);

  const [supported] = useState<boolean>(() => detectPasskeySupport());
  const [stored, setStored] = useState<PasskeyCredential | null>(() => loadStoredPasskey());
  const [userName, setUserName] = useState('');
  const [state, setState] = useState<ModalState>('idle');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState<{ address: string; label: string } | null>(null);

  const dialogRef = useFocusTrap<HTMLDivElement>({
    active: isOpen,
    onEscape: () => {
      if (state !== 'registering' && state !== 'signing') onClose();
    },
  });

  if (!isOpen) return null;

  const finish = (address: string, label: string) => {
    setWalletInfo(address, true, true, 'Passkey (WebAuthn)');
    setConnected({ address, label });
    setStored(loadStoredPasskey());
    setState('connected');
    toast.success('Passkey wallet connected.');
  };

  const handleRegister = async () => {
    setError('');
    setState('registering');
    try {
      const connection = await connectPasskeyWallet({
        userName: userName.trim() || 'TrustPay User',
      });
      finish(connection.address, connection.passkey?.label || 'TrustPay User');
    } catch (err) {
      setState('idle');
      const message = err instanceof Error ? err.message : 'Passkey registration failed.';
      setError(message);
      toast.error(message);
    }
  };

  const handleSignIn = async () => {
    if (!stored) return;
    setError('');
    setState('signing');
    try {
      const digest = await sha256(new TextEncoder().encode(`trustpay:login:${stored.accountAddress}`));
      await signWithPasskey({ credentialId: stored.credentialId, challenge: digest });
      finish(stored.accountAddress, stored.label);
    } catch (err) {
      setState('idle');
      const message = err instanceof Error ? err.message : 'Passkey verification failed.';
      setError(message);
      toast.error(message);
    }
  };

  const handleUseAnother = () => {
    clearStoredPasskey();
    setStored(null);
    setState('idle');
  };

  const busy = state === 'registering' || state === 'signing';

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md sm:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        data-testid="passkey-wallet-modal"
        className="relative my-auto w-full max-w-md space-y-5 rounded-3xl border border-[#3f3f46] bg-[#18181b] p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 text-2xl shadow-lg shadow-emerald-500/20">
              🔐
            </div>
            <div>
              <h3 id={headingId} className="text-xl font-extrabold tracking-tight text-white">
                Passkey Wallet
              </h3>
              <p className="text-[11px] font-medium text-[#a1a1aa]">
                Biometric login with TouchID, FaceID or Windows Hello
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close passkey wallet"
            className="rounded-lg border border-[#3f3f46] bg-[#27272a] px-2 py-1 text-xs text-[#a1a1aa] transition-colors hover:text-white disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {supported === false ? (
          <div className="space-y-4">
            <p
              data-testid="passkey-unsupported"
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-200"
            >
              {PASSKEY_FALLBACK_MESSAGE}
            </p>
            <button
              type="button"
              data-testid="passkey-fallback"
              onClick={() => {
                onClose();
                onFallback?.();
              }}
              className="w-full rounded-xl border border-[#3f3f46] bg-[#232326] px-4 py-3 text-xs font-bold text-white transition-colors hover:bg-[#2a2a30]"
            >
              Use an extension wallet instead
            </button>
          </div>
        ) : state === 'connected' && connected ? (
          <div className="space-y-4" data-testid="passkey-connected">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Passkey Smart Account Connected
              </p>
              <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-[#09090b]/60 px-3 py-2">
                <CryptoId value={connected.address} head={8} tail={6} className="text-white" />
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(connected.address);
                    toast.success('Smart account address copied.');
                  }}
                  className="rounded-md bg-[#27272a] px-2 py-1 text-[10px] text-[#a1a1aa] hover:text-white"
                >
                  Copy
                </button>
              </div>
              <p className="mt-2 text-[11px] text-emerald-200/80">
                Signed in as {connected.label}. Escrow actions are authorised by the passkey in this device,
                with no seed phrase stored by TrustPay.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:from-emerald-500 hover:to-teal-500"
            >
              Continue →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <ol className="space-y-2 text-[11px] leading-relaxed text-[#a1a1aa]">
              <li className="flex gap-2">
                <span className="font-bold text-emerald-400">1.</span>
                Your device creates a secp256r1 passkey protected by biometrics.
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-400">2.</span>
                TrustPay derives a Soroban smart-account address (`C...`) from the public key.
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-400">3.</span>
                Escrow approvals are signed with a WebAuthn assertion — never a seed phrase.
              </li>
            </ol>

            {error && (
              <p role="alert" data-testid="passkey-error" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                {error}
              </p>
            )}

            {stored ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-[#3f3f46] bg-[#232326] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#a1a1aa]">Saved passkey</p>
                  <p className="mt-1 text-sm font-bold text-white">{stored.label}</p>
                  <CryptoId value={stored.accountAddress} head={10} tail={6} className="mt-1 text-[11px] text-[#a1a1aa]" />
                </div>
                <button
                  type="button"
                  data-testid="passkey-sign-in"
                  onClick={handleSignIn}
                  disabled={busy}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60"
                >
                  {state === 'signing' ? 'Waiting for biometrics…' : 'Sign in with passkey 🔐'}
                </button>
                <button
                  type="button"
                  onClick={handleUseAnother}
                  disabled={busy}
                  className="w-full text-[11px] font-medium text-[#71717a] transition-colors hover:text-[#a1a1aa] disabled:opacity-50"
                >
                  Use a different passkey
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <label htmlFor={nameId} className="block text-[11px] font-bold uppercase tracking-wider text-[#e4e4e7]">
                  Display name
                </label>
                <input
                  id={nameId}
                  data-testid="passkey-display-name"
                  value={userName}
                  onChange={(event) => setUserName(event.target.value)}
                  placeholder="e.g. Ada Lovelace"
                  maxLength={64}
                  disabled={busy}
                  className="w-full rounded-xl border border-[#3f3f46] bg-[#232326] px-4 py-3 text-sm text-white placeholder-[#71717a] transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
                />
                <button
                  type="button"
                  data-testid="passkey-register"
                  onClick={handleRegister}
                  disabled={busy}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60"
                >
                  {state === 'registering' ? 'Waiting for biometrics…' : 'Create passkey wallet'}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onFallback?.();
              }}
              className="w-full border-t border-[#27272a] pt-3 text-[11px] font-medium text-[#71717a] transition-colors hover:text-[#a1a1aa]"
            >
              Use an extension wallet instead
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document === 'undefined' ? modal : createPortal(modal, document.body);
}

export default PasskeyWalletModal;
