import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  GitRepoMilestoneConnector,
  CiStatusBadge,
  GitDeliverableBadge,
} from './GitRepoMilestoneConnector';

describe('GitRepoMilestoneConnector component', () => {
  it('renders initial input state and placeholder', () => {
    render(<GitRepoMilestoneConnector />);
    expect(screen.getByText('Git Deliverable Integration')).toBeDefined();
    expect(screen.getByPlaceholderText(/e\.g\. https:\/\/github\.com/i)).toBeDefined();
  });

  it('renders metadata, commit hash and CI status on valid PR URL', () => {
    const handleConnectorChange = vi.fn();
    render(
      <GitRepoMilestoneConnector
        initialUrl="https://github.com/stellar/soroban-example/pull/42"
        onConnectorChange={handleConnectorChange}
      />
    );

    expect(screen.getByText(/github verified/i)).toBeDefined();
    expect(screen.getAllByText(/#42/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Commit:/i)).toBeDefined();
    expect(screen.getByText(/View Diff/i)).toBeDefined();
    expect(handleConnectorChange).toHaveBeenCalledWith(
      expect.objectContaining({
        isValid: true,
        url: 'https://github.com/stellar/soroban-example/pull/42',
      })
    );
  });

  it('displays warning on invalid Git URL', () => {
    render(<GitRepoMilestoneConnector initialUrl="https://notagitrepo.com/hello" />);
    expect(screen.getByText(/Enter a valid GitHub\/GitLab PR/i)).toBeDefined();
  });

  it('toggles code diff summary on button click', () => {
    render(
      <GitRepoMilestoneConnector initialUrl="https://github.com/stellar/soroban-example/pull/42" />
    );

    const toggleBtn = screen.getByRole('button', { name: /View Diff/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText('frontend/src/contracts/escrow.rs')).toBeDefined();
    expect(screen.getByRole('button', { name: /Hide Diff/i })).toBeDefined();

    // Click again to hide
    fireEvent.click(screen.getByRole('button', { name: /Hide Diff/i }));
    expect(screen.queryByText('frontend/src/contracts/escrow.rs')).toBeNull();
  });

  it('renders CiStatusBadge variants properly', () => {
    const { rerender } = render(<CiStatusBadge status="passing" />);
    expect(screen.getByText(/CI Passing/i)).toBeDefined();

    rerender(<CiStatusBadge status="failing" />);
    expect(screen.getByText(/CI Failing/i)).toBeDefined();

    rerender(<CiStatusBadge status="pending" />);
    expect(screen.getByText(/CI Pending/i)).toBeDefined();
  });

  it('renders GitDeliverableBadge for milestone cards', () => {
    render(
      <GitDeliverableBadge
        url="https://github.com/stellar/soroban-example/pull/42"
        ciStatus="passing"
        commitHash="8a9b1c2"
      />
    );

    expect(screen.getByText(/GitHub PR #42/i)).toBeDefined();
    expect(screen.getByText(/\(8a9b1c2\)/)).toBeDefined();
    expect(screen.getByText(/CI Passing/i)).toBeDefined();
  });
});
