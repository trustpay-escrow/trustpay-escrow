'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  getAllAdapters,
  WalletAdapter,
  SupportedWalletId,
  getWalletAdapter,
} from '@/lib/wallet-adapters';

export interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectWallet: (adapter: WalletAdapter) => Promise<void>;
  onManualConnect?: (pubkey: string) => Promise<void>;
  isConnecting?: boolean;
}

export function WalletConnectModal({
  isOpen,
  onClose,
  onConnectWallet,
  onManualConnect,
  isConnecting = false,
}: WalletConnectModalProps) {
  const [activeTab, setActiveTab] = useState<'extensions' | 'mobile' | 'manual'>('extensions');
  const [installedMap, setInstalledMap] = useState<Record<string, boolean>>({});
  const [selectedMobileWallet, setSelectedMobileWallet] = useState<SupportedWalletId>('lobstr');
  const [manualKey, setManualKey] = useState('');
  const [connectingWalletId, setConnectingWalletId] = useState<string | null>(null);

  const adapters = getAllAdapters();

  // Check which extension wallets are installed in current browser
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function checkInstalled() {
      const results: Record<string, boolean> = {};
      for (const adapter of adapters) {
        try {
          results[adapter.id] = await adapter.isInstalled();
        } catch {
          results[adapter.id] = false;
        }
      }
      if (mounted) {
        setInstalledMap(results);
      }
    }

    checkInstalled();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectAdapter = async (adapter: WalletAdapter) => {
    setConnectingWalletId(adapter.id);
    try {
      await onConnectWallet(adapter);
      onClose();
    } catch (err: any) {
      toast.error(err.message || `Failed to connect ${adapter.name}`);
    } finally {
      setConnectingWalletId(null);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualKey.trim();
    if (!trimmed) {
      toast.error('Please enter a Stellar public key (starts with G)');
      return;
    }
    if (!/^G[A-Z2-7]{55}$/.test(trimmed)) {
      toast.error('Invalid Stellar public key format. Must start with G and be 56 characters.');
      return;
    }

    if (onManualConnect) {
      try {
        await onManualConnect(trimmed);
        onClose();
      } catch (err: any) {
        toast.error(err.message || 'Failed to connect manual key');
      }
    }
  };

  const mobileAdapters = adapters.filter((a) => a.supportsQr || a.type === 'mobile' || a.id === 'albedo');
  const extensionAdapters = adapters.filter((a) => a.type === 'extension' || a.id === 'albedo');

  const activeMobileAdapter = getWalletAdapter(selectedMobileWallet);
  const qrPairingUrl =
    selectedMobileWallet === 'lobstr'
      ? 'web+stellar:connect?session=' + Date.now().toString(36)
      : 'https://albedo.link/intent/public_key';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fadeIn"
    >
      <div className="bg-[#18181b] border border-[#333338] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto">
        {/* Glow Effects */}
        <div className="absolute -top-12 -right-12 w-44 h-44 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md text-lg">
              🪐
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-white tracking-tight">
                Connect Stellar Wallet
              </h3>
              <p className="text-xs text-[#a1a1aa]">
                Multi-wallet hub for Soroban escrow transactions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#27272a] hover:bg-[#3f3f46] text-[#a1a1aa] hover:text-white flex items-center justify-center text-sm transition-colors cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex p-1 bg-[#121214] border border-[#27272a] rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('extensions')}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'extensions'
                ? 'bg-[#27272a] text-white shadow-sm'
                : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            🧩 Extensions & Web
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mobile')}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'mobile'
                ? 'bg-[#27272a] text-white shadow-sm'
                : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            📱 Mobile QR Code
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-[#27272a] text-white shadow-sm'
                : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            🔑 Public Key
          </button>
        </div>

        {/* TAB 1: BROWSER EXTENSIONS & WEB */}
        {activeTab === 'extensions' && (
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {extensionAdapters.map((adapter) => {
              const isInstalled = installedMap[adapter.id];
              const isLoading = connectingWalletId === adapter.id || isConnecting;

              return (
                <button
                  key={adapter.id}
                  type="button"
                  onClick={() => handleSelectAdapter(adapter)}
                  disabled={isLoading}
                  className="w-full p-3.5 rounded-2xl bg-[#232326] hover:bg-[#2a2a30] border border-[#333338] hover:border-blue-500/50 text-white font-bold transition-all text-left flex items-center justify-between group cursor-pointer disabled:opacity-60"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-[#3f3f46] flex items-center justify-center text-xl shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      {adapter.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                          {adapter.name}
                        </span>
                        {isInstalled && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Detected ✓
                          </span>
                        )}
                        {adapter.badge && !isInstalled && (
                          <span className="hidden sm:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {adapter.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#a1a1aa] font-normal truncate mt-0.5">
                        {adapter.tagline}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    <span className="text-xs font-bold text-blue-400 group-hover:translate-x-0.5 transition-transform inline-block">
                      {isLoading ? 'Connecting...' : 'Connect →'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* TAB 2: MOBILE & QR CODE PAIRING */}
        {activeTab === 'mobile' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {mobileAdapters.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMobileWallet(m.id)}
                  className={`flex-1 p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    selectedMobileWallet === m.id
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-[#232326] border-[#333338] text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  <span>{m.icon}</span>
                  <span>{m.name}</span>
                </button>
              ))}
            </div>

            {/* Simulated QR Pairing Canvas */}
            <div className="p-6 bg-[#121214] rounded-2xl border border-[#27272a] flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-44 h-44 bg-white p-3 rounded-2xl shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
                {/* SVG QR Code Pattern */}
                <svg
                  viewBox="0 0 100 100"
                  className="w-full h-full text-black fill-current"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect x="0" y="0" width="30" height="30" fill="black" />
                  <rect x="5" y="5" width="20" height="20" fill="white" />
                  <rect x="10" y="10" width="10" height="10" fill="black" />

                  <rect x="70" y="0" width="30" height="30" fill="black" />
                  <rect x="75" y="5" width="20" height="20" fill="white" />
                  <rect x="80" y="10" width="10" height="10" fill="black" />

                  <rect x="0" y="70" width="30" height="30" fill="black" />
                  <rect x="5" y="75" width="20" height="20" fill="white" />
                  <rect x="10" y="80" width="10" height="10" fill="black" />

                  {/* QR Matrix Blocks */}
                  <rect x="35" y="10" width="8" height="8" fill="black" />
                  <rect x="50" y="10" width="8" height="8" fill="black" />
                  <rect x="40" y="25" width="12" height="6" fill="black" />
                  <rect x="10" y="40" width="6" height="15" fill="black" />
                  <rect x="25" y="45" width="8" height="8" fill="black" />
                  <rect x="45" y="45" width="10" height="10" fill="black" />
                  <rect x="65" y="40" width="8" height="18" fill="black" />
                  <rect x="85" y="45" width="6" height="8" fill="black" />
                  <rect x="35" y="70" width="15" height="8" fill="black" />
                  <rect x="55" y="75" width="8" height="15" fill="black" />
                  <rect x="70" y="75" width="15" height="6" fill="black" />
                </svg>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-bold text-white">
                  Scan with {activeMobileAdapter.name} Mobile App
                </p>
                <p className="text-[11px] text-[#a1a1aa] max-w-xs">
                  Open the camera or QR scanner in your {activeMobileAdapter.name} wallet to approve
                  pairing.
                </p>
              </div>

              <div className="pt-2 w-full flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(qrPairingUrl);
                    toast.success('Pairing deep-link copied to clipboard!');
                  }}
                  className="flex-1 py-2 px-3 bg-[#232326] hover:bg-[#2a2a30] text-xs font-semibold text-[#e4e4e7] rounded-xl border border-[#333338] transition-colors cursor-pointer"
                >
                  📋 Copy Pairing URI
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAdapter(activeMobileAdapter)}
                  className="flex-1 py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Launch Web Intent ↗
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MANUAL PUBLIC KEY */}
        {activeTab === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#e4e4e7] uppercase tracking-wider">
                Stellar Public Key (Ed25519)
              </label>
              <input
                type="text"
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value.trim())}
                placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="w-full px-4 py-3 bg-[#232326] border border-[#333338] rounded-xl text-white font-mono text-xs placeholder-[#71717a] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              <p className="text-[11px] text-[#a1a1aa]">
                Paste your Stellar G... address from Lobstr, Hana, or any hardware wallet.
              </p>
            </div>

            <button
              type="submit"
              disabled={isConnecting || !manualKey.trim()}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isConnecting ? 'Verifying Key...' : 'Connect Public Key →'}
            </button>
          </form>
        )}

        {/* Footer Info */}
        <div className="pt-3 border-t border-[#27272a] flex items-center justify-between text-[11px] text-[#71717a]">
          <span>Protected by Stellar SEP-0010 Web Auth</span>
          <span>Non-custodial Escrow</span>
        </div>
      </div>
    </div>
  );
}

export default WalletConnectModal;
