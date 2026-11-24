import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { A11yLiveAnnouncer, useA11yAnnouncer } from './A11yLiveAnnouncer';

function AnnouncerHarness() {
  const { announce } = useA11yAnnouncer();
  return (
    <div>
      <button type="button" onClick={() => announce('Transaction confirmed')}>
        Polite
      </button>
      <button type="button" onClick={() => announce('Transaction failed', 'assertive')}>
        Assertive
      </button>
    </div>
  );
}

describe('A11yLiveAnnouncer (#309)', () => {
  it('renders polite and assertive ARIA live regions', () => {
    render(
      <A11yLiveAnnouncer>
        <AnnouncerHarness />
      </A11yLiveAnnouncer>
    );

    expect(screen.getByTestId('a11y-live-polite')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('a11y-live-assertive')).toHaveAttribute('aria-live', 'assertive');
  });

  it('announces blockchain status changes in the matching region', () => {
    render(
      <A11yLiveAnnouncer>
        <AnnouncerHarness />
      </A11yLiveAnnouncer>
    );

    fireEvent.click(screen.getByText('Polite'));
    expect(screen.getByTestId('a11y-live-polite')).toHaveTextContent('Transaction confirmed');

    fireEvent.click(screen.getByText('Assertive'));
    expect(screen.getByTestId('a11y-live-assertive')).toHaveTextContent('Transaction failed');
  });

  it('degrades to a no-op without a provider', () => {
    expect(() => render(<AnnouncerHarness />)).not.toThrow();
    fireEvent.click(screen.getByText('Polite'));
  });
});
