import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MilestoneGanttChart } from './MilestoneGanttChart';
import type { Milestone } from '@/types';

const threeMilestones: Milestone[] = [
  {
    id: 'ms-1',
    milestone_index: 0,
    title: 'Discovery',
    amount: 1000,
    status: 'approved',
    start_date: '2026-01-01',
    due_date: '2026-01-11',
  },
  {
    id: 'ms-2',
    milestone_index: 1,
    title: 'Build',
    amount: 2000,
    status: 'submitted',
    start_date: '2026-01-12',
    due_date: '2026-02-01',
  },
  {
    id: 'ms-3',
    milestone_index: 2,
    title: 'Launch',
    amount: 1500,
    status: 'pending',
    start_date: '2026-02-02',
    due_date: '2026-02-12',
    depends_on: [1],
  },
];

const eightMilestones: Milestone[] = Array.from({ length: 8 }, (_, index) => ({
  id: `ms-${index + 1}`,
  milestone_index: index,
  title: `Milestone ${index + 1}`,
  amount: 500,
  status: index < 3 ? 'approved' : index === 3 ? 'submitted' : 'pending',
  start_date: `2026-03-${String(index * 3 + 1).padStart(2, '0')}`,
  due_date: `2026-03-${String(index * 3 + 2).padStart(2, '0')}`,
  depends_on: index > 0 ? [index - 1] : [],
}));

describe('MilestoneGanttChart', () => {
  it('renders one bar per milestone for a 3-milestone project', () => {
    render(
      <MilestoneGanttChart milestones={threeMilestones} today="2026-01-16" />
    );

    expect(screen.getByTestId('gantt-bar-0')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-bar-1')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-bar-2')).toBeInTheDocument();
    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.getByText('Build')).toBeInTheDocument();
    expect(screen.getByText('Launch')).toBeInTheDocument();
  });

  it('makes bar widths proportional to milestone duration', () => {
    render(
      <MilestoneGanttChart milestones={threeMilestones} today="2026-01-16" />
    );

    const first = parseFloat(screen.getByTestId('gantt-bar-0').style.width);
    const second = parseFloat(screen.getByTestId('gantt-bar-1').style.width);
    const third = parseFloat(screen.getByTestId('gantt-bar-2').style.width);

    expect(second / first).toBeCloseTo(2, 1);
    expect(second / third).toBeCloseTo(2, 1);
  });

  it('supports an 8-milestone project', () => {
    render(<MilestoneGanttChart milestones={eightMilestones} today="2026-03-10" />);

    for (let index = 0; index < 8; index += 1) {
      expect(screen.getByTestId(`gantt-bar-${index}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('gantt-bar-7')).toHaveAttribute('data-duration-days', '1');
  });

  it('draws dependency connectors between prerequisite and dependent milestones', () => {
    const { container } = render(
      <MilestoneGanttChart milestones={eightMilestones} today="2026-03-10" />
    );

    expect(container.querySelectorAll('[data-testid="gantt-dependency"]')).toHaveLength(7);
  });

  it('renders the current date marker and status legend', () => {
    render(<MilestoneGanttChart milestones={threeMilestones} today="2026-01-16" />);

    expect(screen.getByTestId('gantt-today-marker')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('switches between Days, Weeks, and Months zoom modes', () => {
    const longProject: Milestone[] = [
      { ...threeMilestones[0], start_date: '2026-01-01', due_date: '2026-02-15' },
      { ...threeMilestones[1], start_date: '2026-02-16', due_date: '2026-03-31' },
    ];
    render(
      <MilestoneGanttChart milestones={longProject} today="2026-01-16" initialZoom="weeks" />
    );

    const weeksWidth = parseFloat(screen.getByTestId('gantt-timeline').style.minWidth);

    fireEvent.click(screen.getByTestId('gantt-zoom-days'));
    expect(screen.getByTestId('gantt-zoom-days')).toHaveAttribute('aria-pressed', 'true');
    const daysWidth = parseFloat(screen.getByTestId('gantt-timeline').style.minWidth);

    fireEvent.click(screen.getByTestId('gantt-zoom-months'));
    const monthsWidth = parseFloat(screen.getByTestId('gantt-timeline').style.minWidth);

    expect(daysWidth).toBeGreaterThan(weeksWidth);
    expect(monthsWidth).toBeLessThan(weeksWidth);
  });

  it('emits rescheduled dates when a draft bar is dragged', async () => {
    const onReschedule = vi.fn();
    render(
      <MilestoneGanttChart
        milestones={threeMilestones}
        today="2026-01-16"
        editable
        onReschedule={onReschedule}
      />
    );

    const bar = screen.getByTestId('gantt-bar-0');
    fireEvent.pointerDown(bar, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(bar, { clientX: 180, pointerId: 1 });
    fireEvent.pointerUp(bar, { clientX: 180, pointerId: 1 });

    await waitFor(() => expect(onReschedule).toHaveBeenCalledTimes(1));
    const [, startDate, dueDate] = onReschedule.mock.calls[0];
    expect(startDate).toBe('2026-01-11');
    expect(dueDate).toBe('2026-01-21');
  });

  it('does not reschedule when the chart is read-only', () => {
    const onReschedule = vi.fn();
    render(
      <MilestoneGanttChart
        milestones={threeMilestones}
        today="2026-01-16"
        onReschedule={onReschedule}
      />
    );

    const bar = screen.getByTestId('gantt-bar-0');
    fireEvent.pointerDown(bar, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(bar, { clientX: 200, pointerId: 1 });
    fireEvent.pointerUp(bar, { clientX: 200, pointerId: 1 });

    expect(onReschedule).not.toHaveBeenCalled();
  });

  it('shows an empty state without milestones', () => {
    render(<MilestoneGanttChart milestones={[]} />);
    expect(screen.getByTestId('milestone-gantt-chart')).toHaveTextContent(
      'No milestones to visualize yet.'
    );
  });
});
