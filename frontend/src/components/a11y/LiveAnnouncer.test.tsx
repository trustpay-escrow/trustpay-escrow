import React from 'react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiveAnnouncerProvider, useLiveAnnouncer, announcePolite, announceAssertive } from './LiveAnnouncer';

function AnnouncerTrigger() {
  const { announce } = useLiveAnnouncer();
  return (
    <div>
      <button type="button" onClick={() => announce('Milestone 1 submitted', 'polite')}>
        Announce Polite
      </button>
      <button type="button" onClick={() => announce('Transaction rejected', 'assertive')}>
        Announce Assertive
      </button>
      <button type="button" onClick={() => announcePolite('Proposal accepted')}>
        Imperative Polite
      </button>
      <button type="button" onClick={() => announceAssertive('Escrow error')}>
        Imperative Assertive
      </button>
    </div>
  );
}

describe('LiveAnnouncerProvider', () => {
  it('mounts polite and assertive sr-only live regions and alternates slots for repeated identical messages', () => {
    render(
      <LiveAnnouncerProvider>
        <AnnouncerTrigger />
      </LiveAnnouncerProvider>
    );

    const politeSlotA = screen.getByTestId('live-announcer-polite-0');
    const politeSlotB = screen.getByTestId('live-announcer-polite-1');
    const assertiveSlotA = screen.getByTestId('live-announcer-assertive-0');

    expect(politeSlotA).toHaveAttribute('aria-live', 'polite');
    expect(politeSlotA).toHaveAttribute('role', 'status');
    expect(assertiveSlotA).toHaveAttribute('aria-live', 'assertive');
    expect(assertiveSlotA).toHaveAttribute('role', 'alert');

    // First polite announcement populates slot A
    fireEvent.click(screen.getByRole('button', { name: 'Announce Polite' }));
    expect(politeSlotA).toHaveTextContent('Milestone 1 submitted');
    expect(politeSlotB).toHaveTextContent('');

    // Repeating identical text populates slot B so screen readers re-announce it
    fireEvent.click(screen.getByRole('button', { name: 'Announce Polite' }));
    expect(politeSlotA).toHaveTextContent('');
    expect(politeSlotB).toHaveTextContent('Milestone 1 submitted');

    // Assertive announcement populates assertive region
    fireEvent.click(screen.getByRole('button', { name: 'Announce Assertive' }));
    expect(assertiveSlotA).toHaveTextContent('Transaction rejected');

    // Imperative helpers also route to the mounted provider
    fireEvent.click(screen.getByRole('button', { name: 'Imperative Polite' }));
    expect(politeSlotA).toHaveTextContent('Proposal accepted');
  });
});
