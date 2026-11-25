import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileBottomNav } from './MobileBottomNav';

describe('MobileBottomNav Component', () => {
  it('renders bottom navigation with all tabs and center action button', () => {
    render(<MobileBottomNav currentTab="projects" />);

    expect(screen.getByTestId('mobile-bottom-nav')).toBeDefined();
    expect(screen.getByTestId('tab-projects')).toBeDefined();
    expect(screen.getByTestId('tab-proposals')).toBeDefined();
    expect(screen.getByTestId('tab-notifications')).toBeDefined();
    expect(screen.getByTestId('tab-wallet')).toBeDefined();
    expect(screen.getByTestId('mobile-create-trigger')).toBeDefined();
  });

  it('triggers onTabChange when tab is clicked', () => {
    const handleTabChange = vi.fn();
    render(<MobileBottomNav currentTab="projects" onTabChange={handleTabChange} />);

    const proposalsTab = screen.getByTestId('tab-proposals');
    fireEvent.click(proposalsTab);

    expect(handleTabChange).toHaveBeenCalledWith('proposals');
  });

  it('opens and closes quick action drawer on center button click', () => {
    render(<MobileBottomNav currentTab="projects" />);

    // Initially drawer closed
    expect(screen.queryByTestId('mobile-action-drawer')).toBeNull();

    // Click center '+' button
    fireEvent.click(screen.getByTestId('mobile-create-trigger'));
    expect(screen.getByTestId('mobile-action-drawer')).toBeDefined();
    expect(screen.getByText('Quick Actions')).toBeDefined();
    expect(screen.getByText('Post New Escrow')).toBeDefined();

    // Click backdrop to close
    fireEvent.click(screen.getByTestId('mobile-drawer-backdrop'));
    expect(screen.queryByTestId('mobile-action-drawer')).toBeNull();
  });

  it('calls custom onCreateClick handler when provided', () => {
    const handleCreate = vi.fn();
    render(<MobileBottomNav onCreateClick={handleCreate} />);

    fireEvent.click(screen.getByTestId('mobile-create-trigger'));
    expect(handleCreate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('mobile-action-drawer')).toBeNull();
  });
});
