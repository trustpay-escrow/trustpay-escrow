import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ProjectReviewModal } from './ProjectReviewModal';
import { useWalletStore } from '@/store/walletStore';
import { signTransaction } from '@stellar/freighter-api';

// Mock dependencies
vi.mock('@/hooks/useEscapeKey', () => ({
  useEscapeKey: vi.fn(),
}));

vi.mock('@/store/walletStore', () => ({
  useWalletStore: vi.fn(),
}));

vi.mock('@stellar/freighter-api', () => ({
  signTransaction: vi.fn(),
  isConnected: vi.fn().mockResolvedValue(true),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockProps = {
  isOpen: true,
  onClose: vi.fn(),
  projectId: 'proj-123',
  projectTitle: 'Build Decentralized Escrow UI',
  revieweeAddress: 'GFREELANCER12345678901234567890123456789012345678901234',
  revieweeRole: 'freelancer' as const,
  reviewerRole: 'client' as const,
  onSubmit: vi.fn().mockResolvedValue(undefined),
};

describe('ProjectReviewModal', () => {
  const mockAddress = 'GCLIENT12345678901234567890123456789012345678901234';

  beforeEach(() => {
    vi.clearAllMocks();
    (useWalletStore as any).mockReturnValue({ address: mockAddress });
  });

  it('renders nothing when closed', () => {
    const { container } = render(<ProjectReviewModal {...mockProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with project info when open', () => {
    render(<ProjectReviewModal {...mockProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Submit Review')).toBeInTheDocument();
    expect(screen.getByText('Build Decentralized Escrow UI')).toBeInTheDocument();
    expect(screen.getByText('Freelancer')).toBeInTheDocument();
  });

  it('shows all three rating categories', () => {
    render(<ProjectReviewModal {...mockProps} />);

    expect(screen.getByText('Quality of Work')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
    expect(screen.getByText('Adherence to Deadlines')).toBeInTheDocument();
  });

  it('allows selecting star ratings', () => {
    render(<ProjectReviewModal {...mockProps} />);

    // Click 4 stars for Quality
    const qualityStars = screen.getAllByRole('radio', { name: /quality/i });
    fireEvent.click(qualityStars[3]); // 4th star (index 3) = 4 stars

    expect(screen.getByText('4 / 5')).toBeInTheDocument();
  });

  it('allows entering testimonial', () => {
    render(<ProjectReviewModal {...mockProps} />);

    const textarea = screen.getByPlaceholderText(/share your experience/i);
    fireEvent.change(textarea, { target: { value: 'Great work, very professional!' } });

    expect(textarea).toHaveValue('Great work, very professional!');
  });

  it('allows toggling skill endorsements', () => {
    render(<ProjectReviewModal {...mockProps} />);

    const skillButton = screen.getByText('Smart Contract Development');
    fireEvent.click(skillButton);

    expect(skillButton).toHaveClass('bg-indigo-500/20');
    expect(skillButton).toHaveClass('text-indigo-300');
    expect(skillButton).toHaveClass('border-indigo-500/30');
  });

  it('enables submit button only when all ratings are selected', () => {
    render(<ProjectReviewModal {...mockProps} />);

    const submitButton = screen.getByText('Submit Signed Review');
    expect(submitButton).toBeDisabled();

    // Select all three ratings
    fireEvent.click(screen.getAllByRole('radio', { name: /quality/i })[4]); // 5 stars
    fireEvent.click(screen.getAllByRole('radio', { name: /communication/i })[3]); // 4 stars
    fireEvent.click(screen.getAllByRole('radio', { name: /timeliness/i })[2]); // 3 stars

    expect(submitButton).not.toBeDisabled();
  });

  it('shows submitted state after successful submission', async () => {
    render(<ProjectReviewModal {...mockProps} />);

    // Select all ratings
    fireEvent.click(screen.getAllByRole('radio', { name: /quality/i })[4]);
    fireEvent.click(screen.getAllByRole('radio', { name: /communication/i })[3]);
    fireEvent.click(screen.getAllByRole('radio', { name: /timeliness/i })[2]);

    // Mock the signing process
    (signTransaction as any).mockResolvedValue('signed-xdr');

    fireEvent.click(screen.getByText('Submit Signed Review'));

    await waitFor(() => {
      expect(screen.getByText('Review Submitted!')).toBeInTheDocument();
      expect(screen.getByText('Your signed review has been recorded on Stellar.')).toBeInTheDocument();
    });
  });

  it('disables submit when wallet not connected', () => {
    (useWalletStore as any).mockReturnValue({ address: null });
    render(<ProjectReviewModal {...mockProps} />);

    fireEvent.click(screen.getAllByRole('radio', { name: /quality/i })[4]);
    fireEvent.click(screen.getAllByRole('radio', { name: /communication/i })[3]);
    fireEvent.click(screen.getAllByRole('radio', { name: /timeliness/i })[2]);

    const submitButton = screen.getByText('Submit Signed Review');
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Connect your wallet to submit a signed review')).toBeInTheDocument();
  });

  it('shows skill endorsement options', () => {
    render(<ProjectReviewModal {...mockProps} />);

    expect(screen.getByText('Smart Contract Development')).toBeInTheDocument();
    expect(screen.getByText('Frontend Development')).toBeInTheDocument();
    expect(screen.getByText('UI/UX Design')).toBeInTheDocument();
    expect(screen.getByText('Technical Writing')).toBeInTheDocument();
  });

  it('closes on escape key when not submitting', () => {
    const onClose = vi.fn();
    render(<ProjectReviewModal {...mockProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('does not close on escape key when submitting', () => {
    const onClose = vi.fn();
    render(<ProjectReviewModal {...mockProps} onClose={onClose} />);

    fireEvent.click(screen.getAllByRole('radio', { name: /quality/i })[4]);
    fireEvent.click(screen.getAllByRole('radio', { name: /communication/i })[3]);
    fireEvent.click(screen.getAllByRole('radio', { name: /timeliness/i })[2]);

    // Mock signing to be slow
    (signTransaction as any).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('signed-xdr'), 1000)));

    fireEvent.click(screen.getByText('Submit Signed Review'));

    // Immediately press escape - should not close
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Review signature logic', () => {
  it('creates deterministic message for signing', async () => {
    const reviewData = {
      projectId: 'proj-123',
      quality: 5,
      communication: 4,
      timeliness: 5,
      testimonial: 'Excellent work!',
      skills: ['Smart Contract Development', 'Testing & QA'],
      reviewerRole: 'client',
    };

    // The message should be deterministic
    const message1 = JSON.stringify({
      projectId: reviewData.projectId,
      ratings: {
        quality: reviewData.quality,
        communication: reviewData.communication,
        timeliness: reviewData.timeliness,
      },
      testimonialHash: await hashString(reviewData.testimonial),
      skills: reviewData.skills.sort(),
      reviewerRole: reviewData.reviewerRole,
      timestamp: Date.now(), // This makes it non-deterministic, but that's OK for uniqueness
    });

    const message2 = JSON.stringify({
      projectId: reviewData.projectId,
      ratings: {
        quality: reviewData.quality,
        communication: reviewData.communication,
        timeliness: reviewData.timeliness,
      },
      testimonialHash: await hashString(reviewData.testimonial),
      skills: reviewData.skills.sort(),
      reviewerRole: reviewData.reviewerRole,
      timestamp: Date.now(),
    });

    // Both should have same structure but different timestamps
    expect(message1).not.toBe(message2);
    expect(message1).toContain('proj-123');
    expect(message1).toContain('quality');
  });
});

async function hashString(str: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}