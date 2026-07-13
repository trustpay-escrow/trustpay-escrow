"use client";
import { useState, useEffect } from "react";
import { isConnected, requestAccess } from "@stellar/freighter-api";

export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [role, setRole] = useState<"client" | "freelancer" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Optionally check if already connected on mount
  }, []);

  const handleConnect = async () => {
    if (!role) {
      setErrorMsg("Please select your role first");
      return;
    }
    setErrorMsg(null);
    setIsConnecting(true);
    
    if (await isConnected()) {
      try {
        const response = await requestAccess();
        if (response.error) {
          setErrorMsg("Wallet connection failed: " + response.error);
        } else if (response.address) {
          const userAddress = response.address;
          
          // Register with backend
          try {
            const apiRes = await fetch("http://localhost:3001/api/users/connect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ stellar_address: userAddress, role })
            });
            
            if (apiRes.ok) {
              setAddress(userAddress);
            } else {
              const data = await apiRes.json();
              setErrorMsg(data.error || "Failed to register user on backend");
            }
          } catch (e) {
            setErrorMsg("Backend server is not reachable");
            console.error("Backend error:", e);
          }
        }
      } catch (error) {
        setErrorMsg("Wallet connection failed");
        console.error("Wallet connection failed:", error);
      }
    } else {
      setErrorMsg("Freighter wallet not installed. Please install the Freighter browser extension.");
    }
    setIsConnecting(false);
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

      {errorMsg && (
        <div className="w-full text-center px-4 py-2.5 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 font-medium animate-in fade-in zoom-in-95 duration-200">
          {errorMsg}
        </div>
      )}
      
      {/* State View */}
      {address ? (
        <div className="w-full mt-2 p-4 rounded-xl bg-slate-50/80 border border-slate-200/60 flex flex-col items-center gap-2.5 transition-all hover:bg-slate-100/80">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Connected Address</span>
          <span className="font-mono text-sm text-slate-700 tracking-wide bg-white px-3.5 py-2 rounded-lg shadow-sm border border-slate-200">
            {address.slice(0, 5)}...{address.slice(-5)}
          </span>
          <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded uppercase tracking-wider mt-1 border border-green-200">
            {role} Profile active
          </span>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-4 mt-1 z-10">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setRole("client")}
              className={`cursor-pointer px-4 py-3 rounded-xl border font-medium text-sm transition-all duration-200 ${
                role === "client" 
                  ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm shadow-blue-500/10 ring-1 ring-blue-600" 
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              Client
            </button>
            <button
              onClick={() => setRole("freelancer")}
              className={`cursor-pointer px-4 py-3 rounded-xl border font-medium text-sm transition-all duration-200 ${
                role === "freelancer" 
                  ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm shadow-blue-500/10 ring-1 ring-blue-600" 
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              Freelancer
            </button>
          </div>

          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="cursor-pointer relative w-full px-6 py-3.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:shadow-slate-900/20 focus:outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-2 overflow-hidden group/btn"
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
                  Connecting...
                </>
              ) : (
                "Connect Freighter"
              )}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
