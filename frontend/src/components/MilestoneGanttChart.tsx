'use client';

import React, { useMemo, useState } from 'react';
import type { Milestone } from '@/types';
import {
  GanttMilestoneLike,
  GanttZoom,
  GANTT_ZOOM_CONFIG,
  addUtcDays,
  buildGanttLayout,
  formatGanttDate,
  toIsoDate,
  toUtcDate,
} from '@/lib/gantt';

export interface MilestoneGanttChartProps {
  milestones: Milestone[];
  /** Optional project bounds used to keep a stable timeline for empty edges. */
  projectStart?: string;
  projectEnd?: string;
  tokenSymbol?: string;
  /** Drag-to-reschedule is only allowed for draft projects. */
  editable?: boolean;
  initialZoom?: GanttZoom;
  today?: string | Date;
  onReschedule?: (milestone: Milestone, startDate: string, dueDate: string) => void;
  className?: string;
}

interface DragState {
  index: number;
  startX: number;
  deltaDays: number;
}

const ROW_HEIGHT = 44;
const BAR_HEIGHT = 30;
const BAR_TOP_OFFSET = 8;

const STATUS_STYLES: Record<
  string,
  { label: string; bar: string; border: string; dot: string }
> = {
  approved: {
    label: 'Approved',
    bar: 'bg-emerald-500/80',
    border: 'border-emerald-400/60',
    dot: 'bg-emerald-400',
  },
  submitted: {
    label: 'In Progress',
    bar: 'bg-blue-500/80',
    border: 'border-blue-400/60',
    dot: 'bg-blue-400',
  },
  in_revision: {
    label: 'In Revision',
    bar: 'bg-amber-500/80',
    border: 'border-amber-400/60',
    dot: 'bg-amber-400',
  },
  disputed: {
    label: 'Disputed',
    bar: 'bg-rose-500/80',
    border: 'border-rose-400/60',
    dot: 'bg-rose-400',
  },
  pending: {
    label: 'Pending',
    bar: 'bg-zinc-600/80',
    border: 'border-zinc-500/60',
    dot: 'bg-zinc-400',
  },
};

function statusStyle(status?: string) {
  return STATUS_STYLES[status || 'pending'] || STATUS_STYLES.pending;
}

function shiftDate(dateIso: string, days: number): string {
  const date = toUtcDate(dateIso);
  if (!date) return dateIso;
  return toIsoDate(addUtcDays(date, days));
}

/**
 * Interactive SVG/CSS milestone roadmap (#154).
 *
 * - Proportional bars for every milestone duration
 * - Status colours and current-date marker
 * - Dependency connectors between prerequisite and dependent milestones
 * - Days / Weeks / Months zoom modes
 * - Pointer drag (and arrow keys) to reschedule bars on draft projects
 */
