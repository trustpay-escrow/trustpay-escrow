'use client';

import { useCallback, useState } from 'react';
import { xdr } from '@stellar/stellar-sdk';
import { prepareSep07Transaction, type SorobanTxResult } from '@/lib/soroban';
import { Sep07QrModal } from '@/components/Sep07QrModal';

interface PendingSep07Tx {
  txXdr: string;
  sourceAccount: string;
  functionName: string;
  resolve: (result: SorobanTxResult) => void;
  reject: (error: Error) => void;
}

/**
 * Hook that signs Soroban contract transactions via SEP-0007 QR codes.
 * `signWithSep07` prepares an unsigned transaction, opens the QR modal, and
 * resolves once the mobile wallet broadcast is detected on Horizon.
 */
export function useSep07Signer() {
  const [pending, setPending] = useState<PendingSep07Tx | null>(null);

  const signWithSep07 = useCallback(
    (options: {
      callerAddress: string;
      contractAddress?: string;
      functionName: string;
      args: xdr.ScVal[];
    }): Promise<SorobanTxResult> => {
      return new Promise<SorobanTxResult>((resolve, reject) => {
        prepareSep07Transaction(options)
          .then((prepared) => {
            setPending({ ...prepared, resolve, reject });
          })
          .catch(reject);
      });
    },
    []
  );

  const sep07Modal = pending ? (
    <Sep07QrModal
      txXdr={pending.txXdr}
      sourceAccount={pending.sourceAccount}
      title={`Sign ${pending.functionName} on Mobile`}
      description="Scan with Lobstr, Solar, or StellarX to review and sign this escrow transaction. No browser extension required."
      onSuccess={(hash) => {
        pending.resolve({ success: true, txHash: hash });
        setPending(null);
      }}
      onClose={() => {
        pending.reject(new Error('Mobile signing cancelled or timed out.'));
        setPending(null);
      }}
    />
  ) : null;

  return { signWithSep07, sep07Modal };
}
