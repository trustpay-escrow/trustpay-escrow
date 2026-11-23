import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TruncatedText } from './TruncatedText';

describe('TruncatedText Component', () => {
  const shortText = 'This is a brief one-line description.';
  const longText = `This is a comprehensive multi-paragraph description of an escrow project.
It covers several deliverables, milestones, and testing requirements across Soroban contracts.
The scope involves smart contract verification, deployment, client-side validation, and tests.
Each milestone is individually locked and released through multisig approvals.
Additionally, arbiters can be assigned to resolve conflicts between the buyer and seller.
All funds are escrowed safely until milestones are signed off.`;

  it('renders short text without Read More toggle button', () => {
    render(<TruncatedText text={shortText} />);
    expect(screen.getByText(shortText)).toBeDefined();
    expect(screen.queryByTestId('truncate-toggle-btn')).toBeNull();
  });

  it('renders long text with Read More toggle button', () => {
    render(<TruncatedText text={longText} />);
    const button = screen.getByTestId('truncate-toggle-btn');
    expect(button).toBeDefined();
    expect(button.textContent).toBe('Read More');
  });

  it('toggles expanded state to Show Less and back to Read More on click', () => {
    render(<TruncatedText text={longText} />);
    const button = screen.getByTestId('truncate-toggle-btn');
    const content = screen.getByTestId('truncated-text-content');

    expect(content.className).toContain('line-clamp-3');
    expect(button.textContent).toBe('Read More');

    // Click to expand
    fireEvent.click(button);
    expect(button.textContent).toBe('Show Less');
    expect(content.className).not.toContain('line-clamp-3');
    expect(button.getAttribute('aria-expanded')).toBe('true');

    // Click to collapse
    fireEvent.click(button);
    expect(button.textContent).toBe('Read More');
    expect(content.className).toContain('line-clamp-3');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('preserves line breaks when expanded', () => {
    render(<TruncatedText text={longText} />);
    const content = screen.getByTestId('truncated-text-content');
    expect(content.className).toContain('whitespace-pre-line');
  });
});
