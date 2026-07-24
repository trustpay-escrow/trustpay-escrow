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

export default function WalletConnect() {
  const { address, activeRole, setWalletInfo } = useWalletStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [tempAddress, setTempAddress] = useState("");
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

  const handleConnect = async () => {
    setIsConnecting(true);

    if (await isConnected()) {
      try {
        const networkDetails = await getNetworkDetails();
        if (networkDetails.network !== "TESTNET" && networkDetails.network !== "PUBLIC") {
          toast.error("Please open Freighter, click the gear icon, and switch your network to Testnet or Mainnet.");
          setIsConnecting(false);
          return;
        }

        await setAllowed();

        const response = await requestAccess();
        if (response.error) {
          toast.error(getErrorMessage(response.error));
        } else if (response.address) {
          const userAddress = response.address;

          // Connect with backend user identity
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
              setShowEmailModal(true);
            } else if (apiRes.ok) {
              setWalletInfo(userAddress, true, true);
              toast.success("Wallet connected! Multi-role session active.");
              router.push("/projects");
            } else {
              toast.error(data.error || "Failed to connect user on backend");
            }
          } catch (e: any) {
            toast.error(getErrorMessage(e, "Backend error"));
            console.error("Backend error:", e);
          }
        }
      } catch (error: any) {
        toast.error(getErrorMessage(error));
        console.error("Wallet connection failed:", error);
      }
    } else {
      toast.error("Freighter wallet not installed. Please install the Freighter browser extension.");
    }
    setIsConnecting(false);
  };

  const handleEmailSubmit = async () => {
    if (!emailValue.includes('@')) {
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
        setWalletInfo(tempAddress, true, true);
        setShowEmailModal(false);
        toast.success("Registration complete! Multi-role session active.");
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

  const modalContent = showEmailModal ? (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-[#18181b] border border-[#3f3f46] rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto animate-fadeIn">
        {/* Modal Glow */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-blue-500/20 rounded-full blur-2xl pointer-events-none"></div>

        {/* Header Icon & Title */}
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
            First time connecting? Please enter your email address to receive real-time escrow & milestone updates.
          </p>
        </div>

        {/* Input Field Section */}
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

        {/* Action Buttons */}
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

  return (
    <div className="flex flex-col items-center gap-5 p-6 sm:p-8 rounded-3xl border border-[#27272a] shadow-2xl bg-[#18181b]/95 backdrop-blur-2xl max-w-md w-full mx-auto relative overflow-hidden group/card">
      {/* Glow Effects */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl pointer-events-none group-hover/card:bg-blue-500/25 transition-all duration-500"></div>
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none group-hover/card:bg-indigo-500/25 transition-all duration-500"></div>

      {/* Header Icon Badge */}
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
          {address ? "Authenticated multi-role session active." : "Connect Freighter to access your escrow portal."}
        </p>
      </div>

      {/* State View */}
      {address ? (
        <div className="w-full mt-2 p-4 rounded-2xl bg-[#232326] border border-[#333338] flex flex-col items-center gap-2.5 transition-all">
          <span className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-widest">Connected Wallet Address</span>
          <span className="font-mono text-xs text-white tracking-wide bg-[#18181b] px-3.5 py-1.5 rounded-lg border border-[#3f3f46]">
            {address.slice(0, 6)}...{address.slice(-6)}
          </span>
          <span className="text-xs font-bold px-3 py-1 bg-[#052e16] text-[#22c55e] rounded-full border border-[#14532d]">
            Multi-Role Active ({activeRole})
          </span>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-3 mt-1 z-10">
          <button
            type="button"
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-blue-600/30 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 border border-blue-500/30 text-sm cursor-pointer"
          >
            {isConnecting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Check Freighter popup...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <span>Connect Freighter Wallet</span>
                <span className="text-base">→</span>
              </div>
            )}
          </button>
        </div>
      )}

      {/* Render Modal via React Portal */}
      {mounted && modalContent && createPortal(modalContent, document.body)}
    </div>
  );
}
