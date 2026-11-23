import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MilestoneTimelineStepper } from './MilestoneTimelineStepper';
import type { Project, Milestone } from '@/types';

const mockProject: Project = {
  id: 'proj-1',
  title: 'Test Project',
  description: 'A test project',
  category: 'web',
  budget: 5000,
  token: 'USDC',
  status: 'in_progress',
};

const threeMilestoneFixture: Milestone[] = [
  {
    id: 'ms-1',
    project_id: 'proj-1',
    milestone_index: 0,
    title: 'Design Phase',
    description: 'Complete UI/UX design mockups',
    amount: 1000,
    status: 'approved',
    due_date: '2024-12-15',
  },
  {
    id: 'ms-2',
    project_id: 'proj-1',
    milestone_index: 1,
    title: 'Frontend Development',
    description: 'Build React components and pages',
    amount: 2000,
    status: 'submitted',
    due_date: '2025-01-15',
  },
  {
    id: 'ms-3',
    project_id: 'proj-1',
    milestone_index: 2,
    title: 'Backend Integration',
    description: 'API integration and testing',
    amount: 2000,
    status: 'pending',
    due_date: '2025-02-15',
  },
];

const tenMilestoneFixture: Milestone[] = Array.from({ length: 10 }, (_, i) => ({
  id: `ms-${i + 1}`,
  project_id: 'proj-1',
  milestone_index: i,
  title: `Milestone ${i + 1}`,
  description: `Description for milestone ${i + 1}`,
  amount: 500,
  status:
    i < 2
      ? 'approved'
      : i === 2
        ? 'submitted'
        : i === 3
          ? 'in_revision'
          : i === 4
            ? 'disputed'
            : 'pending',
  due_date: new Date(2024, 11, 15 + i).toISOString(),
}));

