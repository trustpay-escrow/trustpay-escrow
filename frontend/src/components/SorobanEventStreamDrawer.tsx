'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { scValToNative } from '@stellar/stellar-sdk';
import { fetchContractEvents, DEFAULT_ESCROW_CONTRACT_ID } from '@/lib/soroban';

interface ContractEvent {
  id: string;
  ledger: number | string;
  txHash?: string;
  contractId?: string;
  topics: unknown[];
  data?: unknown;
  isError: boolean;
  raw: any;
}

/** Recursively decodes a Soroban ScVal XDR object into a JSON-friendly value. */
export function decodeScVal(value: any): unknown {
  if (value == null) return null;
  try {
    const type = typeof value.switch === 'function' ? value.switch() : undefined;
    switch (type) {
      case 'scvVoid':
        return null;
      case 'scvBool':
        return Boolean(value.b());
      case 'scvSymbol':
        return value.sym().toString();
      case 'scvString':
        return value.str().toString();
      case 'scvBytes':
        try {
          return value.bytes().toString('hex');
        } catch {
          return value.bytes().toString();
        }
      case 'scvAddress':
        try {
          return value.address().toString();
        } catch {
          return scValToNative(value);
        }
      case 'scvI32':
        return value.i32().toNumber();
      case 'scvU32':
        return value.u32().toNumber();
      case 'scvI64':
        return Number(value.i64().toBigInt());
      case 'scvU64':
        return Number(value.u64().toBigInt());
      case 'scvI128':
        try {
          return value.i128().toBigInt().toString();
        } catch {
          return value.i128().toString();
        }
      case 'scvU128':
        try {
          return value.u128().toBigInt().toString();
        } catch {
          return value.u128().toString();
        }
      case 'scvTimepoint':
        return Number(value.timepoint().toNumber());
      case 'scvDuration':
        return Number(value.duration().toNumber());
      case 'scvVec':
        return value.vec().map((item: any) => decodeScVal(item));
      case 'scvMap':
        return value.map().map((entry: any) => ({
          key: decodeScVal(entry.key()),
          value: decodeScVal(entry.val()),
        }));
      case 'scvStruct':
        return Object.fromEntries(
          value.map().map((entry: any) => [
            decodeScVal(entry.key()),
            decodeScVal(entry.val()),
          ])
        );
      default:
        try {
          return scValToNative(value);
        } catch {
          return String(value);
        }
    }
  } catch {
    try {
      return scValToNative(value);
    } catch {
      return String(value);
    }
  }
}

function isErrorEvent(event: any): boolean {
  const type = typeof event?.type === 'string' ? event.type : '';
  const valueStr = JSON.stringify(event?.value ?? '');
  return type === 'diagnostic' || /error|failed|panic/i.test(valueStr);
}

function normalizeEvent(raw: any, index: number): ContractEvent {
  const topics = Array.isArray(raw?.topic) ? raw.topic.map(decodeScVal) : [];
  const data = raw?.value !== undefined ? decodeScVal(raw.value) : undefined;
  return {
    id: `${raw?.ledger ?? 'x'}-${raw?.txHash ?? index}`,
    ledger: raw?.ledger ?? raw?.ledgerClosedAt ?? '',
    txHash: raw?.txHash,
    contractId: raw?.contractId,
    topics,
    data,
    isError: isErrorEvent(raw),
    raw,
  };
}

const TOPIC_FILTERS = ['all', 'deposit', 'submit', 'approve', 'dispute', 'release', 'create', 'revision'];

export function SorobanEventStreamDrawer({ contractId }: { contractId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [paused, setPaused] = useState(false);

  const targetContract = contractId || DEFAULT_ESCROW_CONTRACT_ID;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchContractEvents({ contractId: targetContract, ledgerWindow: 300 });
      setEvents(raw.map(normalizeEvent).reverse());
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch Soroban events');
    } finally {
      setLoading(false);
    }
  }, [targetContract]);

  useEffect(() => {
    if (!isOpen || paused) return;
    const first = setTimeout(() => void load(), 0);
    const interval = setInterval(() => void load(), 8000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [isOpen, paused, load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return events.filter((event) => {
      const blob = JSON.stringify({ topics: event.topics, data: event.data }).toLowerCase();
      if (needle && !blob.includes(needle)) return false;
      if (filter === 'all') return true;
      return blob.includes(filter);
    });
  }, [events, filter, search]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-40 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-2xl shadow-indigo-600/30 border border-indigo-400/30 flex items-center gap-2 transition-all"
        title="Live Soroban contract event stream"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        Soroban Events
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[9998] flex justify-end bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <aside
            className="h-full w-full max-w-xl bg-[#0f0f12] border-l border-[#27272a] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#27272a]">
              <div>
                <h3 className="text-sm font-extrabold text-white">Soroban Event Stream</h3>
                <p className="text-[10px] text-[#71717a] font-mono truncate max-w-[280px]">{targetContract}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#a1a1aa] border border-[#3f3f46]"
                >
                  {paused ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close event stream"
                  className="text-[#a1a1aa] hover:text-white text-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="px-5 py-3 border-b border-[#27272a] space-y-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by topic (deposit, submit, approve, dispute…)"
                className="w-full px-3 py-2 bg-[#18181b] border border-[#333338] rounded-xl text-xs text-white placeholder-[#71717a] focus:outline-none focus:border-indigo-500 font-mono"
              />
              <div className="flex flex-wrap gap-1.5">
                {TOPIC_FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-colors ${
                      filter === f
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        : 'bg-[#18181b] text-[#a1a1aa] border-[#27272a] hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {loading && events.length === 0 && (
                <p className="text-xs text-[#71717a] text-center py-8">Loading contract events…</p>
              )}
              {error && <p className="text-xs text-red-400 text-center py-4">{error}</p>}
              {!loading && !error && filtered.length === 0 && (
                <p className="text-xs text-[#71717a] text-center py-8">No contract events found in the recent ledger window.</p>
              )}
              {filtered.map((event) => (
                <div
                  key={event.id}
                  className={`rounded-xl border p-3 text-[11px] font-mono space-y-1.5 ${
                    event.isError
                      ? 'bg-red-500/5 border-red-500/30'
                      : 'bg-[#18181b] border-[#27272a]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={event.isError ? 'text-red-400 font-bold' : 'text-indigo-400 font-bold'}>
                      {event.isError ? '⚠ diagnostic/error' : `ledger ${event.ledger}`}
                    </span>
                    {event.txHash && (
                      <span className="text-[#71717a] truncate">tx {event.txHash.slice(0, 12)}…</span>
                    )}
                  </div>
                  {event.topics.length > 0 && (
                    <div className="text-[#a1a1aa]">
                      <span className="text-[#71717a]">topics: </span>
                      {event.topics.map((t, i) => (
                        <span key={i} className="text-emerald-300/90">
                          {typeof t === 'string' ? t : JSON.stringify(t)}
                          {i < event.topics.length - 1 ? ' · ' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {event.data !== undefined && (
                    <pre className="text-[#c4b5fd] whitespace-pre-wrap break-all leading-relaxed">
                      {JSON.stringify(event.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
