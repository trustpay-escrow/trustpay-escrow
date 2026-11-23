import { describe, expect, it } from 'vitest';
import {
  addUtcDays,
  buildGanttLayout,
  computeBarWidthPct,
  diffInDays,
  toUtcDate,
} from './gantt';

const milestone = (
  index: number,
  start: string,
  due: string,
  status: string,
  dependsOn: number[] = []
) => ({
  id: `ms-${index + 1}`,
  milestone_index: index,
  title: `Milestone ${index + 1}`,
  start_date: start,
  due_date: due,
  status,
  depends_on: dependsOn,
});

const threeMilestones = [
  milestone(0, '2026-01-01', '2026-01-11', 'approved'),
  milestone(1, '2026-01-12', '2026-02-01', 'submitted'),
  milestone(2, '2026-02-02', '2026-02-12', 'pending', [1]),
];

const eightMilestones = Array.from({ length: 8 }, (_, index) =>
  milestone(
    index,
    `2026-03-${String(index * 3 + 1).padStart(2, '0')}`,
    `2026-03-${String(index * 3 + 2).padStart(2, '0')}`,
    index < 3 ? 'approved' : 'pending',
    index > 0 ? [index - 1] : []
  )
);

describe('gantt date helpers', () => {
  it('works in UTC and ignores time components', () => {
    const date = toUtcDate('2026-01-01T23:45:00-05:00');
    expect(date?.toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });

  it('adds days and calculates differences', () => {
    const start = toUtcDate('2026-01-01')!;
    const end = addUtcDays(start, 14);
    expect(diffInDays(end, start)).toBe(14);
  });

  it('computes proportional bar widths and clamps bad values', () => {
    expect(computeBarWidthPct(10, 100)).toBe(10);
    expect(computeBarWidthPct(100, 100)).toBe(100);
    expect(computeBarWidthPct(0, 0)).toBe(0);
  });
});

describe('buildGanttLayout', () => {
  it('builds one proportional bar per milestone for a 3-milestone project', () => {
    const layout = buildGanttLayout({
      milestones: threeMilestones,
      zoom: 'weeks',
      today: '2026-01-16',
    });

    expect(layout.bars).toHaveLength(3);
    expect(layout.bars.map((bar) => bar.durationDays)).toEqual([10, 20, 10]);
    expect(layout.bars[1].widthPct).toBeCloseTo(layout.bars[0].widthPct * 2, 5);
    expect(layout.bars.every((bar) => bar.widthPct > 0)).toBe(true);
    expect(layout.todayPct).not.toBeNull();
  });

  it('supports an 8-milestone project and connects every dependency', () => {
    const layout = buildGanttLayout({ milestones: eightMilestones, zoom: 'weeks' });
    expect(layout.bars).toHaveLength(8);
    expect(layout.dependencies).toHaveLength(7);
    expect(layout.dependencies[0].fromIndex).toBe(0);
    expect(layout.dependencies[0].toIndex).toBe(1);
    expect(layout.bars.every((bar) => bar.widthPct > 0 && bar.widthPct <= 100)).toBe(true);
  });

  it('ignores dependencies that point at missing milestones', () => {
    const layout = buildGanttLayout({
      milestones: [milestone(0, '2026-01-01', '2026-01-03', 'pending', [99])],
      zoom: 'weeks',
    });
    expect(layout.dependencies).toHaveLength(0);
  });

  it('uses a denser timeline for days than months', () => {
    const days = buildGanttLayout({ milestones: threeMilestones, zoom: 'days' });
    const weeks = buildGanttLayout({ milestones: threeMilestones, zoom: 'weeks' });
    const months = buildGanttLayout({ milestones: threeMilestones, zoom: 'months' });

    expect(days.pxPerDay).toBeGreaterThan(weeks.pxPerDay);
    expect(weeks.pxPerDay).toBeGreaterThan(months.pxPerDay);
    expect(days.minWidth).toBeGreaterThan(months.minWidth);
    expect(days.ticks.length).toBeGreaterThan(months.ticks.length);
  });

  it('produces ticks that start at the beginning of the padded range', () => {
    const layout = buildGanttLayout({ milestones: threeMilestones, zoom: 'weeks' });
    expect(layout.rangeStart).toBe('2025-12-29');
    expect(layout.ticks[0].leftPct).toBeGreaterThanOrEqual(0);
    expect(layout.ticks[0].leftPct).toBeLessThan(100);
  });

  it('falls back safely for milestones without dates', () => {
    const layout = buildGanttLayout({
      milestones: [{ milestone_index: 0, title: 'Undated', status: 'pending' }],
      zoom: 'weeks',
      today: '2026-05-01',
    });
    expect(layout.bars).toHaveLength(1);
    expect(layout.bars[0].durationDays).toBeGreaterThanOrEqual(1);
    expect(layout.totalDays).toBeGreaterThan(0);
  });
});
