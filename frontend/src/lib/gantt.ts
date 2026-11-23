/**
 * Pure date/layout maths for the interactive milestone Gantt chart (#154).
 *
 * Everything is computed in UTC so the chart does not shift by a day for
 * users west of UTC. The layout is expressed in percentages of a single
 * scrollable timeline, which keeps bars proportional to their real duration.
 */

export type GanttZoom = 'days' | 'weeks' | 'months';

export interface GanttMilestoneLike {
  id?: string;
  milestone_index?: number;
  title?: string;
  status?: string;
  amount?: number;
  start_date?: string;
  due_date?: string;
  /** Milestone indexes that must finish before this milestone can start. */
  depends_on?: number[];
}

export interface GanttBar {
  milestone: GanttMilestoneLike;
  index: number;
  start: string;
  end: string;
  durationDays: number;
  leftPct: number;
  widthPct: number;
  row: number;
}

export interface GanttDependency {
  fromIndex: number;
  toIndex: number;
  fromRow: number;
  toRow: number;
  fromLeftPct: number;
  toLeftPct: number;
}

export interface GanttTick {
  date: string;
  label: string;
  leftPct: number;
}

export interface GanttLayout {
  zoom: GanttZoom;
  rangeStart: string;
  rangeEnd: string;
  totalDays: number;
  pxPerDay: number;
  minWidth: number;
  ticks: GanttTick[];
  bars: GanttBar[];
  dependencies: GanttDependency[];
  todayPct: number | null;
}

export const GANTT_ZOOM_CONFIG: Record<
  GanttZoom,
  { label: string; pxPerDay: number; rangeDaysForDayTicks: number }
> = {
  days: { label: 'Days', pxPerDay: 28, rangeDaysForDayTicks: 45 },
  weeks: { label: 'Weeks', pxPerDay: 8, rangeDaysForDayTicks: 0 },
  months: { label: 'Months', pxPerDay: 3, rangeDaysForDayTicks: 0 },
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function toUtcDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
  );
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function diffInDays(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / DAY_MS);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatGanttDate(date: Date, includeYear = false): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

/** Clamp a bar's width to the timeline range and never return a zero-width bar. */
export function computeBarWidthPct(durationDays: number, totalDays: number): number {
  if (!Number.isFinite(durationDays) || !Number.isFinite(totalDays) || totalDays <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (durationDays / totalDays) * 100));
}

export function normalizeMilestones(milestones: GanttMilestoneLike[]): GanttMilestoneLike[] {
  return [...milestones].sort((a, b) => {
    const aIndex = typeof a.milestone_index === 'number' ? a.milestone_index : 0;
    const bIndex = typeof b.milestone_index === 'number' ? b.milestone_index : 0;
    return aIndex - bIndex;
  });
}

function resolveBarDates(
  milestone: GanttMilestoneLike,
  fallbackStart: Date
): { start: Date; end: Date } {
  const explicitStart = toUtcDate(milestone.start_date);
  const due = toUtcDate(milestone.due_date);
  const start = explicitStart || (due ? addUtcDays(due, -7) : fallbackStart);
  const end = due && due.getTime() > start.getTime() ? due : addUtcDays(start, 1);
  return { start, end };
}

function buildTicks(rangeStart: Date, totalDays: number, zoom: GanttZoom): GanttTick[] {
  const ticks: GanttTick[] = [];

  if (zoom === 'days') {
    const step = totalDays > GANTT_ZOOM_CONFIG.days.rangeDaysForDayTicks ? 7 : 1;
    for (let offset = 0; offset <= totalDays; offset += step) {
      const date = addUtcDays(rangeStart, offset);
      ticks.push({
        date: toIsoDate(date),
        label: formatGanttDate(date),
        leftPct: (offset / totalDays) * 100,
      });
    }
    return ticks;
  }

  if (zoom === 'weeks') {
    // Align ticks to Mondays so week labels are stable while scrolling.
    const day = rangeStart.getUTCDay();
    const toMonday = (8 - day) % 7;
    let date = addUtcDays(rangeStart, toMonday);
    while (diffInDays(date, rangeStart) <= totalDays) {
      const offset = diffInDays(date, rangeStart);
      ticks.push({
        date: toIsoDate(date),
        label: formatGanttDate(date),
        leftPct: (offset / totalDays) * 100,
      });
      date = addUtcDays(date, 7);
    }
    return ticks;
  }

  let date = startOfUtcMonth(rangeStart);
  if (date.getTime() < rangeStart.getTime()) {
    date = addUtcMonths(date, 1);
  }
  while (diffInDays(date, rangeStart) <= totalDays) {
    const offset = Math.max(0, diffInDays(date, rangeStart));
    ticks.push({
      date: toIsoDate(date),
      label: date.toLocaleDateString('en-US', {
        month: 'short',
        ...(date.getUTCMonth() === 0 ? { year: 'numeric' } : {}),
        timeZone: 'UTC',
      }),
      leftPct: (offset / totalDays) * 100,
    });
    date = addUtcMonths(date, 1);
  }
  return ticks;
}

