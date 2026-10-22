"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { isConnected, requestAccess, getNetworkDetails, setAllowed } from "@stellar/freighter-api";
import { toast } from "sonner";
import { useWalletStore } from "@/store/walletStore";
import { useRouter } from "next/navigation";

const getErrorMessage = (err: any, prefix = ""): string => {
  let msg = "An unknown error occurred";
  if (typeof err === "string") {
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

type WalletType = "freighter" | "xbull" | "albedo" | "rabet" | "manual";

interface WalletOption {
  id: WalletType;
  name: string;
  tagline: string;
  badge?: string;
  badgeColor?: string;
}

export default function WalletConnect() {
  const { address, activeRole, walletName, setWalletInfo, disconnect } = useWalletStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<WalletType | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showXBullModal, setShowXBullModal] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [tempAddress, setTempAddress] = useState("");
  const [tempWalletName, setTempWalletName] = useState("Freighter");
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // If already connected, redirect to projects portal
    if (address) {
      router.push("/projects");
    }
  }, [address, router]);

  // Unified login handler for any Stellar wallet address
  const finishWalletLogin = async (userAddress: string, selectedWallet: string) => {
    if (!STELLAR_PUBKEY_REGEX.test(userAddress)) {
      toast.error("Invalid Stellar public key format. Must start with 'G' and be 56 characters.");
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const apiRes = await fetch(`${apiUrl}/api/users/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stellar_address: userAddress })
      });
      const data = await apiRes.json();

      if (apiRes.status === 403 && data.requiresRegistration) {
        setTempAddress(userAddress);
        setTempWalletName(selectedWallet);
        setShowEmailModal(true);
      } else if (apiRes.ok) {
        setWalletInfo(userAddress, true, true, selectedWallet);
        toast.success(`Connected via ${selectedWallet}! Multi-role session active.`);
        router.push("/projects");
      } else {
        toast.error(data.error || "Failed to connect user on backend");
      }
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Backend error"));
      console.error("Backend error:", e);
    }
  };

  // 1. Freighter Wallet
  const connectFreighter = async () => {
    setIsConnecting(true);
    setConnectingWallet("freighter");
    try {
      if (await isConnected()) {
        try {
          const networkDetails = await getNetworkDetails();
          if (networkDetails.network !== "TESTNET" && networkDetails.network !== "PUBLIC") {
            toast.error("Please open Freighter, click the gear icon, and switch your network to Testnet or Mainnet.");
            return;
          }

          await setAllowed();
          const response = await requestAccess();
          if (response.error) {
            toast.error(getErrorMessage(response.error));
          } else if (response.address) {
            await finishWalletLogin(response.address, "Freighter");
          }
        } catch (error: any) {
          toast.error(getErrorMessage(error));
        }
      } else {
        toast.error("Freighter wallet not installed. Please install the Freighter browser extension or select another wallet.");
      }
    } finally {
      setIsConnecting(false);
      setConnectingWallet(null);
    }
  };

  // 2. xBull Wallet
  const connectXBull = async () => {
    setIsConnecting(true);
    setConnectingWallet("xbull");
    try {
      if (typeof window !== "undefined" && (window as any).xBullSDK) {
        const xBull = (window as any).xBullSDK;
        const pubKey = await xBull.getPublicKey();
        if (pubKey) {
          await finishWalletLogin(pubKey, "xBull Wallet");
        } else {
          toast.error("xBull did not return a public key.");
        }
      } else {
        // xBull extension not detected - display friendly options modal
        setShowXBullModal(true);
      }
    } catch (error: any) {
      toast.error(getErrorMessage(error, "xBull Connection Error"));
    } finally {
      setIsConnecting(false);
      setConnectingWallet(null);
    }
  };

  // 3. Albedo Web Intent (No extension needed, works anywhere)
  const connectAlbedo = async () => {
    setIsConnecting(true);
    setConnectingWallet("albedo");

    try {
      const width = 450;
      const height = 660;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        "https://albedo.link/intent/public_key",
        "albedo-intent",
        `width=${width},height=${height},left=${left},top=${top},status=0,menubar=0,toolbar=0`
      );

      if (!popup) {
        toast.error("Popup was blocked by your browser. Please allow popups for Albedo authentication.");
        setIsConnecting(false);
        setConnectingWallet(null);
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            window.removeEventListener("message", messageHandler);
            reject(new Error("Albedo window closed without completing login"));
          }
        }, 800);

        const messageHandler = async (event: MessageEvent) => {
          if (event.origin !== "https://albedo.link") return;
          const data = event.data;
          if (data && data.pubkey) {
            clearInterval(timer);
            window.removeEventListener("message", messageHandler);
            try {
              popup.close();
            } catch {}
            await finishWalletLogin(data.pubkey, "Albedo");
            resolve();
          } else if (data && data.error) {
            clearInterval(timer);
            window.removeEventListener("message", messageHandler);
            try {
              popup.close();
            } catch {}
            reject(new Error(data.error.message || "Albedo authentication rejected"));
          }
        };

        window.addEventListener("message", messageHandler);
      });
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsConnecting(false);
      setConnectingWallet(null);
    }
  };

  // 4. Rabet Wallet
  const connectRabet = async () => {
    setIsConnecting(true);
    setConnectingWallet("rabet");
    try {
      if (typeof window !== "undefined" && (window as any).rabet) {
        const rabet = (window as any).rabet;
        const res = await rabet.connect();
        if (res && res.publicKey) {
          await finishWalletLogin(res.publicKey, "Rabet");
        } else {
          toast.error("Rabet connection was not authorized.");
        }
      } else {
        toast.error("Rabet wallet not installed. Please install the Rabet browser extension.");
      }
    } catch (error: any) {
      toast.error(getErrorMessage(error, "Rabet Error"));
    } finally {
      setIsConnecting(false);
      setConnectingWallet(null);
    }
  };

  // 5. Manual Stellar Public Key
  const handleManualConnect = async () => {
    const trimmed = manualAddress.trim();
    if (!trimmed) {
      toast.error("Please enter a Stellar public key");
      return;
    }
    if (!STELLAR_PUBKEY_REGEX.test(trimmed)) {
      toast.error("Invalid Stellar public key format. Must start with 'G' and have 56 characters.");
      return;
    }

    setIsConnecting(true);
    setConnectingWallet("manual");
    try {
      await finishWalletLogin(trimmed, "Manual / Custom Wallet");
    } finally {
      setIsConnecting(false);
      setConnectingWallet(null);
    }
  };

  const handleEmailSubmit = async () => {
    if (!emailValue.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsConnecting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const apiRes = await fetch(`${apiUrl}/api/users/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stellar_address: tempAddress, email: emailValue })
      });

      const data = await apiRes.json();
      if (apiRes.ok) {
        setWalletInfo(tempAddress, true, true, tempWalletName);
        setShowEmailModal(false);
        toast.success(`Registration complete! Connected via ${tempWalletName}.`);
        router.push("/projects");
      } else {
        toast.error(data.error || "Failed to register user");
      }
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Backend error"));
    } finally {
      setIsConnecting(false);
    }
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Stellar address copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Email registration modal for first-time connected users
  const emailModalContent = showEmailModal ? (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-[#18181b] border border-[#3f3f46] rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto animate-fadeIn">
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-blue-500/20 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>

          <h3 className="text-2xl font-extrabold text-white tracking-tight">
            Welcome to TrustPay
          </h3>

          <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed px-2">
            First time connecting with this Stellar wallet? Please enter your email to receive milestone and escrow notifications.
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
            {isConnecting ? "Registering..." : "Complete Setup 🚀"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // xBull Helper Modal when extension is not detected
  const xBullModalContent = showXBullModal ? (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-[#18181b] border border-[#3f3f46] rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto animate-fadeIn">
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-600 to-red-600 text-white flex items-center justify-center shadow-lg shadow-orange-500/25 text-2xl font-black">
            🐂
          </div>

          <h3 className="text-2xl font-extrabold text-white tracking-tight">
            xBull Wallet Options
          </h3>

          <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
            The xBull browser extension was not detected in this window. How would you like to connect?
          </p>
        </div>

        <div className="space-y-3">
          <a
            href="https://xbull.app/app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-xl bg-[#232326] hover:bg-[#2a2a2f] border border-[#3f3f46] text-white text-sm font-semibold transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🌐</span>
              <div className="text-left">
                <div>Open xBull Web App</div>
                <div className="text-xs text-[#a1a1aa] font-normal">Use xBull in your browser</div>
              </div>
            </div>
            <span className="text-[#a1a1aa] group-hover:text-white transition-colors">↗</span>
          </a>

          <a
            href="https://xbull.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-xl bg-[#232326] hover:bg-[#2a2a2f] border border-[#3f3f46] text-white text-sm font-semibold transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🧩</span>
              <div className="text-left">
                <div>Install xBull Extension</div>
                <div className="text-xs text-[#a1a1aa] font-normal">Chrome, Firefox, Brave, Edge</div>
              </div>
            </div>
            <span className="text-[#a1a1aa] group-hover:text-white transition-colors">↗</span>
          </a>

          <button
            type="button"
            onClick={() => {
              setShowXBullModal(false);
              setShowManualInput(true);
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-xl bg-[#232326] hover:bg-[#2a2a2f] border border-[#3f3f46] text-white text-sm font-semibold transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🔑</span>
              <div className="text-left">
                <div>Paste xBull Public Key</div>
                <div className="text-xs text-[#a1a1aa] font-normal">Fast manual connection</div>
              </div>
            </div>
            <span className="text-[#a1a1aa] group-hover:text-white transition-colors">→</span>
          </button>
        </div>

        <div className="pt-2 border-t border-[#27272a] flex justify-end">
          <button
            type="button"
            onClick={() => setShowXBullModal(false)}
            className="w-full py-3 px-4 bg-[#27272a] hover:bg-[#3f3f46] text-white font-bold text-xs sm:text-sm rounded-xl border border-[#3f3f46] transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-col items-center gap-5 p-6 sm:p-8 rounded-3xl border border-[#27272a] shadow-2xl bg-[#18181b]/95 backdrop-blur-2xl max-w-lg w-full mx-auto relative overflow-hidden group/card">
      {/* Background Glow */}
      <div className="absolute -top-16 -right-16 w-52 h-52 bg-blue-500/15 rounded-full blur-3xl pointer-events-none group-hover/card:bg-blue-500/25 transition-all duration-500"></div>
      <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-purple-500/15 rounded-full blur-3xl pointer-events-none group-hover/card:bg-purple-500/25 transition-all duration-500"></div>

      {/* Header Icon */}
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-blue-500/20 transform transition-transform group-hover/card:scale-105 duration-300">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
        </svg>
      </div>

      {/* Card Info */}
      <div className="text-center z-10 space-y-1.5 w-full">
        <h3 className="text-2xl font-extrabold text-white tracking-tight">
          Connect Stellar Wallet
        </h3>
        <p className="text-xs sm:text-sm text-[#a1a1aa] font-medium leading-relaxed">
          {address
            ? `Authenticated via ${walletName || "Stellar Wallet"}.`
            : "Select any Stellar-supported wallet below to access your escrow portal."}
        </p>
      </div>

      {/* Connected State View */}
      {address ? (
        <div className="w-full mt-2 p-4 rounded-2xl bg-[#232326] border border-[#333338] flex flex-col items-center gap-3 transition-all z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {walletName || "Stellar Wallet"} Connected
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
              {copied ? "Copied! ✓" : "Copy"}
            </button>
          </div>

          <span className="text-xs font-bold px-3 py-1 bg-[#052e16] text-[#22c55e] rounded-full border border-[#14532d]">
            Multi-Role Active ({activeRole})
          </span>

          <div className="w-full pt-2 flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/projects")}
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
        /* Multi-Wallet Selection Options */
        <div className="w-full flex flex-col gap-2.5 mt-1 z-10">
          {/* 1. Freighter Wallet */}
          <button
            type="button"
            onClick={connectFreighter}
            disabled={isConnecting}
            className="w-full p-3.5 rounded-2xl bg-[#232326] hover:bg-[#2a2a30] border border-[#333338] hover:border-blue-500/50 text-white font-bold transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 text-left flex items-center justify-between group cursor-pointer disabled:opacity-60"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#1e1b4b] border border-indigo-500/30 flex items-center justify-center text-lg shadow-sm">
                🪐
              </div>
              <div>
                <div className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                  Freighter Wallet
                </div>
                <div className="text-[11px] text-[#a1a1aa] font-medium">
                  Official SDF browser extension
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Official
              </span>
              <span className="text-sm font-bold text-blue-400">
                {connectingWallet === "freighter" ? "..." : "Connect Freighter Wallet →"}
              </span>
            </div>
          </button>

          {/* 2. xBull Wallet */}
          <button
            type="button"
            onClick={connectXBull}
            disabled={isConnecting}
            className="w-full p-3.5 rounded-2xl bg-[#232326] hover:bg-[#2a2a30] border border-[#333338] hover:border-amber-500/50 text-white font-bold transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 text-left flex items-center justify-between group cursor-pointer disabled:opacity-60"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#3f200c] border border-amber-500/30 flex items-center justify-center text-lg shadow-sm">
                🐂
              </div>
              <div>
                <div className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                  xBull Wallet
                </div>
                <div className="text-[11px] text-[#a1a1aa] font-medium">
                  DeFi & Soroban browser extension / Web
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Popular
              </span>
              <span className="text-sm font-bold text-amber-400">
                {connectingWallet === "xbull" ? "..." : "Connect xBull Wallet →"}
              </span>
            </div>
          </button>

          {/* 3. Albedo (No installation required) */}
          <button
            type="button"
            onClick={connectAlbedo}
            disabled={isConnecting}
            className="w-full p-3.5 rounded-2xl bg-[#232326] hover:bg-[#2a2a30] border border-[#333338] hover:border-emerald-500/50 text-white font-bold transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 text-left flex items-center justify-between group cursor-pointer disabled:opacity-60"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#064e3b] border border-emerald-500/30 flex items-center justify-center text-lg shadow-sm">
                ⚡
              </div>
              <div>
                <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Albedo (Instant Web)
                </div>
                <div className="text-[11px] text-[#a1a1aa] font-medium">
                  No extension needed • Mobile & Desktop
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                No Install
              </span>
              <span className="text-sm font-bold text-emerald-400">
                {connectingWallet === "albedo" ? "..." : "Connect with Albedo →"}
              </span>
            </div>
          </button>

          {/* 4. Rabet Wallet */}
          <button
            type="button"
            onClick={connectRabet}
            disabled={isConnecting}
            className="w-full p-3.5 rounded-2xl bg-[#232326] hover:bg-[#2a2a30] border border-[#333338] hover:border-purple-500/50 text-white font-bold transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 text-left flex items-center justify-between group cursor-pointer disabled:opacity-60"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#3b0764] border border-purple-500/30 flex items-center justify-center text-lg shadow-sm">
                🐰
              </div>
              <div>
                <div className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
                  Rabet Wallet
                </div>
                <div className="text-[11px] text-[#a1a1aa] font-medium">
                  Lightweight Stellar browser extension
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-purple-400">
                {connectingWallet === "rabet" ? "..." : "Connect Rabet →"}
              </span>
            </div>
          </button>

          {/* 5. Manual Stellar Address Toggle */}
          <div className="pt-2 border-t border-[#27272a] mt-1">
            {!showManualInput ? (
              <button
                type="button"
                onClick={() => setShowManualInput(true)}
                className="w-full py-2.5 px-3 text-xs text-[#a1a1aa] hover:text-white font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>🔑</span>
                <span>Or connect with Stellar Public Key (Lobstr / Custom)</span>
              </button>
            ) : (
              <div className="space-y-2 p-3 bg-[#1f1f23] rounded-xl border border-[#333338] animate-fadeIn">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-[#e4e4e7] uppercase tracking-wider">
                    Stellar Public Key (G...)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowManualInput(false)}
                    className="text-[11px] text-[#a1a1aa] hover:text-white cursor-pointer"
                  >
                    Hide
                  </button>
                </div>
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value.trim())}
                  placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  className="w-full px-3 py-2 bg-[#18181b] border border-[#3f3f46] rounded-lg text-white font-mono text-xs placeholder-[#71717a] focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleManualConnect}
                  disabled={isConnecting || !manualAddress.trim()}
                  className="w-full py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isConnecting ? "Connecting..." : "Connect Key →"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Render Modals via React Portal */}
      {mounted && emailModalContent && createPortal(emailModalContent, document.body)}
      {mounted && xBullModalContent && createPortal(xBullModalContent, document.body)}
    </div>
  );
}