export function MilestoneGanttChart({
  milestones,
  projectStart,
  projectEnd,
  tokenSymbol = 'USDC',
  editable = false,
  initialZoom = 'weeks',
  today,
  onReschedule,
  className = '',
}: MilestoneGanttChartProps) {
  const [zoom, setZoom] = useState<GanttZoom>(initialZoom);
  const [drag, setDrag] = useState<DragState | null>(null);

  const layout = useMemo(
    () =>
      buildGanttLayout({
        milestones: milestones as GanttMilestoneLike[],
        zoom,
        today: today || new Date(),
        projectStart,
        projectEnd,
      }),
    [milestones, zoom, today, projectStart, projectEnd]
  );

  const chartHeight = Math.max(ROW_HEIGHT, layout.bars.length * ROW_HEIGHT);

  const commitReschedule = (index: number, deltaDays: number) => {
    const bar = layout.bars.find((item) => item.index === index);
    if (!bar || !onReschedule || deltaDays === 0) return;
    onReschedule(
      bar.milestone as Milestone,
      shiftDate(bar.start, deltaDays),
      shiftDate(bar.end, deltaDays)
    );
  };

  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    index: number
  ) => {
    if (!editable || !onReschedule) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({ index, startX: event.clientX, deltaDays: 0 });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const deltaDays = Math.round((event.clientX - drag.startX) / layout.pxPerDay);
    if (deltaDays !== drag.deltaDays) {
      setDrag({ ...drag, deltaDays });
    }
  };

  const handlePointerUp = () => {
    if (!drag) return;
    commitReschedule(drag.index, drag.deltaDays);
    setDrag(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    if (!editable || !onReschedule) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    commitReschedule(index, event.key === 'ArrowRight' ? 1 : -1);
  };

  if (milestones.length === 0) {
    return (
      <section
        data-testid="milestone-gantt-chart"
        aria-label="Milestone roadmap"
        className={`rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center text-sm text-slate-400 ${className}`}
      >
        No milestones to visualize yet.
      </section>
    );
  }

  return (
    <section
      data-testid="milestone-gantt-chart"
      aria-label="Milestone roadmap"
      className={`rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 shadow-xl ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 pb-4">
        <div>
          <h3 className="text-sm font-bold text-white sm:text-base">Milestone roadmap</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {formatGanttDate(new Date(layout.rangeStart), true)} –{' '}
            {formatGanttDate(new Date(layout.rangeEnd), true)} · {layout.totalDays} days
            {editable && <span className="ml-1 text-indigo-300">· drag a bar to reschedule</span>}
          </p>
        </div>

        <div
          className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/70 p-1"
          role="group"
          aria-label="Timeline zoom"
        >
          {(Object.keys(GANTT_ZOOM_CONFIG) as GanttZoom[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setZoom(mode)}
              aria-pressed={zoom === mode}
              data-testid={`gantt-zoom-${mode}`}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                zoom === mode
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {GANTT_ZOOM_CONFIG[mode].label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 pb-3 text-[11px] text-slate-400">
        {Object.entries(STATUS_STYLES).map(([status, style]) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} aria-hidden="true" />
            {style.label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <div style={{ minWidth: `${layout.minWidth}px` }} data-testid="gantt-timeline">
          {/* Time axis */}
          <div className="relative h-7 border-b border-slate-800" data-testid="gantt-axis">
            {layout.ticks.map((tick) => (
              <span
                key={`${tick.date}-${tick.leftPct}`}
                data-testid="gantt-tick"
                className="absolute top-0 whitespace-nowrap border-l border-slate-800 pl-1 text-[10px] font-medium text-slate-500"
                style={{ left: `${tick.leftPct}%` }}
              >
                {tick.label}
              </span>
            ))}
          </div>

          <div className="relative" style={{ height: `${chartHeight}px` }}>
            {/* Vertical grid lines from axis ticks */}
            {layout.ticks.map((tick) => (
              <span
                key={`grid-${tick.date}-${tick.leftPct}`}
                aria-hidden="true"
                className="absolute top-0 h-full border-l border-slate-800/60"
                style={{ left: `${tick.leftPct}%` }}
              />
            ))}

            {/* Current date marker */}
            {layout.todayPct !== null && (
              <div
                data-testid="gantt-today-marker"
                className="pointer-events-none absolute top-0 h-full border-l-2 border-dashed border-rose-400/80"
                style={{ left: `${layout.todayPct}%` }}
              >
                <span className="absolute -top-0.5 -translate-x-1/2 rounded bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  Today
                </span>
              </div>
            )}

            {/* Dependency connectors */}
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              viewBox={`0 0 100 ${chartHeight}`}
              preserveAspectRatio="none"
              data-testid="gantt-dependencies"
            >
              {layout.dependencies.map((dependency) => {
                const fromY = dependency.fromRow * ROW_HEIGHT + BAR_TOP_OFFSET + BAR_HEIGHT / 2;
                const toY = dependency.toRow * ROW_HEIGHT + BAR_TOP_OFFSET + BAR_HEIGHT / 2;
                const midX = Math.max(dependency.fromLeftPct, dependency.toLeftPct) + 0.8;
                return (
                  <g key={`${dependency.fromIndex}-${dependency.toIndex}`}>
                    <path
                      d={`M ${dependency.fromLeftPct} ${fromY} H ${midX} V ${toY} H ${dependency.toLeftPct}`}
                      fill="none"
                      stroke="rgb(99 102 241 / 0.7)"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                      vectorEffect="non-scaling-stroke"
                      data-testid="gantt-dependency"
                    />
                    <circle
                      cx={dependency.toLeftPct}
                      cy={toY}
                      r="2"
                      fill="rgb(129 140 248)"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Milestone bars */}
            {layout.bars.map((bar) => {
              const style = statusStyle(bar.milestone.status);
              const isDragging = drag?.index === bar.index;
              const offsetPx = isDragging ? drag.deltaDays * layout.pxPerDay : 0;
              const startLabel = bar.start;
              const endLabel = bar.end;

              return (
                <div
                  key={bar.milestone.id || bar.index}
                  data-testid={`gantt-bar-${bar.index}`}
                  data-duration-days={bar.durationDays}
                  role="button"
                  tabIndex={editable ? 0 : -1}
                  aria-label={`${bar.milestone.title || `Milestone ${bar.index + 1}`}: ${startLabel} to ${endLabel}, ${style.label}`}
                  title={`${bar.milestone.title || `Milestone ${bar.index + 1}`}\n${startLabel} → ${endLabel}\n${bar.milestone.amount ?? ''} ${tokenSymbol} · ${style.label}`}
                  onPointerDown={(event) => handlePointerDown(event, bar.index)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={() => setDrag(null)}
                  onKeyDown={(event) => handleKeyDown(event, bar.index)}
                  className={`absolute flex items-center rounded-lg border px-2 text-[11px] font-semibold text-white shadow-md transition-shadow ${style.bar} ${style.border} ${
                    editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                  } ${isDragging ? 'z-10 ring-2 ring-white/70' : ''}`}
                  style={{
                    left: `calc(${bar.leftPct}% + ${offsetPx}px)`,
                    width: `${bar.widthPct}%`,
                    minWidth: '8px',
                    top: `${bar.row * ROW_HEIGHT + BAR_TOP_OFFSET}px`,
                    height: `${BAR_HEIGHT}px`,
                  }}
                >
                  <span className="truncate drop-shadow-sm">
                    {bar.milestone.title || `Milestone ${bar.index + 1}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {editable && (
        <p className="mt-3 text-[11px] text-slate-500" data-testid="gantt-drag-hint">
          Draft timeline: drag a milestone bar or use ← / → to change its dates.
        </p>
      )}
    </section>
  );
}

export default MilestoneGanttChart;
