import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState Component', () => {
  it('renders default empty projects state with icon and CTA', () => {
    render(<EmptyState type="projects" />);

    expect(screen.getByTestId('empty-state-card')).toBeDefined();
    expect(screen.getByTestId('empty-projects-icon')).toBeDefined();
    expect(screen.getByText('No Active Escrow Projects')).toBeDefined();
    expect(screen.getByText('Post Your First Escrow')).toBeDefined();
  });

  it('renders empty proposals state with custom copy', () => {
    render(
      <EmptyState
        type="proposals"
        title="Zero Freelance Proposals"
        description="No developers have submitted a proposal yet."
      />
    );

    expect(screen.getByTestId('empty-proposals-icon')).toBeDefined();
    expect(screen.getByText('Zero Freelance Proposals')).toBeDefined();
    expect(screen.getByText('No developers have submitted a proposal yet.')).toBeDefined();
  });

  it('renders notifications empty state with custom button action', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        type="notifications"
        actionLabel="Refresh Notifications"
        onAction={handleAction}
      />
    );

    expect(screen.getByTestId('empty-notifications-icon')).toBeDefined();
    const btn = screen.getByTestId('empty-state-primary-action');
    expect(btn.textContent).toBe('Refresh Notifications');

    fireEvent.click(btn);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('renders secondary action button when provided', () => {
    const handleSecondary = vi.fn();
    render(
      <EmptyState
        type="generic"
        secondaryActionLabel="Documentation"
        onSecondaryAction={handleSecondary}
      />
    );

    const secBtn = screen.getByTestId('empty-state-secondary-action');
    expect(secBtn.textContent).toBe('Documentation');
    fireEvent.click(secBtn);
    expect(handleSecondary).toHaveBeenCalledTimes(1);
  });
});
