import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StatusBadge, STATUS_TOOLTIPS } from './StatusBadge';

describe('StatusBadge Component', () => {
  it('renders pending review status with amber pulse indicator dot', () => {
    render(<StatusBadge status="submitted" />);

    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveTextContent('Pending Review');
    expect(badge).toHaveClass('text-amber-400');

    const dot = screen.getByTestId('status-badge-dot');
    expect(dot).toHaveClass('w-1.5');
    expect(dot).toHaveClass('h-1.5');
    expect(dot).toHaveClass('bg-amber-400');
    expect(dot).toHaveClass('motion-safe:animate-pulse');
  });

  it('disables animation when disableAnimation is true (prefers-reduced-motion)', () => {
    render(<StatusBadge status="pending_review" disableAnimation={true} />);

    const dot = screen.getByTestId('status-badge-dot');
    expect(dot).not.toHaveClass('motion-safe:animate-pulse');
  });

  it('renders approved status in emerald without pulse animation', () => {
    render(<StatusBadge status="approved" />);

    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveTextContent('Approved');
    expect(badge).toHaveClass('text-emerald-400');

    const dot = screen.getByTestId('status-badge-dot');
    expect(dot).toHaveClass('bg-emerald-400');
    expect(dot).not.toHaveClass('motion-safe:animate-pulse');
  });

  it('renders revision requested status in rose without pulse animation', () => {
    render(<StatusBadge status="revision_requested" />);

    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveTextContent('Revision Requested');
    expect(badge).toHaveClass('text-rose-400');

    const dot = screen.getByTestId('status-badge-dot');
    expect(dot).toHaveClass('bg-rose-400');
    expect(dot).not.toHaveClass('motion-safe:animate-pulse');
  });

  it('shows and hides tooltip on mouse enter and leave', () => {
    render(<StatusBadge status="submitted" />);
    const badge = screen.getByTestId('status-badge');

    expect(screen.queryByTestId('status-badge-tooltip')).not.toBeInTheDocument();

    fireEvent.mouseEnter(badge);
    expect(screen.getByTestId('status-badge-tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge-tooltip')).toHaveTextContent(STATUS_TOOLTIPS.submitted);

    fireEvent.mouseLeave(badge);
    expect(screen.queryByTestId('status-badge-tooltip')).not.toBeInTheDocument();
  });

  it('displays correct tooltip text across all milestone states', () => {
    const states = [
      { status: 'pending', text: STATUS_TOOLTIPS.pending },
      { status: 'in_progress', text: STATUS_TOOLTIPS.in_progress },
      { status: 'submitted', text: STATUS_TOOLTIPS.submitted },
      { status: 'pending_review', text: STATUS_TOOLTIPS.pending_review },
      { status: 'approved', text: STATUS_TOOLTIPS.approved },
      { status: 'completed', text: STATUS_TOOLTIPS.completed },
      { status: 'revision_requested', text: STATUS_TOOLTIPS.revision_requested },
      { status: 'disputed', text: STATUS_TOOLTIPS.disputed },
    ];

    states.forEach(({ status, text }) => {
      const { unmount } = render(<StatusBadge status={status} />);
      const badge = screen.getByTestId('status-badge');
      fireEvent.mouseEnter(badge);
      expect(screen.getByTestId('status-badge-tooltip')).toHaveTextContent(text);
      unmount();
    });
  });

  it('supports keyboard accessibility with focus and blur', () => {
    render(<StatusBadge status="approved" />);
    const badge = screen.getByTestId('status-badge');

    fireEvent.focus(badge);
    expect(screen.getByTestId('status-badge-tooltip')).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-describedby');

    fireEvent.blur(badge);
    expect(screen.queryByTestId('status-badge-tooltip')).not.toBeInTheDocument();
  });

  it('handles click / mobile tap toggle and auto-dismiss after 3s', () => {
    vi.useFakeTimers();
    render(<StatusBadge status="disputed" />);
    const badge = screen.getByTestId('status-badge');

    fireEvent.click(badge);
    expect(screen.getByTestId('status-badge-tooltip')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByTestId('status-badge-tooltip')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
