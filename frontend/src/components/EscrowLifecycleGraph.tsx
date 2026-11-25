'use client';

import React, { useMemo, useRef, useState } from 'react';
import type { Project } from '@/types';
import {
  ESCROW_LIFECYCLE_EDGES,
  ESCROW_LIFECYCLE_NODES,
  LIFECYCLE_COLORS,
  LIFECYCLE_HAPPY_PATH,
  LIFECYCLE_NODE_HEIGHT,
  LIFECYCLE_NODE_WIDTH,
  LIFECYCLE_VIEWBOX,
  deriveEscrowLifecyclePosition,
  formatLifecycleDuration,
  getLifecycleNode,
  type EscrowLifecycleState,
} from '@/lib/escrow-lifecycle';

export interface EscrowLifecycleGraphProps {
  project: Project;
  /** Start with the compact summary instead of the full diagram. */
  defaultCollapsed?: boolean;
  className?: string;
}

const SIGNER_LABELS = {
  client: 'Client',
  freelancer: 'Freelancer',
  arbiter: 'Arbiter',
} as const;

interface ViewTransform {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 0.55;
const MAX_SCALE = 1.8;

function nodeCenter(state: EscrowLifecycleState) {
  const node = getLifecycleNode(state);
  return {
    x: node.position.x + LIFECYCLE_NODE_WIDTH / 2,
    y: node.position.y + LIFECYCLE_NODE_HEIGHT / 2,
  };
}

export function EscrowLifecycleGraph({
  project,
  defaultCollapsed = false,
  className = '',
}: EscrowLifecycleGraphProps) {
  const position = useMemo(() => deriveEscrowLifecyclePosition(project), [project]);
  const activeNode = getLifecycleNode(position.state);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [selected, setSelected] = useState<EscrowLifecycleState | null>(null);
  const [hovered, setHovered] = useState<EscrowLifecycleState | null>(null);
  const [view, setView] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const dragRef = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(
    null
  );

  const inspected = getLifecycleNode(selected ?? hovered ?? position.state);
  const progressIndex = LIFECYCLE_HAPPY_PATH.indexOf(position.state);

  const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: view.x,
      originY: view.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setView((current) => ({
      ...current,
      x: drag.originX + (event.clientX - drag.x),
      y: drag.originY + (event.clientY - drag.y),
    }));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const selectNode = (state: EscrowLifecycleState) => {
    setSelected((current) => (current === state ? null : state));
  };

  return (
    <section
      data-testid="escrow-lifecycle-graph"
      className={`rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl sm:p-7 ${className}`}
      aria-labelledby="escrow-lifecycle-heading"
    >
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="escrow-lifecycle-heading" className="text-xl font-bold tracking-tight text-white">
            Escrow Lifecycle
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Visual state machine for this escrow, including the signatures required for the next transition.
          </p>
        </div>

        <button
          type="button"
          data-testid="lifecycle-toggle"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-controls="lifecycle-diagram-panel"
          className="self-start rounded-xl border border-slate-700 bg-slate-800/70 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-indigo-500/50 hover:text-white"
        >
          {collapsed ? 'Show interactive graph' : 'Compact summary'}
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            data-testid="lifecycle-current-state"
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold"
            style={{
              color: LIFECYCLE_COLORS[position.state],
              borderColor: `${LIFECYCLE_COLORS[position.state]}66`,
              backgroundColor: `${LIFECYCLE_COLORS[position.state]}1f`,
            }}
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full motion-safe:animate-pulse"
              style={{ backgroundColor: LIFECYCLE_COLORS[position.state] }}
            />
            {activeNode.label}
          </span>
          <span className="text-xs text-slate-400">
            Time in state: <span className="font-semibold text-slate-200">{formatLifecycleDuration(position.timeInStateMs)}</span>
          </span>
          <span className="text-xs text-slate-400">
            Milestones:{' '}
            <span className="font-semibold text-slate-200">
              {position.milestones.approved}/{position.milestones.total} approved
            </span>
          </span>
        </div>

        <span className="text-xs font-semibold text-slate-400">
          Step {Math.max(progressIndex + 1, 1)} of {LIFECYCLE_HAPPY_PATH.length}
        </span>
      </div>

      {collapsed ? (
        <div id="lifecycle-diagram-panel" data-testid="lifecycle-compact-summary" className="mt-6 space-y-4">
          <ol className="flex flex-wrap items-center gap-2">
            {LIFECYCLE_HAPPY_PATH.map((state, index) => {
              const node = getLifecycleNode(state);
              const isActive = state === position.state;
              const isComplete = progressIndex >= 0 && index < progressIndex;
              return (
                <li key={state} className="flex items-center gap-2">
                  <span
                    data-testid={`lifecycle-compact-step-${state}`}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                      isActive
                        ? 'border-transparent text-slate-950'
                        : isComplete
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-700 bg-slate-800/60 text-slate-500'
                    }`}
                    style={isActive ? { backgroundColor: LIFECYCLE_COLORS[state] } : undefined}
                  >
                    {node.label}
                  </span>
                  {index < LIFECYCLE_HAPPY_PATH.length - 1 && (
                    <span aria-hidden="true" className="text-slate-600">
                      →
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          {position.state === 'disputed' || position.state === 'refunded' ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
              Escrow is off the happy path: {activeNode.trigger}
            </p>
          ) : (
            <p className="text-xs text-slate-400">{activeNode.trigger}</p>
          )}

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Next transitions</p>
              <p className="mt-1 text-xs font-semibold text-slate-200">
                {position.nextStates.length
                  ? position.nextStates.map((state) => getLifecycleNode(state).label).join(' · ')
                  : 'Terminal state'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Required signers</p>
              <p className="mt-1 text-xs font-semibold text-slate-200">
                {position.nextStates.length
                  ? Array.from(
                      new Set(
                        ESCROW_LIFECYCLE_EDGES.filter((edge) => edge.from === position.state).flatMap(
                          (edge) => getLifecycleNode(edge.to).signers
                        )
                      )
                    )
                      .map((signer) => SIGNER_LABELS[signer])
                      .join(' · ')
                  : 'None'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">In review / disputed</p>
              <p className="mt-1 text-xs font-semibold text-slate-200">
                {position.milestones.submitted} submitted · {position.milestones.disputed} disputed
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div id="lifecycle-diagram-panel" className="mt-6">
          <div className="mb-3 flex items-center justify-end gap-1.5">
            <button
              type="button"
              data-testid="lifecycle-zoom-out"
              aria-label="Zoom out lifecycle graph"
              onClick={() => setView((current) => ({ ...current, scale: clampScale(current.scale - 0.15) }))}
              className="h-8 w-8 rounded-lg border border-slate-700 bg-slate-800/70 text-sm font-bold text-slate-200 hover:border-indigo-500/50"
            >
              −
            </button>
            <button
              type="button"
              data-testid="lifecycle-zoom-in"
              aria-label="Zoom in lifecycle graph"
              onClick={() => setView((current) => ({ ...current, scale: clampScale(current.scale + 0.15) }))}
              className="h-8 w-8 rounded-lg border border-slate-700 bg-slate-800/70 text-sm font-bold text-slate-200 hover:border-indigo-500/50"
            >
              +
            </button>
            <button
              type="button"
              data-testid="lifecycle-zoom-reset"
              onClick={() => setView({ scale: 1, x: 0, y: 0 })}
              className="h-8 rounded-lg border border-slate-700 bg-slate-800/70 px-2.5 text-[11px] font-semibold text-slate-200 hover:border-indigo-500/50"
            >
              Reset
            </button>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
            <svg
              data-testid="lifecycle-svg"
              data-scale={view.scale}
              role="img"
              aria-label={`Escrow lifecycle diagram. Current state: ${activeNode.label}.`}
              viewBox={`0 0 ${LIFECYCLE_VIEWBOX.width} ${LIFECYCLE_VIEWBOX.height}`}
              preserveAspectRatio="xMidYMid meet"
              className="h-auto w-full cursor-grab touch-none active:cursor-grabbing"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
              onPointerCancel={endDrag}
            >
              <defs>
                <marker id="lifecycle-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
                </marker>
                <marker id="lifecycle-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={LIFECYCLE_COLORS[position.state]} />
                </marker>
              </defs>

              <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
                {ESCROW_LIFECYCLE_EDGES.map((edge) => {
                  const from = nodeCenter(edge.from);
                  const to = nodeCenter(edge.to);
                  const isNext = edge.from === position.state;
                  return (
                    <g key={`${edge.from}-${edge.to}`}>
                      <line
                        data-testid={`lifecycle-edge-${edge.from}-${edge.to}`}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke={isNext ? LIFECYCLE_COLORS[position.state] : '#475569'}
                        strokeWidth={isNext ? 2.5 : 1.5}
                        strokeDasharray={isNext ? undefined : '6 5'}
                        opacity={isNext ? 0.9 : 0.55}
                        markerEnd={`url(#${isNext ? 'lifecycle-arrow-active' : 'lifecycle-arrow'})`}
                      >
                        <title>{edge.label}</title>
                      </line>
                      <text
                        x={(from.x + to.x) / 2}
                        y={(from.y + to.y) / 2 - 6}
                        textAnchor="middle"
                        className="fill-slate-500 text-[10px]"
                      >
                        {edge.label}
                      </text>
                    </g>
                  );
                })}

                {ESCROW_LIFECYCLE_NODES.map((node) => {
                  const isActive = node.id === position.state;
                  const isNext = position.nextStates.includes(node.id);
                  const color = LIFECYCLE_COLORS[node.id];
                  const isSelected = selected === node.id;
                  return (
                    <g
                      key={node.id}
                      data-testid={isActive ? `lifecycle-node-active-${node.id}` : `lifecycle-node-${node.id}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${node.label} state. ${node.trigger}`}
                      aria-pressed={isSelected}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectNode(node.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          selectNode(node.id);
                        }
                      }}
                      onMouseEnter={() => setHovered(node.id)}
                      onMouseLeave={() => setHovered((current) => (current === node.id ? null : current))}
                      onFocus={() => setHovered(node.id)}
                      onBlur={() => setHovered((current) => (current === node.id ? null : current))}
                      className="cursor-pointer outline-none"
                    >
                      <title>{`${node.label}: ${node.trigger}`}</title>
                      {isActive && (
                        <circle
                          cx={node.position.x + LIFECYCLE_NODE_WIDTH / 2}
                          cy={node.position.y + LIFECYCLE_NODE_HEIGHT / 2}
                          r={LIFECYCLE_NODE_WIDTH / 2 + 8}
                          fill={color}
                          opacity={0.14}
                          className="motion-safe:animate-pulse"
                        />
                      )}
                      <rect
                        x={node.position.x}
                        y={node.position.y}
                        width={LIFECYCLE_NODE_WIDTH}
                        height={LIFECYCLE_NODE_HEIGHT}
                        rx={14}
                        fill={isActive ? `${color}26` : '#0f172a'}
                        stroke={isActive ? color : isNext ? `${color}99` : '#334155'}
                        strokeWidth={isActive ? 2.5 : 1.5}
                        style={isActive ? { filter: `drop-shadow(0 0 10px ${color}80)` } : undefined}
                      />
                      <text
                        x={node.position.x + LIFECYCLE_NODE_WIDTH / 2}
                        y={node.position.y + 29}
                        textAnchor="middle"
                        className="text-[13px] font-bold"
                        fill={isActive ? color : '#e2e8f0'}
                      >
                        {node.label}
                      </text>
                      <text
                        x={node.position.x + LIFECYCLE_NODE_WIDTH / 2}
                        y={node.position.y + 48}
                        textAnchor="middle"
                        className="text-[10px]"
                        fill="#94a3b8"
                      >
                        {node.summary}
                      </text>
                      <text
                        x={node.position.x + LIFECYCLE_NODE_WIDTH / 2}
                        y={node.position.y + 63}
                        textAnchor="middle"
                        className="text-[9px] font-semibold uppercase"
                        fill={isActive ? color : '#64748b'}
                      >
                        {isActive ? 'You are here' : node.terminal ? 'Terminal' : node.signers.join(' + ')}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            <div
              data-testid="lifecycle-tooltip"
              className="pointer-events-none absolute inset-x-3 bottom-3 rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-sm sm:inset-x-auto sm:right-3 sm:w-80"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-white">{inspected.label}</p>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {inspected.terminal ? 'Terminal' : 'State details'}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">{inspected.trigger}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <dt className="uppercase tracking-wider text-slate-500">Signers</dt>
                  <dd className="mt-0.5 font-semibold text-slate-200">
                    {inspected.signers.map((signer) => SIGNER_LABELS[signer]).join(', ')}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wider text-slate-500">Conditions</dt>
                  <dd className="mt-0.5 font-semibold text-slate-200">{inspected.conditions[0]}</dd>
                </div>
              </dl>
              {inspected.conditions.length > 1 && (
                <p className="mt-1.5 text-[10px] text-slate-400">{inspected.conditions.slice(1).join(' · ')}</p>
              )}
              <p className="mt-2 text-[10px] text-indigo-300">
                {selected
                  ? 'Click the node again to return to the current state.'
                  : 'Click or focus a node to pin its details.'}
              </p>
            </div>
          </div>

          <p className="mt-2 text-[10px] text-slate-500">
            Drag to pan · use + / − to zoom · graph auto-scales to the viewport width.
          </p>
        </div>
      )}
    </section>
  );
}

export default EscrowLifecycleGraph;
