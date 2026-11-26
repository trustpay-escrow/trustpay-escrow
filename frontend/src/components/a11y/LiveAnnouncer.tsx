'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type AnnouncementPoliteness = 'polite' | 'assertive';

interface AnnouncementEvent {
  message: string;
  politeness: AnnouncementPoliteness;
}

type AnnouncementListener = (event: AnnouncementEvent) => void;

const listeners = new Set<AnnouncementListener>();

/**
 * Imperatively announce a screen-reader status update through the mounted
 * root `LiveAnnouncerProvider`. Safe to call from event handlers or async flows.
 */
export function announce(message: string, politeness: AnnouncementPoliteness = 'polite'): void {
  const trimmed = message.trim();
  if (!trimmed) return;
  for (const listener of listeners) {
    listener({ message: trimmed, politeness });
  }
}

export function announcePolite(message: string): void {
  announce(message, 'polite');
}

export function announceAssertive(message: string): void {
  announce(message, 'assertive');
}

interface LiveAnnouncerContextValue {
  announce: (message: string, politeness?: AnnouncementPoliteness) => void;
  announcePolite: (message: string) => void;
  announceAssertive: (message: string) => void;
}

const LiveAnnouncerContext = createContext<LiveAnnouncerContextValue>({
  announce,
  announcePolite,
  announceAssertive,
});

export function useLiveAnnouncer(): LiveAnnouncerContextValue {
  return useContext(LiveAnnouncerContext);
}

/**
 * Permanently mounted, visually hidden ARIA live regions (`polite` and `assertive`).
 * Uses alternating dual slots per politeness level so consecutive identical messages
 * (e.g. "Address copied" twice) reliably re-announce without setTimeout races.
 */
export function LiveAnnouncerProvider({ children }: { children: React.ReactNode }) {
  const [politeSlots, setPoliteSlots] = useState<[string, string]>(['', '']);
  const [assertiveSlots, setAssertiveSlots] = useState<[string, string]>(['', '']);
  const politeTurnRef = React.useRef(0);
  const assertiveTurnRef = React.useRef(0);

  const handleAnnouncement = useCallback(({ message, politeness }: AnnouncementEvent) => {
    if (politeness === 'assertive') {
      const slot = assertiveTurnRef.current % 2;
      assertiveTurnRef.current += 1;
      setAssertiveSlots(slot === 0 ? [message, ''] : ['', message]);
    } else {
      const slot = politeTurnRef.current % 2;
      politeTurnRef.current += 1;
      setPoliteSlots(slot === 0 ? [message, ''] : ['', message]);
    }
  }, []);

  useEffect(() => {
    listeners.add(handleAnnouncement);
    return () => {
      listeners.delete(handleAnnouncement);
    };
  }, [handleAnnouncement]);

  return (
    <LiveAnnouncerContext.Provider value={{ announce, announcePolite, announceAssertive }}>
      {children}
      <div className="sr-only" data-testid="live-announcer">
        <div role="status" aria-live="polite" aria-atomic="true" data-testid="live-announcer-polite-0">
          {politeSlots[0]}
        </div>
        <div role="status" aria-live="polite" aria-atomic="true" data-testid="live-announcer-polite-1">
          {politeSlots[1]}
        </div>
        <div role="alert" aria-live="assertive" aria-atomic="true" data-testid="live-announcer-assertive-0">
          {assertiveSlots[0]}
        </div>
        <div role="alert" aria-live="assertive" aria-atomic="true" data-testid="live-announcer-assertive-1">
          {assertiveSlots[1]}
        </div>
      </div>
    </LiveAnnouncerContext.Provider>
  );
}