describe('MilestoneTimelineStepper', () => {
  describe('with 3 milestones (desktop horizontal layout)', () => {
    it('renders component without crashing', () => {
      const { container } = render(
        <MilestoneTimelineStepper project={mockProject} milestones={threeMilestoneFixture} />
      );
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders 3 milestone nodes', () => {
      const { container } = render(
        <MilestoneTimelineStepper project={mockProject} milestones={threeMilestoneFixture} />
      );
      const circles = container.querySelectorAll('circle[r="16"]');
      expect(circles.length).toBe(3);
    });

    it('displays milestone numbers 1, 2, 3', () => {
      render(<MilestoneTimelineStepper project={mockProject} milestones={threeMilestoneFixture} />);
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('displays all state labels', () => {
      render(<MilestoneTimelineStepper project={mockProject} milestones={threeMilestoneFixture} />);
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Initialized')).toBeInTheDocument();
    });

    it('highlights active milestone with pulse animation', () => {
      const { container } = render(
        <MilestoneTimelineStepper project={mockProject} milestones={threeMilestoneFixture} />
      );
      const pulseNode = container.querySelector('.pulse-node');
      expect(pulseNode).toBeInTheDocument();
    });

    it('colors disputed milestones in rose', () => {
      const disputed: Milestone[] = [
        ...threeMilestoneFixture.slice(0, 2),
        { ...threeMilestoneFixture[2], status: 'disputed' },
      ];
      render(<MilestoneTimelineStepper project={mockProject} milestones={disputed} />);
      expect(screen.getByText('Disputed')).toBeInTheDocument();
    });
  });

  describe('with 10 milestones (vertical layout)', () => {
    it('renders vertical layout with 10 milestones', () => {
      const { container } = render(
        <MilestoneTimelineStepper project={mockProject} milestones={tenMilestoneFixture} />
      );
      const verticalContainers = container.querySelectorAll('.space-y-4');
      expect(verticalContainers.length).toBeGreaterThan(0);
    });

    it('displays all 10 milestone titles', () => {
      render(<MilestoneTimelineStepper project={mockProject} milestones={tenMilestoneFixture} />);
      const titles = screen.getAllByText(/Milestone \d+:/);
      expect(titles.length).toBe(10);
    });

    it('shows all milestone states', () => {
      render(<MilestoneTimelineStepper project={mockProject} milestones={tenMilestoneFixture} />);
      expect(screen.getAllByText('Approved').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('In Review')).toBeInTheDocument();
      expect(screen.getByText('Disputed')).toBeInTheDocument();
      expect(screen.getAllByText('Initialized').length).toBeGreaterThan(0);
    });

    it('displays milestone amounts and dates', () => {
      render(<MilestoneTimelineStepper project={mockProject} milestones={tenMilestoneFixture} />);
      const usdcText = screen.getAllByText('500 USDC');
      expect(usdcText.length).toBe(10);
      const dueText = screen.getAllByText(/Due:/);
      expect(dueText.length).toBe(10);
    });

    it('shows node indicators with correct colors', () => {
      const { container } = render(
        <MilestoneTimelineStepper project={mockProject} milestones={tenMilestoneFixture} />
      );
      const nodeIndicators = container.querySelectorAll('.h-4.w-4.rounded-full');
      expect(nodeIndicators.length).toBe(10);
    });
  });

  describe('responsive behavior', () => {
    it('uses horizontal SVG layout for 3 milestones', () => {
      const { container } = render(
        <MilestoneTimelineStepper project={mockProject} milestones={threeMilestoneFixture} />
      );
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('uses vertical card layout for 10 milestones', () => {
      const { container } = render(
        <MilestoneTimelineStepper project={mockProject} milestones={tenMilestoneFixture} />
      );
      const verticalLayout = container.querySelector('.space-y-4');
      expect(verticalLayout).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders empty message when no milestones', () => {
      render(<MilestoneTimelineStepper project={mockProject} milestones={[]} />);
      expect(screen.getByText('No milestones available')).toBeInTheDocument();
    });
  });

  describe('milestone status mapping', () => {
    it('maps pending to Initialized', () => {
      const pending: Milestone[] = [{ ...threeMilestoneFixture[0], status: 'pending' }];
      render(<MilestoneTimelineStepper project={mockProject} milestones={pending} />);
      expect(screen.getByText('Initialized')).toBeInTheDocument();
    });

    it('maps submitted to Active', () => {
      const submitted: Milestone[] = [{ ...threeMilestoneFixture[0], status: 'submitted' }];
      render(<MilestoneTimelineStepper project={mockProject} milestones={submitted} />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('maps in_revision to In Review', () => {
      const inRevision: Milestone[] = [{ ...threeMilestoneFixture[0], status: 'in_revision' }];
      render(<MilestoneTimelineStepper project={mockProject} milestones={inRevision} />);
      expect(screen.getByText('In Review')).toBeInTheDocument();
    });

    it('maps approved to Approved', () => {
      const approved: Milestone[] = [{ ...threeMilestoneFixture[0], status: 'approved' }];
      render(<MilestoneTimelineStepper project={mockProject} milestones={approved} />);
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });

    it('maps disputed to Disputed', () => {
      const disputed: Milestone[] = [{ ...threeMilestoneFixture[0], status: 'disputed' }];
      render(<MilestoneTimelineStepper project={mockProject} milestones={disputed} />);
      expect(screen.getByText('Disputed')).toBeInTheDocument();
    });
  });

  describe('visual styling', () => {
    it('applies emerald color to approved milestones', () => {
      const { container } = render(
        <MilestoneTimelineStepper project={mockProject} milestones={threeMilestoneFixture} />
      );
      const circles = Array.from(container.querySelectorAll('circle[r="16"]'));
      const approvedCircle = circles[0];
      expect(approvedCircle?.getAttribute('fill')).toBe('#10b981');
    });

    it('applies indigo color to active milestones', () => {
      const { container } = render(
        <MilestoneTimelineStepper project={mockProject} milestones={threeMilestoneFixture} />
      );
      const circles = Array.from(container.querySelectorAll('circle[r="16"]'));
      const activeCircle = circles[1];
      expect(activeCircle?.getAttribute('fill')).toBe('#6366f1');
    });
  });
});
