import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProposalExpirationBadge, formatTimeRemaining } from './ProposalExpirationBadge';

describe('formatTimeRemaining helper', () => {
  it('identifies future timestamps correctly', () => {
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000);
    const res = formatTimeRemaining(futureDate);

    expect(res.isExpired).toBe(false);
    expect(res.text).toContain('Quote expires in 2d');
  });

  it('identifies expired timestamps correctly', () => {
    const pastDate = new Date(Date.now() - 10000);
    const res = formatTimeRemaining(pastDate);

    expect(res.isExpired).toBe(true);
    expect(res.text).toBe('Quote expired');
  });
});

describe('ProposalExpirationBadge component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders countdown badge when expiresAt is in the future', () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    render(<ProposalExpirationBadge expiresAt={futureDate} />);

    expect(screen.getByTestId('proposal-countdown-badge')).toBeDefined();
    expect(screen.getByText(/quote expires in/i)).toBeDefined();
  });

  it('renders expired badge when expiresAt is in the past', () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    render(<ProposalExpirationBadge expiresAt={pastDate} />);

    expect(screen.getByTestId('proposal-expired-badge')).toBeDefined();
    expect(screen.getByText(/quote expired/i)).toBeDefined();
  });

  it('calls onExpire callback when date is already expired', () => {
    const onExpireMock = vi.fn();
    const pastDate = new Date(Date.now() - 10000).toISOString();
    render(<ProposalExpirationBadge expiresAt={pastDate} onExpire={onExpireMock} />);

    expect(onExpireMock).toHaveBeenCalled();
  });
});
