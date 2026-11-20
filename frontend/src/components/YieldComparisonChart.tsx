'use client';

import React, { useState, useMemo } from 'react';

export type YieldTimeframe = '30D' | '60D' | '90D' | '1Y';

export interface YieldComparisonChartProps {
  principalAmount?: number;
  blendApy?: number; // e.g. 0.048 for 4.8%
  className?: string;
}

export function YieldComparisonChart({
  principalAmount = 10000,
  blendApy = 0.048,
  className = '',
}: YieldComparisonChartProps) {
  const [timeframe, setTimeframe] = useState<YieldTimeframe>('90D');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const daysCount = useMemo(() => {
    switch (timeframe) {
      case '30D':
        return 30;
      case '60D':
        return 60;
      case '90D':
        return 90;
      case '1Y':
        return 365;
    }
  }, [timeframe]);

  // Generate discrete points for the curve
  const dataPoints = useMemo(() => {
    const steps = 10;
    const points = [];
    const stepDays = daysCount / steps;

    for (let i = 0; i <= steps; i++) {
      const day = Math.round(i * stepDays);
      const yearFraction = day / 365;
      const blendEarned = principalAmount * (Math.pow(1 + blendApy, yearFraction) - 1);
      const staticEarned = 0;

      points.push({
        day,
        label: `Day ${day}`,
        blendTotal: principalAmount + blendEarned,
        blendYield: blendEarned,
        staticTotal: principalAmount,
        staticYield: staticEarned,
        difference: blendEarned,
      });
    }
    return points;
  }, [daysCount, principalAmount, blendApy]);

  const totalEarned = dataPoints[dataPoints.length - 1].blendYield;
  const clientShare = totalEarned * 0.8;
  const platformShare = totalEarned * 0.2;

  // Chart coordinates
  const svgWidth = 600;
  const svgHeight = 220;
  const padding = { top: 20, right: 30, bottom: 35, left: 50 };

  const maxY = Math.max(...dataPoints.map((p) => p.blendYield)) * 1.15 || 10;
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  const getCoordinates = (index: number, val: number) => {
    const x = padding.left + (index / (dataPoints.length - 1)) * plotWidth;
    const y = padding.top + plotHeight - (val / maxY) * plotHeight;
    return { x, y };
  };

  const blendPath = dataPoints
    .map((p, idx) => {
      const { x, y } = getCoordinates(idx, p.blendYield);
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const staticPath = dataPoints
    .map((p, idx) => {
      const { x, y } = getCoordinates(idx, 0);
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const activePoint = hoveredIndex !== null ? dataPoints[hoveredIndex] : dataPoints[dataPoints.length - 1];

  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-white tracking-tight">Blend Yield APY Comparison</h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {(blendApy * 100).toFixed(1)}% APY
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            Compare returns between Blend Protocol escrow pooling vs static zero-yield holding
          </p>
        </div>

        {/* Timeframe filters */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          {(['30D', '60D', '90D', '1Y'] as YieldTimeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => {
                setTimeframe(tf);
                setHoveredIndex(null);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                timeframe === tf
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5">
          <div className="text-xs text-slate-400">Total Net Yield Earned</div>
          <div className="text-lg font-bold text-emerald-400 mt-1">
            +${totalEarned.toFixed(2)} USDC
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Over {daysCount} days escrow period</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5">
          <div className="text-xs text-slate-400">Client Escrow Rebate (80%)</div>
          <div className="text-lg font-bold text-blue-400 mt-1">
            +${clientShare.toFixed(2)} USDC
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Directly returns upon completion</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5">
          <div className="text-xs text-slate-400">Standard Escrow (0% APY)</div>
          <div className="text-lg font-bold text-slate-400 mt-1">$0.00 USDC</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Capital sits idle without yield</div>
        </div>
      </div>

      {/* SVG Comparison Chart */}
      <div className="relative rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible"
        >
          {/* Grid lines */}
          {[0, 0.5, 1].map((ratio) => {
            const y = padding.top + plotHeight * (1 - ratio);
            const val = (maxY * ratio).toFixed(1);
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={svgWidth - padding.right}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="#64748b"
                >
                  ${val}
                </text>
              </g>
            );
          })}

          {/* Static Escrow line (0% APY) */}
          <path d={staticPath} fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />

          {/* Blend Yield line (4.8% APY) */}
          <path d={blendPath} fill="none" stroke="#10b981" strokeWidth="3" />

          {/* Data points and hover zones */}
          {dataPoints.map((point, idx) => {
            const { x, y } = getCoordinates(idx, point.blendYield);
            const isHovered = hoveredIndex === idx;

            return (
              <g key={idx}>
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 6 : 4}
                  fill="#10b981"
                  stroke="#0f172a"
                  strokeWidth="2"
                  className="transition-all cursor-pointer"
                />
                <circle
                  cx={x}
                  cy={y}
                  r="16"
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  className="cursor-pointer"
                />
              </g>
            );
          })}
        </svg>

        {/* Tooltip Card */}
        {activePoint && (
          <div className="mt-3 flex items-center justify-between text-xs border-t border-slate-800/80 pt-3 px-2 text-slate-300">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-white">{activePoint.label}:</span>
              <span className="text-emerald-400">
                Blend Yield: +${activePoint.blendYield.toFixed(2)}
              </span>
              <span className="text-slate-500">vs</span>
              <span className="text-slate-400">Static: $0.00</span>
            </div>
            <div className="font-bold text-emerald-300">
              Net Gain: +${activePoint.difference.toFixed(2)} USDC
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-slate-300">With Blend Yield (4.8% APY)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-3 bg-slate-500 border border-dashed border-slate-400" />
          <span className="text-slate-400">Standard Escrow (0% APY)</span>
        </div>
      </div>
    </div>
  );
}
