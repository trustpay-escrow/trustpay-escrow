'use client';

import { useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { EscrowAnalytics, EscrowSettlementDay } from '@/lib/api';

const DAY = 86_400_000;
const ranges = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365, All: 0 };
type Range = keyof typeof ranges;
const rangeOptions = Object.keys(ranges) as Range[];
const tokenColors: Record<string, string> = { USDC: '#60a5fa', XLM: '#34d399', EURC: '#a78bfa' };
const amount = new Intl.NumberFormat('en', { maximumFractionDigits: 4 });
const dateLabel = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const compact = new Intl.NumberFormat('en', { notation: 'compact' });
const shortDate = (date: string) => dateLabel.format(new Date(date));

export function settlementRange(rows: EscrowSettlementDay[], range: Range, token: string, now: Date) {
  const today = Math.floor(now.getTime() / DAY);
  const tokenRows = rows.filter((row) => row.token === token);
  const byDate = new Map(tokenRows.map((row) => [row.date, row]));
  const firstDay = tokenRows.reduce((first, row) => Math.min(first, Date.parse(row.date) / DAY), today);
  const start = ranges[range] ? today - ranges[range] + 1 : firstDay;

  return Array.from({ length: today - start + 1 }, (_, index) => {
    const date = new Date((start + index) * DAY).toISOString().slice(0, 10);
    return byDate.get(date) ?? { date, token, volume: 0, transactions: 0, averageBudget: 0 };
  });
}

function SettlementTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: EscrowSettlementDay }[] }) {
  const day = active ? payload?.[0]?.payload : undefined;
  if (!day) return null;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-white shadow-lg">
      <p className="mb-2 font-semibold">{day.date} UTC</p>
      <p>Settled volume {amount.format(day.volume)} {day.token}</p>
      <p>Transactions {amount.format(day.transactions)}</p>
      <p>Average project budget {day.transactions ? `${amount.format(day.averageBudget)} ${day.token}` : '—'}</p>
    </div>
  );
}

export function EscrowVolumeChart({ analytics, now = new Date() }: { analytics: EscrowAnalytics; now?: Date }) {
  const [range, setRange] = useState<Range>('30D');
  const [token, setToken] = useState('USDC');
  const rows = settlementRange(analytics.settlements, range, token, now);
  const capital = new Map(analytics.capital.map((row) => [row.token, row]));
  const tokens = [...new Set([...Object.keys(tokenColors), ...capital.keys(), ...analytics.settlements.map((row) => row.token)])];
  const distribution = tokens.map((symbol) => ({
    token: symbol, contracts: capital.get(symbol)?.contracts ?? 0, locked: capital.get(symbol)?.locked ?? 0,
  }));
  const totalContracts = distribution.reduce((sum, row) => sum + row.contracts, 0);
  const plotColor = tokenColors[token] ?? '#fbbf24';

  return (
    <div className="grid min-w-0 gap-5">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Total value locked</h2>
        <p className="text-sm text-slate-400">{totalContracts} funded contracts with funds remaining</p>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          {distribution.map((row) => <div key={row.token}><dt className="text-sm text-slate-400">{row.token}</dt><dd className="text-xl font-semibold tabular-nums">{amount.format(row.locked)}</dd></div>)}
        </dl>
      </section>

      <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Historical settlement volume</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="settlement-token">Settlement token</label>
            <select id="settlement-token" value={token} onChange={(event) => setToken(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm">
              {tokens.map((symbol) => <option key={symbol}>{symbol}</option>)}
            </select>
            <div role="group" aria-label="Time range" className="flex gap-1">
              {rangeOptions.map((option) => <button key={option} type="button" aria-pressed={option === range} onClick={() => setRange(option)}
                className="rounded-md px-2 py-2 text-sm text-slate-300 hover:bg-slate-800 aria-pressed:bg-blue-600 aria-pressed:text-white">{option}</button>)}
            </div>
          </div>
        </div>
        <p className="mb-3 text-sm text-slate-400">{rows[0]?.date} to {rows.at(-1)?.date} UTC · {token}</p>
        {!rows.some((row) => row.transactions > 0) && <p className="mb-3 text-sm text-slate-400">No indexed settlements for this token in this range.</p>}
        <div className="h-64 min-w-0 touch-pan-y" aria-label="Historical settlement volume area chart">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={rows} margin={{ right: 10 }}>
              <CartesianGrid stroke="#334155" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} stroke="#94a3b8" fontSize={11} />
              <YAxis tickFormatter={(value: number) => compact.format(value)} width={44} stroke="#94a3b8" fontSize={11} />
              <Tooltip content={<SettlementTooltip />} />
              <Area dataKey="volume" type="monotone" stroke={plotColor} strokeWidth={2} fill={plotColor} fillOpacity={0.2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Daily settlement transactions</h2>
          <div className="h-56 min-w-0 touch-pan-y">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={rows} margin={{ right: 10 }}>
                <CartesianGrid stroke="#334155" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} stroke="#94a3b8" fontSize={11} />
                <YAxis allowDecimals={false} width={44} stroke="#94a3b8" fontSize={11} />
                <Tooltip content={<SettlementTooltip />} cursor={{ fill: '#334155', opacity: 0.5 }} />
                <Bar dataKey="transactions" fill={plotColor} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Token distribution</h2>
          <p className="text-sm text-slate-400">Share of funded contracts with funds remaining</p>
          {totalContracts > 0 &&
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie data={distribution.filter((row) => row.contracts > 0)} dataKey="contracts" nameKey="token"
                    innerRadius={42} outerRadius={66} stroke="none" isAnimationActive={false}>
                    {distribution.filter((row) => row.contracts > 0).map((row) => <Cell key={row.token} fill={tokenColors[row.token] ?? '#fbbf24'} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          }
          <ul className="mt-3 space-y-1 text-sm">
            {distribution.map((row) => <li key={row.token} className="flex justify-between">
              <span><span aria-hidden="true" style={{ color: tokenColors[row.token] ?? '#fbbf24' }}>●</span> {row.token}</span>
              <span>{row.contracts} · {totalContracts ? Math.round(row.contracts / totalContracts * 100) : 0}%</span>
            </li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
