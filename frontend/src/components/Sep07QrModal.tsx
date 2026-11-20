'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import {
  buildSep07Uri,
  pollSep07Submission,
  confirmSorobanTransaction,
} from '@/lib/soroban';

export interface Sep07QrModalProps {
  txXdr: string;
  /** Source account of the transaction — used to detect the broadcast on Horizon. */
  sourceAccount?: string;
  title?: string;
  description?: string;
  onSuccess?: (txHash: string) => void;
  onClose: () => void;
}

const POLL_TIMEOUT_MS = 60_000;
const CONFIRM_ATTEMPTS = 15;

export function Sep07QrModal({
  txXdr,
  sourceAccount,
  title = 'Sign with Mobile Wallet',
  description = 'Scan the QR code with Lobstr, Solar, or StellarX to review and sign this transaction.',
  onSuccess,
  onClose,
}: Sep07QrModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [status, setStatus] = useState<'waiting' | 'detected' | 'confirmed' | 'timeout'>('waiting');
  const [txHash, setTxHash] = useState<string | null>(null);
  const startedAtRef = useRef<Date>(new Date());
  const doneRef = useRef(false);

  const uri = useMemo(() => buildSep07Uri(txXdr), [txXdr]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(uri, { margin: 1, width: 320, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to generate QR code.');
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  useEffect(() => {
    if (!sourceAccount || doneRef.current) return;

    let cancelled = false;
    const startedAt = startedAtRef.current;

    const poll = async () => {
      try {
        const { txHash: hash } = await pollSep07Submission(sourceAccount, startedAt, POLL_TIMEOUT_MS);
        if (cancelled || doneRef.current) return;
        setTxHash(hash);
        setStatus('detected');

        const confirmed = await confirmSorobanTransaction(hash, CONFIRM_ATTEMPTS);
        if (cancelled || doneRef.current) return;
        doneRef.current = true;
        setStatus(confirmed ? 'confirmed' : 'detected');
        toast.success('Mobile wallet transaction confirmed on Stellar!');
        onSuccess?.(hash);
      } catch (err: unknown) {
        if (cancelled || doneRef.current) return;
        doneRef.current = true;
        setStatus('timeout');
        toast.error(err instanceof Error ? err.message : 'Timed out waiting for mobile wallet signature.');
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceAccount, txXdr]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#18181b] border border-[#3f3f46] rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close QR signing modal"
          className="absolute top-4 right-4 text-[#a1a1aa] hover:text-white text-lg"
        >
          ✕
        </button>

        <div className="text-center space-y-1.5 pt-1">
          <h3 className="text-xl font-extrabold text-white tracking-tight">{title}</h3>
          <p className="text-xs text-[#a1a1aa] leading-relaxed">{description}</p>
        </div>

        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-2xl shadow-inner">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="SEP-0007 transaction QR code" className="w-64 h-64" />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center text-sm text-slate-500">
                Generating QR…
              </div>
            )}
          </div>
        </div>

        <a
          href={uri}
          className="block w-full text-center py-2.5 px-4 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] text-white text-xs font-bold transition-all"
        >
          Open in wallet app →
        </a>

        <div className="text-center text-[11px] text-[#71717a] space-y-1">
          {status === 'waiting' && (
            <p className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />
              Waiting for signature — polling Horizon ledger (60s timeout)…
            </p>
          )}
          {status === 'detected' && (
            <p className="text-amber-400">
              Transaction detected on ledger{txHash ? ` (${txHash.slice(0, 10)}…)` : ''} — confirming…
            </p>
          )}
          {status === 'confirmed' && (
            <p className="text-emerald-400">✓ Confirmed on Soroban ledger.</p>
          )}
          {status === 'timeout' && <p className="text-red-400">No signature detected within 60 seconds.</p>}
          {!sourceAccount && <p>Provide a source account to enable automatic confirmation polling.</p>}
        </div>
      </div>
    </div>
  );
}
