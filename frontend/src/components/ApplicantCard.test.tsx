import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplicantCard, ApplicantCardData } from './ApplicantCard';

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
    fireEvent.click(acceptButton);

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
    fireEvent.click(denyButton);

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
});
