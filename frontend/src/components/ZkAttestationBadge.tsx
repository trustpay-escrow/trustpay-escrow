'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getZkAttestationLabel, verifyZkAttestation, ZkVerificationResult } from '@/lib/zk-proof-verifier';

export interface ZkAttestationBadgeProps {
  attestation?: unknown;
  verificationKey?: unknown;
  className?: string;
}

export function ZkAttestationBadge({ attestation, verificationKey, className = '' }: ZkAttestationBadgeProps) {
  const signature = useMemo(() => JSON.stringify(attestation ?? null), [attestation]);
  const [verification, setVerification] = useState<{ signature: string; result: ZkVerificationResult | null }>({
    signature: '',
    result: null,
  });

  const result = verification.signature === signature ? verification.result : null;
  const verifying = Boolean(attestation) && verification.signature !== signature;

  useEffect(() => {
    if (!attestation) return;
    let cancelled = false;

    verifyZkAttestation(attestation, verificationKey)
      .then((verificationResult) => {
        if (!cancelled) setVerification({ signature, result: verificationResult });
      })
      .catch(() => {
        if (!cancelled) {
          setVerification({
            signature,
            result: { status: 'error', message: 'Groth16 proof verification failed.' },
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // signature captures attestation object changes without depending on object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, verificationKey]);

  if (!attestation) return null;

  if (verifying) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        Verifying ZK proof…
      </span>
    );
  }

  if (result?.status === 'verified') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 ${className}`}
        title={result.durationMs ? `Verified in ${result.durationMs}ms` : 'Groth16 proof verified'}
      >
        <span>🛡️</span>
        <span>{result.tier || getZkAttestationLabel(attestation)}</span>
      </span>
    );
  }

  if (result?.status === 'missing') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-zinc-500/10 text-zinc-300 border border-zinc-500/30 ${className}`}>
        <span>ZK proof not provided</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/10 text-red-300 border border-red-500/30 ${className}`}
      title={result?.message || 'Invalid ZK attestation'}
    >
      <span>⚠️</span>
      <span>ZK Proof Rejected — Tampered or invalid attestation</span>
    </span>
  );
}
