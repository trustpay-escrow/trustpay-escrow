import type { Groth16Proof, PublicSignals } from 'snarkjs';

export interface ZkAttestationInput {
  proof?: unknown;
  publicSignals?: unknown;
  public_signals?: unknown;
  verificationKey?: unknown;
  verification_key?: unknown;
  vk?: unknown;
  tier?: string;
  label?: string;
  [key: string]: unknown;
}

export type ZkVerificationStatus = 'verified' | 'invalid' | 'missing' | 'error';

export interface ZkVerificationResult {
  status: ZkVerificationStatus;
  message: string;
  durationMs?: number;
  tier?: string;
}

export const DEFAULT_ZK_TIER_LABEL = 'ZK Verified: Tier 1 Contractor (>10 Escrows Completed)';

function asRecord(value: unknown): ZkAttestationInput | null {
  return value && typeof value === 'object' ? (value as ZkAttestationInput) : null;
}

function parseVerificationKey(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function defaultVerificationKey(): unknown {
  const raw = process.env.NEXT_PUBLIC_ZK_ATTESTATION_VK;
  return raw ? parseVerificationKey(raw) : undefined;
}

function hasProofMaterial(proof: unknown, publicSignals: unknown, verificationKey: unknown): boolean {
  return Boolean(proof && publicSignals && verificationKey);
}

export function getZkAttestationLabel(attestation: unknown): string {
  const record = asRecord(attestation);
  return record?.label || record?.tier || DEFAULT_ZK_TIER_LABEL;
}

export async function verifyZkAttestation(
  attestation: unknown,
  verificationKey?: unknown
): Promise<ZkVerificationResult> {
  const record = asRecord(attestation) || {};
  const proof = record.proof ?? attestation;
  const publicSignals = record.publicSignals ?? record.public_signals;
  const vk = parseVerificationKey(record.verificationKey ?? record.verification_key ?? record.vk ?? verificationKey ?? defaultVerificationKey());

  if (!hasProofMaterial(proof, publicSignals, vk)) {
    return {
      status: 'missing',
      message: 'ZK attestation is missing proof, public signals, or verification key material.',
      tier: getZkAttestationLabel(attestation),
    };
  }

  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    const snarkjs = await import('snarkjs');
    const verified = await snarkjs.groth16.verify(
      vk,
      publicSignals as PublicSignals,
      proof as Groth16Proof
    );
    const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt);

    return verified
      ? {
          status: 'verified',
          message: 'Groth16 proof verified in the browser.',
          durationMs,
          tier: getZkAttestationLabel(attestation),
        }
      : {
          status: 'invalid',
          message: 'Groth16 proof verification returned false. The attestation may be tampered or stale.',
          durationMs,
          tier: getZkAttestationLabel(attestation),
        };
  } catch (error: unknown) {
    const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Groth16 proof verification failed.',
      durationMs,
      tier: getZkAttestationLabel(attestation),
    };
  }
}
