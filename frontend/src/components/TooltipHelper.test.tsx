import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TooltipHelper } from './TooltipHelper';

describe('TooltipHelper Component', () => {
  it('renders trigger button and shows popover on hover', () => {
    render(
      <TooltipHelper
        title="Soroban TTL"
        explanation="Time-To-Live storage lifecycle on Stellar."
        docsUrl="https://developers.stellar.org"
      />
    );

    const trigger = screen.getByTestId('tooltip-helper-trigger');
    expect(trigger).toBeDefined();

    // Initially closed
    expect(screen.queryByTestId('tooltip-helper-popover')).toBeNull();

    // Hover container
    fireEvent.mouseEnter(trigger.parentElement!);
    const popover = screen.getByTestId('tooltip-helper-popover');
    expect(popover).toBeDefined();
    expect(screen.getByText('Soroban TTL')).toBeDefined();
    expect(screen.getByText('Time-To-Live storage lifecycle on Stellar.')).toBeDefined();

    // Mouse leave
    fireEvent.mouseLeave(trigger.parentElement!);
    expect(screen.queryByTestId('tooltip-helper-popover')).toBeNull();
  });

  it('toggles popover on click for touch/mobile devices', () => {
    render(
      <TooltipHelper
        termKey="sac-tokens"
      />
    );

    const trigger = screen.getByTestId('tooltip-helper-trigger');

    // Click to open
    fireEvent.click(trigger);
    expect(screen.getByTestId('tooltip-helper-popover')).toBeDefined();
    expect(screen.getByText('SAC Tokens')).toBeDefined();

    // Click to close
    fireEvent.click(trigger);
    expect(screen.queryByTestId('tooltip-helper-popover')).toBeNull();
  });

  it('renders documentation link with external safety attributes', () => {
    render(
      <TooltipHelper
        title="Blend Yield"
        explanation="Earn yield through Blend lending pools."
        docsUrl="https://blend.capital"
      />
    );

    const trigger = screen.getByTestId('tooltip-helper-trigger');
    fireEvent.click(trigger);

    const link = screen.getByTestId('tooltip-helper-docs-link') as HTMLAnchorElement;
    expect(link.href).toBe('https://blend.capital/');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it('closes tooltip on escape key press', () => {
    render(
      <TooltipHelper
        title="Timelock Auto-Release"
        explanation="Automatic release of funds."
      />
    );

    const trigger = screen.getByTestId('tooltip-helper-trigger');
    fireEvent.click(trigger);
    expect(screen.getByTestId('tooltip-helper-popover')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('tooltip-helper-popover')).toBeNull();
  });
});
