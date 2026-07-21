"use client";
import { useState, useEffect } from "react";
import { isConnected, requestAccess, getNetworkDetails, setAllowed } from "@stellar/freighter-api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  const { address, role: storeRole, setWalletInfo } = useWalletStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"client" | "freelancer" | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [tempAddress, setTempAddress] = useState("");
  const router = useRouter();

  useEffect(() => {
    // If already connected, redirect based on role
    if (address && storeRole) {
      if (storeRole === "client") {
        router.push("/projects/create");
      } else {
        router.push("/projects");
      }
    }
  }, [address, storeRole, router]);

  const handleConnect = async () => {
    if (!selectedRole) {
      toast.error("Please select your role first");
      return;
    }
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
          
          // Register with backend
          try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
            const apiRes = await fetch(`${apiUrl}/api/users/connect`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ stellar_address: userAddress, role: selectedRole })
            });
            const data = await apiRes.json();
            
            if (apiRes.status === 403 && data.requiresRegistration) {
              setTempAddress(userAddress);
              setShowEmailModal(true);
            } else if (apiRes.ok) {
              setWalletInfo(userAddress, selectedRole);
              toast.success("Wallet connected successfully!");
            } else {
              toast.error(data.error || "Failed to register user on backend");
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
        body: JSON.stringify({ stellar_address: tempAddress, role: selectedRole, email: emailValue })
      });
      
      const data = await apiRes.json();
      if (apiRes.ok) {
        setWalletInfo(tempAddress, selectedRole!);
        setShowEmailModal(false);
        toast.success("Registration complete! Wallet connected.");
      } else {
        toast.error(data.error || "Failed to register user");
      }
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Backend error"));
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8 border border-white/40 rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 backdrop-blur-xl transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] max-w-sm w-full mx-auto relative overflow-hidden group/card">
      {/* Decorative gradient orb */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none group-hover/card:bg-blue-500/20 transition-all duration-500"></div>
      
      {/* Icon Container */}
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-teal-400 text-white shadow-lg shadow-blue-500/20 transform transition-transform group-hover/card:scale-105 duration-300">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
        </svg>
      </div>
      
      {/* Title */}
      <div className="text-center z-10 flex flex-col gap-1.5 w-full">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Stellar Wallet</h2>
        <p className="text-sm text-slate-500 font-medium leading-relaxed">
          {address ? "You are successfully authenticated." : "Select your role and connect Freighter to get started."}
        </p>
      </div>
      
      {/* State View */}
      {address ? (
        <div className="w-full mt-2 p-4 rounded-xl bg-slate-50/80 border border-slate-200/60 flex flex-col items-center gap-2.5 transition-all hover:bg-slate-100/80">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Connected Address</span>
          <span className="font-mono text-sm text-slate-700 tracking-wide bg-white px-3.5 py-2 rounded-lg shadow-sm border border-slate-200">
            {address.slice(0, 5)}...{address.slice(-5)}
          </span>
          <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded uppercase tracking-wider mt-1 border border-green-200">
            {storeRole} Profile active
          </span>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-4 mt-1 z-10">
          <div className="grid md:grid-cols-2 grid-cols-1 gap-3">
            <Button
              variant="outline"
              onClick={() => setSelectedRole("client")}
              className={`w-full py-6 rounded-xl border transition-all duration-200 ${
                selectedRole === "client" 
                  ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm shadow-blue-500/10 ring-1 ring-blue-600 hover:bg-blue-100 hover:text-blue-800" 
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              Client
            </Button>
            <Button
              variant="outline"
              onClick={() => setSelectedRole("freelancer")}
              className={`w-full py-6 rounded-xl border transition-all duration-200 ${
                selectedRole === "freelancer" 
                  ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm shadow-blue-500/10 ring-1 ring-blue-600 hover:bg-blue-100 hover:text-blue-800" 
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              Freelancer
            </Button>
          </div>

          <Button
            size="lg"
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full py-6 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all duration-200 shadow-md group/btn relative overflow-hidden"
          >
            {/* Subtle button highlight effect */}
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-in-out"></div>
            
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isConnecting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Check Freighter popup...
                </>
              ) : (
                "Connect Freighter"
              )}
            </span>
          </Button>
        </div>
      )}

      {/* Email Collection Modal */}
      {showEmailModal && (
        <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in slide-in-from-bottom-8 duration-500 ease-out">
          {/* Decorative background glow inside modal */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-indigo-500/10 to-transparent blur-2xl pointer-events-none"></div>

          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center mb-5 shadow-xl shadow-indigo-500/30 transform transition-transform hover:scale-105 duration-300">
            {/* Subtle pulse ring */}
            <div className="absolute inset-0 rounded-2xl ring-2 ring-indigo-400/50 animate-ping opacity-20"></div>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 relative z-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>
          
          <h3 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-2">
            Welcome to TrustPay
          </h3>
          
          <p className="text-[13px] text-slate-500 mb-7 leading-relaxed font-medium px-2">
            It looks like this is your first time connecting. Please provide an email address to receive important notifications about your escrows.
          </p>
          
          <div className="relative w-full mb-6 group/input">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-indigo-500 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 1 0-2.636 6.364M16.5 12V8.25" />
              </svg>
            </div>
            <input
              type="email"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              placeholder="name@example.com"
              className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-700 shadow-sm placeholder:text-slate-400 font-medium"
            />
          </div>
          
          <div className="flex w-full gap-3 mt-auto">
            <Button
              variant="outline"
              onClick={() => {
                setShowEmailModal(false);
                setIsConnecting(false);
              }}
              className="flex-1 rounded-xl py-6 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300 font-semibold transition-all duration-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEmailSubmit}
              disabled={isConnecting}
              className="flex-1 rounded-xl py-6 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white shadow-lg shadow-indigo-500/25 border-0 font-semibold transition-all duration-300 hover:shadow-indigo-500/40 relative overflow-hidden group/submit"
            >
              {/* Button shine effect */}
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/submit:translate-x-full transition-transform duration-700 ease-in-out"></div>
              <span className="relative z-10">
                {isConnecting ? "Registering..." : "Complete Setup"}
              </span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
