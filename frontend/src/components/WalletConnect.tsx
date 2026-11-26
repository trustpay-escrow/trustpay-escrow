'use client';

import { useState, useEffect, useId, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useWalletStore } from '@/store/walletStore';
import { useRouter } from 'next/navigation';
import {
  WalletAdapter,
  SupportedWalletId,
  getWalletAdapter,
  signWithWallet,
} from '@/lib/wallet-adapters';
import { WalletConnectModal } from '@/components/WalletConnectModal';
import { CryptoId } from '@/components/ui/CryptoId';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useWalletEventListener } from '@/hooks/useWalletEventListener';

export function WalletAddressCopy({ address, header = false }: { address: string; header?: boolean }) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const copied = !!address && copiedAddress === address;
  const [addressHovered, setAddressHovered] = useState(false);
  const [addressFocused, setAddressFocused] = useState(false);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const addressTooltipId = useId();
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyAttempt = useRef(0);
  const showAddressTooltip = (addressHovered || addressFocused) && !tooltipDismissed;

  const resetCopyFeedback = useCallback(() => {
    copyAttempt.current++;
    if (copyResetTimer.current !== null) clearTimeout(copyResetTimer.current);
    setCopiedAddress(null);
  }, []);

  useEffect(() => resetCopyFeedback, [address, resetCopyFeedback]);

  useEffect(() => {
    if (!showAddressTooltip) return;
    const dismissTooltip = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        resetCopyFeedback();
        setTooltipDismissed(true);
      }
    };
    document.addEventListener('keydown', dismissTooltip);
    return () => document.removeEventListener('keydown', dismissTooltip);
  }, [showAddressTooltip, resetCopyFeedback]);

  const copyAddress = async () => {
    if (!address) return;
    const attempt = ++copyAttempt.current;
    if (copyResetTimer.current !== null) clearTimeout(copyResetTimer.current);
    setCopiedAddress(null);
    try {
      await navigator.clipboard.writeText(address);
      if (attempt !== copyAttempt.current) return;
      if (copyResetTimer.current !== null) clearTimeout(copyResetTimer.current);
      setCopiedAddress(address);
      setTooltipDismissed(false);
      toast.success('Stellar address copied to clipboard!');
      copyResetTimer.current = setTimeout(() => {
        setCopiedAddress(null);
        setTooltipDismissed(true);
      }, 2000);
    } catch {
      if (attempt !== copyAttempt.current) return;
      toast.error('Unable to copy address. Please try again.');
    }
  };

  return (
    <div
      className={header ? 'relative shrink-0 max-w-full' : 'relative w-full'}
      onMouseEnter={() => {
        setAddressHovered(true);
        setTooltipDismissed(false);
      }}
      onMouseLeave={() => {
        setAddressHovered(false);
        resetCopyFeedback();
      }}
      onPointerDown={() => setAddressFocused(false)}
      onFocus={(event) => {
        setAddressFocused(event.target.matches(':focus-visible'));
        setTooltipDismissed(false);
      }}
      onBlur={() => {
        setAddressFocused(false);
        resetCopyFeedback();
      }}
    >
      <button
        type="button"
        onClick={copyAddress}
        aria-label="Copy full Stellar address"
        aria-describedby={showAddressTooltip ? addressTooltipId : undefined}
        className={
          header
            ? 'inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-md border border-[#3f3f46] bg-[#27272a] px-2.5 py-1 text-white cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400'
            : 'flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border border-[#3f3f46] bg-[#18181b] px-3.5 py-2 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400'
        }
      >
        <CryptoId value={address} head={header ? 6 : 8} tail={header ? 4 : 8} title="" className="text-white truncate" />
        <span className={header ? 'shrink-0 text-[#a1a1aa]' : 'flex shrink-0 items-center gap-1 rounded-md bg-[#27272a] px-2 py-1 text-xs text-[#a1a1aa]'}>
          <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-3.5 w-3.5">
            <rect x="8" y="8" width="12" height="12" rx="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
          </svg>
          {!header && (copied ? 'Copied! ✓' : 'Copy')}
        </span>
      </button>
      {showAddressTooltip && (
        <div
          id={addressTooltipId}
          role="tooltip"
          className={header ? 'absolute top-full left-0 z-20 w-full pt-2' : 'absolute bottom-full left-1/2 z-20 w-max max-w-full -translate-x-1/2 pb-2'}
        >
          <span className="block rounded-md border border-[#3f3f46] bg-[#18181b] px-3 py-2 text-center text-xs text-white shadow-lg">
            {copied ? 'Copied!' : 'Click to copy full Stellar address'}
          </span>
        </div>
      )}
      <span role="status" className="sr-only">
        {copied ? 'Stellar address copied to clipboard.' : ''}
      </span>
    </div>
  );
}

