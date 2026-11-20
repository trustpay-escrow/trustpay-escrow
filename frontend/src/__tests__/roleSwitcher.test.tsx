import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock localStorage for Zustand persist middleware
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = String(value);
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  }),
  length: 0,
  key: vi.fn((i: number) => Object.keys(mockStorage)[i] || null),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

import { RoleSwitcher } from '@/components/RoleSwitcher';
import { useWalletStore } from '@/store/walletStore';

describe('RoleSwitcher Component (Issue #135)', () => {
  beforeEach(() => {
    useWalletStore.setState({
      address: 'GBZX...44AL',
      activeRole: 'client',
      isClient: true,
      isFreelancer: true,
      isArbiter: true,
    });
  });

  it('renders all three role options: Client, Freelancer, Arbiter', () => {
    render(<RoleSwitcher />);
    expect(screen.getByTestId('role-btn-client')).toBeDefined();
    expect(screen.getByTestId('role-btn-freelancer')).toBeDefined();
    expect(screen.getByTestId('role-btn-arbiter')).toBeDefined();
  });

  it('indicates the active role with aria-selected="true"', () => {
    render(<RoleSwitcher />);
    const clientBtn = screen.getByTestId('role-btn-client');
    const freelancerBtn = screen.getByTestId('role-btn-freelancer');
    const arbiterBtn = screen.getByTestId('role-btn-arbiter');

    expect(clientBtn.getAttribute('aria-selected')).toBe('true');
    expect(freelancerBtn.getAttribute('aria-selected')).toBe('false');
    expect(arbiterBtn.getAttribute('aria-selected')).toBe('false');
  });

  it('switches activeRole in store when Freelancer is clicked', () => {
    render(<RoleSwitcher />);
    const freelancerBtn = screen.getByTestId('role-btn-freelancer');
    fireEvent.click(freelancerBtn);

    expect(useWalletStore.getState().activeRole).toBe('freelancer');
  });

  it('switches activeRole in store when Arbiter is clicked', () => {
    render(<RoleSwitcher />);
    const arbiterBtn = screen.getByTestId('role-btn-arbiter');
    fireEvent.click(arbiterBtn);

    expect(useWalletStore.getState().activeRole).toBe('arbiter');
  });

  it('displays role description when showDescriptions is enabled', () => {
    render(<RoleSwitcher showDescriptions={true} />);
    expect(screen.getByText(/Post jobs, fund escrows, and approve milestones/i)).toBeDefined();
  });
});
