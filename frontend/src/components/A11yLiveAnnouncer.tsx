'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type A11yPoliteness = 'polite' | 'assertive';

export interface A11yAnnouncer {
  /** Sends a message to the screen-reader live region. */
  announce: (message: string, politeness?: A11yPoliteness) => void;
}

const A11yAnnouncerContext = createContext<A11yAnnouncer | null>(null);

const noopAnnouncer: A11yAnnouncer = { announce: () => {} };

/**
 * useA11yAnnouncer
 *
 * Returns the nearest live announcer. When rendered outside of
 * <A11yLiveAnnouncer> it degrades to a no-op instead of throwing, so isolated
 * component tests and storybook-style previews keep working.
 */
export function useA11yAnnouncer(): A11yAnnouncer {
  return useContext(A11yAnnouncerContext) ?? noopAnnouncer;
}

interface AnnouncementState {
  message: string;
  nonce: number;
}

/**
 * A11yLiveAnnouncer (#309)
 *
 * Provides two polite/assertive ARIA live regions used to announce async
 * escrow state changes (submitting, confirmed, failed) to screen readers.
 * Repeating the same message bumps a nonce so assistive tech re-announces it.
 */
export function A11yLiveAnnouncer({ children }: { children?: React.ReactNode }) {
  const [polite, setPolite] = useState<AnnouncementState>({ message: '', nonce: 0 });
  const [assertive, setAssertive] = useState<AnnouncementState>({ message: '', nonce: 0 });

  const announce = useCallback((message: string, politeness: A11yPoliteness = 'polite') => {
    const trimmed = (message || '').trim();
    if (!trimmed) return;

    const update = (previous: AnnouncementState): AnnouncementState => ({
      message: trimmed,
      nonce: previous.nonce + 1,
    });

    if (politeness === 'assertive') {
      setAssertive(update);
    } else {
      setPolite(update);
    }
  }, []);

  const value = useMemo<A11yAnnouncer>(() => ({ announce }), [announce]);

  return (
    <A11yAnnouncerContext.Provider value={value}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="a11y-live-polite">
        <span key={`polite-${polite.nonce}`}>{polite.message}</span>
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true" data-testid="a11y-live-assertive">
        <span key={`assertive-${assertive.nonce}`}>{assertive.message}</span>
      </div>
    </A11yAnnouncerContext.Provider>
  );
}

export default A11yLiveAnnouncer;
