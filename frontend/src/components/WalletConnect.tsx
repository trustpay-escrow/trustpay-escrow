"use client";
import { useState, useEffect } from "react";
import { isConnected, requestAccess } from "@stellar/freighter-api";

export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    // Optionally check if already connected
    // But Freighter usually requires explicit user action to connect on first load
  }, []);

  const handleConnect = async () => {
    if (await isConnected()) {
      try {
        const response = await requestAccess();
        setAddress(response);
      } catch (error) {
        console.error("Wallet connection failed", error);
      }
    } else {
      alert("Freighter wallet not installed");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-xl shadow-sm bg-white/50 backdrop-blur-sm">
      <h2 className="text-xl font-bold">Stellar Wallet</h2>
      {address ? (
        <div className="text-sm">
          Connected: <span className="font-mono bg-gray-100 p-1 rounded">{address.slice(0, 5)}...{address.slice(-5)}</span>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Connect Freighter
        </button>
      )}
    </div>
  );
}
