'use client';

import { useState, useEffect } from 'react';
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
  } = useWalletStore();

  const [isConnecting, setIsConnecting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [tempAddress, setTempAddress] = useState('');
  const [tempWalletName, setTempWalletName] = useState('Freighter');
  const [tempWalletType, setTempWalletType] = useState<SupportedWalletId>('freighter');
  const [tempSignedXdr, setTempSignedXdr] = useState('');
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Restore connection or verify existing session on page refresh
  useEffect(() => {
    if (address && walletType) {
      // Session restored from localStorage persistence
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
      const data = await verifyRes.json();

      if (verifyRes.status === 403 && data.requiresRegistration) {
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
      <div className="bg-[#18181b] border border-[#3f3f46] rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto animate-fadeIn">
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

          <h3 className="text-2xl font-extrabold text-white tracking-tight">
            Welcome to TrustPay
          </h3>

          <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed px-2">
            First time connecting with this Stellar wallet? Please enter your email to receive
            milestone and escrow notifications.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#e4e4e7] uppercase tracking-wider">
            Email Address
          </label>
          <input
            type="email"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            placeholder="name@example.com"
            className="w-full px-4 py-3.5 bg-[#232326] border border-[#3f3f46] rounded-xl text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-[#27272a]">
          <button
            type="button"
            onClick={() => {
              setShowEmailModal(false);
              setIsConnecting(false);
            }}
            className="flex-1 py-3.5 px-4 bg-[#27272a] hover:bg-[#3f3f46] text-white font-bold text-xs sm:text-sm rounded-xl border border-[#3f3f46] transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleEmailSubmit}
            disabled={isConnecting}
            className="flex-1 py-3.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-600/30 border border-blue-500/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {isConnecting ? 'Registering...' : 'Complete Setup 🚀'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-col items-center gap-5 p-6 sm:p-8 rounded-3xl border border-[#27272a] shadow-2xl bg-[#18181b]/95 backdrop-blur-2xl max-w-lg w-full mx-auto relative overflow-hidden group/card">
      {/* Background Glow */}
      <div className="absolute -top-16 -right-16 w-52 h-52 bg-blue-500/15 rounded-full blur-3xl pointer-events-none group-hover/card:bg-blue-500/25 transition-all duration-500" />
      <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-purple-500/15 rounded-full blur-3xl pointer-events-none group-hover/card:bg-purple-500/25 transition-all duration-500" />

      {/* Header Icon */}
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-blue-500/20 transform transition-transform group-hover/card:scale-105 duration-300">
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
            d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3"
          />
        </svg>
      </div>

      {/* Card Info */}
      <div className="text-center z-10 space-y-1.5 w-full">
        <h3 className="text-2xl font-extrabold text-white tracking-tight">
          Connect Stellar Wallet
        </h3>
        <p className="text-xs sm:text-sm text-[#a1a1aa] font-medium leading-relaxed">
          {address
            ? `Authenticated via ${walletName || 'Stellar Wallet'}.`
            : 'Select Freighter, Lobstr, xBull, Hana, or Albedo to access your escrow portal.'}
        </p>
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
            <span className="font-mono text-xs text-white tracking-wide truncate">
              {address.slice(0, 8)}...{address.slice(-8)}
            </span>
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
              className="p-3 bg-[#232326] hover:bg-[#2a2a30] border border-[#333338] hover:border-blue-500/50 rounded-xl text-left transition-all cursor-pointer group"
            >
              <div className="text-lg mb-1">🪐</div>
              <div className="text-xs font-bold text-white group-hover:text-blue-400">Freighter</div>
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
              onClick={() => handleConnectAdapter(getWalletAdapter('xbull'))}
              disabled={isConnecting}
              className="p-3 bg-[#232326] hover:bg-[#2a2a30] border border-[#333338] hover:border-amber-500/50 rounded-xl text-left transition-all cursor-pointer group"
            >
              <div className="text-lg mb-1">🐂</div>
              <div className="text-xs font-bold text-white group-hover:text-amber-400">xBull</div>
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
    </div>
  );
}