export interface BuildGanttLayoutOptions {
  milestones: GanttMilestoneLike[];
  zoom?: GanttZoom;
  today?: Date | string;
  /** Optional project bounds used to leave breathing room around the bars. */
  projectStart?: string;
  projectEnd?: string;
}

export function buildGanttLayout({
  milestones,
  zoom = 'weeks',
  today = new Date(),
  projectStart,
  projectEnd,
}: BuildGanttLayoutOptions): GanttLayout {
  const ordered = normalizeMilestones(milestones);
  const todayDate = toUtcDate(today) || toUtcDate(new Date())!;
  const projectStartDate = toUtcDate(projectStart);
  const projectEndDate = toUtcDate(projectEnd);

  const dates: Date[] = [];
  if (projectStartDate) dates.push(projectStartDate);
  if (projectEndDate) dates.push(projectEndDate);

  const preliminary = ordered.map((milestone) => resolveBarDates(milestone, todayDate));
  preliminary.forEach(({ start, end }) => {
    dates.push(start, end);
  });
  if (dates.length === 0) {
    dates.push(todayDate, addUtcDays(todayDate, 14));
  }

  const earliest = new Date(Math.min(...dates.map((date) => date.getTime())));
  const latest = new Date(Math.max(...dates.map((date) => date.getTime())));

  const rangeStart = addUtcDays(earliest, -3);
  const rangeEnd = addUtcDays(latest, 3);
  const totalDays = Math.max(1, diffInDays(rangeEnd, rangeStart));
  const { pxPerDay } = GANTT_ZOOM_CONFIG[zoom] || GANTT_ZOOM_CONFIG.weeks;

  const bars: GanttBar[] = ordered.map((milestone, index) => {
    const { start, end } = preliminary[index];
    const clampedStart = Math.max(start.getTime(), rangeStart.getTime());
    const clampedEnd = Math.min(end.getTime(), rangeEnd.getTime());
    const safeStart = new Date(Math.min(clampedStart, clampedEnd - DAY_MS));
    const safeEnd = new Date(clampedEnd);
    const durationDays = Math.max(1, diffInDays(safeEnd, safeStart));
    const offsetDays = diffInDays(safeStart, rangeStart);

    return {
      milestone,
      index,
      start: toIsoDate(safeStart),
      end: toIsoDate(safeEnd),
      durationDays,
      leftPct: Math.max(0, Math.min(100, (offsetDays / totalDays) * 100)),
      widthPct: computeBarWidthPct(durationDays, totalDays),
      row: index,
    };
  });

  const barByIndex = new Map(bars.map((bar) => [bar.index, bar]));
  const dependencies: GanttDependency[] = [];
  bars.forEach((bar) => {
    (bar.milestone.depends_on || []).forEach((dependencyIndex) => {
      const prerequisite = barByIndex.get(dependencyIndex);
      if (!prerequisite) return;
      dependencies.push({
        fromIndex: prerequisite.index,
        toIndex: bar.index,
        fromRow: prerequisite.row,
        toRow: bar.row,
        fromLeftPct: prerequisite.leftPct + prerequisite.widthPct,
        toLeftPct: bar.leftPct,
      });
    });
  });

  const todayOffset = diffInDays(todayDate, rangeStart);
  const todayPct =
    todayOffset >= 0 && todayOffset <= totalDays ? (todayOffset / totalDays) * 100 : null;

  return {
    zoom,
    rangeStart: toIsoDate(rangeStart),
    rangeEnd: toIsoDate(rangeEnd),
    totalDays,
    pxPerDay,
    minWidth: Math.max(640, Math.ceil(totalDays * pxPerDay)),
    ticks: buildTicks(rangeStart, totalDays, zoom),
    bars,
    dependencies,
    todayPct,
  };
}
