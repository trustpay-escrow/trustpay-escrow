import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ApplicantCard, ApplicantCardData } from './ApplicantCard';
import { ReputationStats } from '@/types';

describe('ApplicantCard Component', () => {
  const mockApplicant: ApplicantCardData = {
    id: 'app-999',
    stellar_address: 'GAUBK6P5Z7I7ZXZZ6D7XQWJ7M2U3H7T5W7O6X7Y8Z9A1B2C3D4E5F6G7',
    cover_note: 'Extensive Soroban smart contract development experience.',
    status: 'pending',
  };

  it('renders the freelancer stellar address and cover note', () => {
    render(
      <ApplicantCard
        applicant={mockApplicant}
        onAccept={vi.fn()}
        onDeny={vi.fn()}
      />
    );

    expect(screen.getByText('GAUBK6P5Z7I7ZXZZ6D7XQWJ7M2U3H7T5W7O6X7Y8Z9A1B2C3D4E5F6G7')).toBeInTheDocument();
    expect(screen.getByText(/Extensive Soroban smart contract development experience/i)).toBeInTheDocument();
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
  });

  it('renders the stellar address in the shared monospace style', () => {
    render(
      <ApplicantCard
        applicant={mockApplicant}
        onAccept={vi.fn()}
        onDeny={vi.fn()}
      />
    );

    const address = screen.getByText('GAUBK6P5Z7I7ZXZZ6D7XQWJ7M2U3H7T5W7O6X7Y8Z9A1B2C3D4E5F6G7');
    expect(address).toHaveAttribute('data-crypto-id');
    expect(address).toHaveClass('font-mono', 'tracking-tight', 'text-xs', 'sm:text-sm');
  });

  it('calls onAccept with applicant ID when Accept button is clicked', async () => {
    const onAcceptMock = vi.fn();
    render(
      <ApplicantCard
        applicant={mockApplicant}
        onAccept={onAcceptMock}
        onDeny={vi.fn()}
      />
    );

    const acceptButton = screen.getByRole('button', { name: /accept application/i });
    await act(async () => {
      fireEvent.click(acceptButton);
    });

    expect(onAcceptMock).toHaveBeenCalledWith('app-999');
  });

  it('calls onDeny with applicant ID when Deny button is clicked', async () => {
    const onDenyMock = vi.fn();
    render(
      <ApplicantCard
        applicant={mockApplicant}
        onAccept={vi.fn()}
        onDeny={onDenyMock}
      />
    );

    const denyButton = screen.getByRole('button', { name: /deny application/i });
    await act(async () => {
      fireEvent.click(denyButton);
    });

    expect(onDenyMock).toHaveBeenCalledWith('app-999');
  });

  it('renders accepted badge when proposal is accepted', () => {
    const acceptedApplicant: ApplicantCardData = {
      ...mockApplicant,
      status: 'accepted',
      granted: true,
    };

    render(
      <ApplicantCard
        applicant={acceptedApplicant}
        onAccept={vi.fn()}
        onDeny={vi.fn()}
      />
    );

    expect(screen.getByText('Accepted')).toBeInTheDocument();
  });

  it('disables accept button and shows Quote Expired when proposal is expired', () => {
    const expiredApplicant: ApplicantCardData = {
      ...mockApplicant,
      expires_at: new Date(Date.now() - 3600000).toISOString(),
    };

    render(
      <ApplicantCard
        applicant={expiredApplicant}
        onAccept={vi.fn()}
        onDeny={vi.fn()}
      />
    );

    const acceptButton = screen.getByRole('button', { name: /quote expired/i });
    expect(acceptButton).toBeDisabled();
    expect(screen.getByTestId('proposal-expired-badge')).toBeInTheDocument();
  });

  it('renders countdown badge when expires_at is in the future', () => {
    const futureApplicant: ApplicantCardData = {
      ...mockApplicant,
      expires_at: new Date(Date.now() + 86400000 * 3).toISOString(),
    };

    render(
      <ApplicantCard
        applicant={futureApplicant}
        onAccept={vi.fn()}
        onDeny={vi.fn()}
      />
    );

    expect(screen.getByTestId('proposal-countdown-badge')).toBeInTheDocument();
  });

  it('calls onWithdraw when withdraw button is clicked', () => {
    const onWithdrawMock = vi.fn();
    render(
      <ApplicantCard
        applicant={mockApplicant}
        onAccept={vi.fn()}
        onDeny={vi.fn()}
        onWithdraw={onWithdrawMock}
      />
    );

    const withdrawBtn = screen.getByRole('button', { name: /withdraw proposal/i });
    fireEvent.click(withdrawBtn);

    expect(onWithdrawMock).toHaveBeenCalledWith('app-999');
  });

  describe('Reputation Profile & Tier Badge Display on Applicant Cards', () => {
    it('verifies badge display for Gold Tier applicant', () => {
      const goldApplicant: ApplicantCardData = {
        ...mockApplicant,
        reputationTier: 'Gold',
      };

      render(
        <ApplicantCard
          applicant={goldApplicant}
          onAccept={vi.fn()}
          onDeny={vi.fn()}
        />
      );

      const badges = screen.getAllByTestId('reputation-tier-badge');
      expect(badges.length).toBeGreaterThan(0);
      expect(badges[0]).toHaveTextContent('Gold Tier');
    });

    it('verifies badge display for Silver Tier applicant', () => {
      const silverApplicant: ApplicantCardData = {
        ...mockApplicant,
        reputationTier: 'Silver',
      };

      render(
        <ApplicantCard
          applicant={silverApplicant}
          onAccept={vi.fn()}
          onDeny={vi.fn()}
        />
      );

      const badges = screen.getAllByTestId('reputation-tier-badge');
      expect(badges[0]).toHaveTextContent('Silver Tier');
    });

    it('verifies badge display for Bronze Tier applicant', () => {
      const bronzeApplicant: ApplicantCardData = {
        ...mockApplicant,
        reputationTier: 'Bronze',
      };

      render(
        <ApplicantCard
          applicant={bronzeApplicant}
          onAccept={vi.fn()}
          onDeny={vi.fn()}
        />
      );

      const badges = screen.getAllByTestId('reputation-tier-badge');
      expect(badges[0]).toHaveTextContent('Bronze Tier');
    });

    it('verifies badge display for Verified Newcomer applicant', () => {
      const newcomerApplicant: ApplicantCardData = {
        ...mockApplicant,
        reputationTier: 'Verified Newcomer',
      };

      render(
        <ApplicantCard
          applicant={newcomerApplicant}
          onAccept={vi.fn()}
          onDeny={vi.fn()}
        />
      );

      const badges = screen.getAllByTestId('reputation-tier-badge');
      expect(badges[0]).toHaveTextContent('Verified Newcomer');
    });

    it('renders dispute warning banner on applicant card when applicant has elevated dispute ratio (>20%)', () => {
      const highDisputeStats: ReputationStats = {
        address: 'GDISPUTED_APPLICANT',
        total_escrows: 10,
        completed_escrows: 7,
        disputed_escrows: 3,
        completion_rate: 70,
        dispute_rate: 30,
        dispute_free_ratio: 70,
        avg_approval_time_hours: 48,
        avg_turnaround_days: 2,
        total_volume_usdc: 5000,
        tier: 'Bronze',
        has_high_dispute_warning: true,
        historical_transactions_url:
          'https://stellar.expert/explorer/testnet/account/GDISPUTED_APPLICANT',
      };

      const highDisputeApplicant: ApplicantCardData = {
        ...mockApplicant,
        stellar_address: 'GDISPUTED_APPLICANT',
        reputation: highDisputeStats,
      };

      render(
        <ApplicantCard
          applicant={highDisputeApplicant}
          onAccept={vi.fn()}
          onDeny={vi.fn()}
        />
      );

      expect(screen.getByTestId('dispute-warning-banner')).toBeInTheDocument();
      expect(screen.getByText(/High Dispute Warning/i)).toBeInTheDocument();
      expect(screen.getByText(/30%/i)).toBeInTheDocument();
    });

    it('renders on-chain explorer history link on applicant card', () => {
      const verifiedStats: ReputationStats = {
        address: 'GVERIFIED_APPLICANT',
        total_escrows: 12,
        completed_escrows: 12,
        disputed_escrows: 0,
        completion_rate: 100,
        dispute_rate: 0,
        dispute_free_ratio: 100,
        avg_approval_time_hours: 20,
        avg_turnaround_days: 0.8,
        total_volume_usdc: 15000,
        tier: 'Gold',
        has_high_dispute_warning: false,
        historical_transactions_url:
          'https://stellar.expert/explorer/testnet/account/GVERIFIED_APPLICANT',
      };

      const verifiedApplicant: ApplicantCardData = {
        ...mockApplicant,
        stellar_address: 'GVERIFIED_APPLICANT',
        reputation: verifiedStats,
      };

      render(
        <ApplicantCard
          applicant={verifiedApplicant}
          onAccept={vi.fn()}
          onDeny={vi.fn()}
        />
      );

      const onChainLink = screen.getByRole('link', { name: /on-chain history/i });
      expect(onChainLink).toBeInTheDocument();
      expect(onChainLink).toHaveAttribute(
        'href',
        'https://stellar.expert/explorer/testnet/account/GVERIFIED_APPLICANT'
      );
    });
  });
});