const getErrorMessage = (err: any, prefix = ''): string => {
  let msg = 'An unknown error occurred';
  if (typeof err === 'string') {
    try {
      const parsed = JSON.parse(err);
      msg = parsed?.message || err;
    } catch {
      msg = err;
    }
  } else {
    msg = err?.message || JSON.stringify(err);
  }
  return prefix ? `${prefix}: ${msg}` : msg;
};

// Stellar Ed25519 Public Key regex (starts with G, 56 chars base32)
const STELLAR_PUBKEY_REGEX = /^G[A-Z2-7]{55}$/;

export default function WalletConnect() {
  const {
    address,
    activeRole,
    walletName,
    walletType,
    setWalletInfo,
    disconnect,
    isConnecting: storeIsConnecting,
    setIsConnecting: setStoreIsConnecting,
  } = useWalletStore();

  useWalletEventListener();

  const [isConnecting, setIsConnectingState] = useState(false);
  const setIsConnecting = (val: boolean) => {
    setIsConnectingState(val);
    setStoreIsConnecting?.(val);
  };

  const [showModal, setShowModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showXBullModal, setShowXBullModal] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [tempAddress, setTempAddress] = useState('');
  const [tempWalletName, setTempWalletName] = useState('Freighter');
  const [tempWalletType, setTempWalletType] = useState<SupportedWalletId>('freighter');
  const [tempSignedXdr, setTempSignedXdr] = useState('');
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  const emailDialogRef = useFocusTrap<HTMLDivElement>({
    active: showEmailModal,
    onEscape: () => {
      setShowEmailModal(false);
      setIsConnecting(false);
    },
  });

  const xBullDialogRef = useFocusTrap<HTMLDivElement>({
    active: showXBullModal,
    onEscape: () => setShowXBullModal(false),
  });

  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Restore connection or verify existing session on page refresh
  useEffect(() => {
    if (address && walletType) {
      console.log(`Active session restored for ${address} (${walletName || walletType})`);
    }
  }, [address, walletType, walletName]);

  // Unified cryptographic SEP-0010 Web Auth login handler
  const finishWalletLogin = async (
    userAddress: string,
    selectedWalletName: string,
    customSigner?: (challengeXdr: string) => Promise<string>,
    selectedWalletType: SupportedWalletId = 'freighter'
  ) => {
    if (!STELLAR_PUBKEY_REGEX.test(userAddress)) {
      toast.error("Invalid Stellar public key format. Must start with 'G' and be 56 characters.");
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      toast.info('Requesting SEP-0010 authentication challenge...');

      // 1. Fetch challenge XDR from backend
      const challengeRes = await fetch(`${apiUrl}/api/auth/challenge?account=${userAddress}`);
      if (!challengeRes.ok) {
        const errData = await challengeRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to retrieve authentication challenge');
      }
      const { transaction: challengeXdr, network } = await challengeRes.json();

      let signedXdr = challengeXdr;

      // 2. Prompt wallet for cryptographic signature
      if (customSigner) {
        toast.info(`Please sign the challenge in ${selectedWalletName}...`);
        signedXdr = await customSigner(challengeXdr);
      } else {
        toast.info(`Please sign the challenge in ${selectedWalletName}...`);
        signedXdr = await signWithWallet(selectedWalletType, challengeXdr, {
          networkPassphrase:
            network === 'PUBLIC'
              ? 'Public Global Stellar Network ; September 2015'
              : 'Test SDF Network ; September 2015',
        });
      }

      // 3. Submit signed challenge to /api/auth/verify
      toast.info('Verifying cryptographic signature on backend...');
      const verifyRes = await fetch(`${apiUrl}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ transaction: signedXdr }),
      });
      const data = await verifyRes.json().catch(() => ({}));

      if (verifyRes.status === 404 && data.requiresRegistration) {
        setTempAddress(userAddress);
        setTempWalletName(selectedWalletName);
        setTempWalletType(selectedWalletType);
        setTempSignedXdr(signedXdr);
        setShowEmailModal(true);
      } else if (verifyRes.ok) {
        setWalletInfo(userAddress, true, true, selectedWalletName, data.token, selectedWalletType);
        toast.success(`Cryptographically verified via SEP-0010! Connected via ${selectedWalletName}.`);
        setShowModal(false);
      } else {
        toast.error(data.error || 'Failed to verify authentication signature');
      }
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Authentication Error'));
      console.error('Wallet connect error:', e);
    }
  };

  const handleConnectAdapter = async (adapter: WalletAdapter) => {
    setIsConnecting(true);
    try {
      const conn = await adapter.connect();
      if (!conn || !conn.address) {
        throw new Error(`${adapter.name} connection was not authorized.`);
      }

      await finishWalletLogin(
        conn.address,
        adapter.name,
        async (xdr) => {
          return await adapter.signTransaction(xdr);
        },
        adapter.id
      );
    } catch (err: any) {
      toast.error(getErrorMessage(err, `${adapter.name} Error`));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleManualConnect = async (pubkey: string) => {
    setIsConnecting(true);
    try {
      await finishWalletLogin(pubkey, 'Manual / Custom Key', undefined, 'manual');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!emailValue.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsConnecting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const apiRes = await fetch(`${apiUrl}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ transaction: tempSignedXdr, email: emailValue }),
      });

      const data = await apiRes.json();
      if (apiRes.ok) {
        setWalletInfo(tempAddress, true, true, tempWalletName, data.token, tempWalletType);
        setShowEmailModal(false);
        toast.success(`Registration complete! Connected via ${tempWalletName}.`);
        setShowModal(false);
        router.push('/projects');
      } else {
        toast.error(data.error || 'Failed to register user');
      }
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Registration error'));
    } finally {
      setIsConnecting(false);
    }
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success('Stellar address copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Email registration modal for first-time connected users
  const emailModalContent = showEmailModal ? (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div
        ref={emailDialogRef}
        className="bg-[#18181b] border border-[#3f3f46] rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto animate-fadeIn"
      >
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.75}
              stroke="currentColor"
              className="w-7 h-7"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Complete Registration</h3>
            <p className="text-xs text-[#a1a1aa] mt-1 max-w-xs">
              This Stellar public key is newly connected. Please add your email address to register.
            </p>
          </div>
        </div>

        <div className="bg-[#121214] p-3.5 rounded-2xl border border-[#27272a] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a1a1aa]">Wallet:</span>
            <span className="text-white font-semibold">{tempWalletName}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a1a1aa]">Address:</span>
            <span className="font-mono text-[11px] text-[#71717a] truncate max-w-[210px]">
              {tempAddress}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a1a1aa]">Auth:</span>
            <span className="text-emerald-400 font-medium">SEP-0010 Signature Verified ✓</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#e4e4e7] mb-2">
              Email Address <span className="text-blue-400">*</span>
            </label>
            <input
              type="email"
              placeholder="developer@example.com"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              className="w-full px-4 py-3 bg-[#121214] border border-[#27272a] rounded-xl text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-blue-500 transition-colors"
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowEmailModal(false);
                setIsConnecting(false);
              }}
              className="flex-1 py-3 px-4 bg-[#27272a] hover:bg-[#3f3f46] text-[#a1a1aa] hover:text-white font-bold text-xs rounded-xl border border-[#3f3f46] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEmailSubmit}
              disabled={isConnecting || !emailValue.trim()}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              {isConnecting ? 'Registering...' : 'Confirm & Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        {/* Stellar Network Indicator Badge */}
        <span className="text-[11px] font-bold px-2.5 py-1 bg-[#1c1917] text-[#fdba74] rounded-full border border-[#442c1d] flex items-center gap-1.5 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          Stellar Testnet
        </span>
      </div>

      {/* Connected State View */}
      {address ? (
        <div className="w-full mt-2 p-4 rounded-2xl bg-[#232326] border border-[#333338] flex flex-col items-center gap-3 transition-all z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {walletName || 'Stellar Wallet'} Connected
            </span>
          </div>

          <div className="flex items-center gap-2 bg-[#18181b] px-3.5 py-2 rounded-xl border border-[#3f3f46] w-full justify-between">
            <CryptoId value={address} head={8} tail={8} className="text-white truncate" />
            <button
              type="button"
              onClick={copyAddress}
              className="text-xs text-[#a1a1aa] hover:text-white transition-colors px-2 py-1 bg-[#27272a] rounded-md cursor-pointer"
            >
              {copied ? 'Copied! ✓' : 'Copy'}
            </button>
          </div>

          <span className="text-xs font-bold px-3 py-1 bg-[#052e16] text-[#22c55e] rounded-full border border-[#14532d]">
            Multi-Role Active ({activeRole})
          </span>

          <div className="w-full pt-2 flex gap-2">
            <button
              type="button"
              onClick={() => router.push('/projects')}
              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              Go to Projects →
            </button>
            <button
              type="button"
              onClick={() => disconnect()}
              className="py-2.5 px-4 bg-[#27272a] hover:bg-[#3f3f46] text-red-400 hover:text-red-300 font-bold text-xs rounded-xl border border-[#3f3f46] transition-all cursor-pointer"
            >
              Disconnect / Switch
            </button>
          </div>
        </div>
      ) : (
        /* Multi-Wallet Selection Trigger & Quick Connect */
        <div className="w-full flex flex-col gap-2.5 mt-1 z-10">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-blue-600/25 border border-blue-500/30 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span>🪐</span>
              <span>Open Multi-Wallet Hub</span>
            </span>
            <span className="text-xs opacity-90">Freighter, Lobstr, xBull & more →</span>
          </button>

          {/* Quick Connect Direct Options */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleConnectAdapter(getWalletAdapter('freighter'))}
              disabled={isConnecting}
              data-testid="connect-freighter-button"
              className="p-3 bg-[#232326] hover:bg-[#2a2a30] border border-[#333338] hover:border-blue-500/50 rounded-xl text-left transition-all cursor-pointer group"
            >
              <div className="text-lg mb-1">
                {isConnecting ? (
                  <svg
                    className="animate-spin w-5 h-5 text-blue-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    data-testid="wallet-spinner"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  '🪐'
                )}
              </div>
              <div className="text-xs font-bold text-white group-hover:text-blue-400">
                {isConnecting ? 'Waiting for Wallet...' : 'Connect Freighter Wallet →'}
              </div>
              <div className="text-[10px] text-[#a1a1aa]">Browser extension</div>
            </button>

            <button
              type="button"
              onClick={() => handleConnectAdapter(getWalletAdapter('albedo'))}
              disabled={isConnecting}
              className="p-3 bg-[#232326] hover:bg-[#2a2a30] border border-[#333338] hover:border-emerald-500/50 rounded-xl text-left transition-all cursor-pointer group"
            >
              <div className="text-lg mb-1">⚡</div>
              <div className="text-xs font-bold text-white group-hover:text-emerald-400">Albedo</div>
              <div className="text-[10px] text-[#a1a1aa]">Instant Web Intent</div>
            </button>

            <button
              type="button"
              onClick={() => setShowXBullModal(true)}
              disabled={isConnecting}
              className="p-3 bg-[#232326] hover:bg-[#2a2a30] border border-[#333338] hover:border-amber-500/50 rounded-xl text-left transition-all cursor-pointer group"
            >
              <div className="text-lg mb-1">🐂</div>
              <div className="text-xs font-bold text-white group-hover:text-amber-400">xBull Wallet</div>
              <div className="text-[10px] text-[#a1a1aa]">Extension & Web</div>
            </button>

            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="p-3 bg-[#232326] hover:bg-[#2a2a30] border border-[#333338] hover:border-purple-500/50 rounded-xl text-left transition-all cursor-pointer group"
            >
              <div className="text-lg mb-1">🦞</div>
              <div className="text-xs font-bold text-white group-hover:text-purple-400">Lobstr & QR</div>
              <div className="text-[10px] text-[#a1a1aa]">Mobile scan connect</div>
            </button>
          </div>
        </div>
      )}

      {/* Multi-Wallet Modal Dialog */}
      <WalletConnectModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConnectWallet={handleConnectAdapter}
        onManualConnect={handleManualConnect}
        isConnecting={isConnecting}
      />

      {/* Email Registration Portal */}
      {mounted && emailModalContent && createPortal(emailModalContent, document.body)}

      {/* xBull Wallet Modal Portal */}
      {mounted &&
        showXBullModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div
              ref={xBullDialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="xBull Wallet Options"
              tabIndex={-1}
              className="bg-[#18181b] border border-[#3f3f46] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl focus:outline-none"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">xBull Wallet Options</h3>
                <button
                  type="button"
                  onClick={() => setShowXBullModal(false)}
                  aria-label="Close xBull options"
                  className="text-[#a1a1aa] hover:text-white px-2 py-1"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-[#a1a1aa]">
                Connect with the xBull browser extension or open the web wallet.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowXBullModal(false);
                    void handleConnectAdapter(getWalletAdapter('xbull'));
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                >
                  Connect xBull Extension
                </button>
                <button
                  type="button"
                  onClick={() => setShowXBullModal(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
