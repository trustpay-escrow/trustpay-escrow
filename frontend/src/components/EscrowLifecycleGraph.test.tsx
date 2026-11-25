import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EscrowLifecycleGraph } from './EscrowLifecycleGraph';
import type { Project } from '@/types';

const baseProject: Project = {
  id: 'project-1',
  title: 'Soroban escrow redesign',
  description: '',
  category: 'Design',
  budget: 2400,
  token: 'USDC',
  status: 'draft',
  client_address: 'GCLIENT',
  freelancer_address: 'GFREELANCER',
  created_at: '2026-11-20T10:00:00.000Z',
};

function project(overrides: Partial<Project>): Project {
  return { ...baseProject, ...overrides };
}

describe('EscrowLifecycleGraph (#303)', () => {
  it.each<[string, Project, string]>([
    ['draft', project({ status: 'draft' }), 'draft'],
    ['funded (open with on-chain escrow)', project({ status: 'open', tx_hash: 'abc' }), 'funded'],
    ['in progress', project({ status: 'in_progress' }), 'in_progress'],
    [
      'in review when a milestone is submitted',
      project({
        status: 'in_progress',
        milestones: [
          {
            id: 'm1',
            milestone_index: 1,
            title: 'Wireframes',
            amount: 500,
            status: 'submitted',
            submitted_at: '2026-11-24T12:00:00.000Z',
          },
        ],
      }),
      'in_review',
    ],
    ['released', project({ status: 'completed' }), 'released'],
    ['disputed', project({ status: 'disputed' }), 'disputed'],
    ['refunded', project({ status: 'refunded' as Project['status'] }), 'refunded'],
  ])('renders the active node for %s', (_label, payload, expected) => {
    render(<EscrowLifecycleGraph project={payload} />);

    expect(screen.getByTestId(`lifecycle-node-active-${expected}`)).toBeInTheDocument();
    expect(screen.getByTestId('lifecycle-current-state')).toBeInTheDocument();
  });

  it('shows all lifecycle states and required-signature details', () => {
    render(<EscrowLifecycleGraph project={project({ status: 'in_progress' })} />);

    for (const state of ['draft', 'funded', 'in_progress', 'in_review', 'released', 'disputed', 'refunded']) {
      expect(
        screen.getByTestId(
          state === 'in_progress' ? 'lifecycle-node-active-in_progress' : `lifecycle-node-${state}`
        )
      ).toBeInTheDocument();
    }

    fireEvent.click(screen.getByTestId('lifecycle-node-disputed'));
    const tooltip = screen.getByTestId('lifecycle-tooltip');
    expect(tooltip).toHaveTextContent('Disputed');
    expect(tooltip).toHaveTextContent(/Either party raises a dispute/i);
    expect(tooltip).toHaveTextContent(/Client, Freelancer/);
  });

  it('toggles between the compact summary and the interactive diagram', () => {
    render(<EscrowLifecycleGraph project={project({ status: 'in_progress' })} />);

    expect(screen.getByTestId('lifecycle-svg')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('lifecycle-toggle'));
    expect(screen.queryByTestId('lifecycle-svg')).not.toBeInTheDocument();
    expect(screen.getByTestId('lifecycle-compact-summary')).toBeInTheDocument();
    expect(screen.getByTestId('lifecycle-compact-step-in_progress')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('lifecycle-toggle'));
    expect(screen.getByTestId('lifecycle-svg')).toBeInTheDocument();
  });

  it('supports zoom and pan controls', () => {
    render(<EscrowLifecycleGraph project={project({ status: 'open', tx_hash: 'abc' })} />);
    const svg = screen.getByTestId('lifecycle-svg');
    expect(svg).toHaveAttribute('data-scale', '1');

    fireEvent.click(screen.getByTestId('lifecycle-zoom-in'));
    expect(screen.getByTestId('lifecycle-svg')).toHaveAttribute('data-scale', '1.15');
    fireEvent.click(screen.getByTestId('lifecycle-zoom-out'));
    fireEvent.click(screen.getByTestId('lifecycle-zoom-reset'));
    expect(screen.getByTestId('lifecycle-svg')).toHaveAttribute('data-scale', '1');
  });

  it('auto-scales the SVG for mobile viewport widths', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    render(<EscrowLifecycleGraph project={project({ status: 'in_progress' })} />);

    const svg = screen.getByTestId('lifecycle-svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 1050 340');
    expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    expect(svg).toHaveClass('w-full');

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  });
});
