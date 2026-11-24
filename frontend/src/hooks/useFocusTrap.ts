'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

export interface UseFocusTrapOptions<T extends HTMLElement = HTMLElement> {
  /** Trap focus while true. */
  active: boolean;
  /** Called when Escape is pressed inside the trap. */
  onEscape?: () => void;
  /** Element to focus when the trap activates. Defaults to the first tabbable child. */
  initialFocusRef?: RefObject<T | null>;
  /** Return focus to the previously focused element on close. Defaults to true. */
  restoreFocus?: boolean;
}

/**
 * useFocusTrap (#309)
 *
 * Keeps keyboard focus inside a modal/dialog while it is open:
 * - Tab and Shift+Tab cycle through the dialog's tabbable elements.
 * - Escape triggers onEscape.
 * - Focus is restored to the triggering element when the trap deactivates.
 *
 * Returns the ref that must be attached to the dialog container.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>({
  active,
  onEscape,
  initialFocusRef,
  restoreFocus = true,
}: UseFocusTrapOptions<T>) {
  const containerRef = useRef<T | null>(null);
  // Keep the latest callbacks in refs so the trap does not re-activate on every render.
  const onEscapeRef = useRef(onEscape);
  const initialFocusRefLatest = useRef(initialFocusRef);
  onEscapeRef.current = onEscape;
  initialFocusRefLatest.current = initialFocusRef;

  useEffect(() => {
    if (!active || typeof document === 'undefined') return;

    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const getTabbable = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.getAttribute('aria-hidden') !== 'true'
      );

    const focusInitial = () => {
      const preferred = initialFocusRefLatest.current?.current;
      if (preferred && container.contains(preferred)) {
        preferred.focus();
        return;
      }
      const tabbable = getTabbable();
      (tabbable[0] ?? container).focus();
    };

    // Move focus into the dialog as soon as it appears.
    focusInitial();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onEscapeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const tabbable = getTabbable();
      if (tabbable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = tabbable[0];
      const last = tabbable[tabbable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || activeElement === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Listen on window (capture) so events dispatched on either window or
    // document are handled exactly once.
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (restoreFocus && previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active, restoreFocus]);

  return containerRef;
}

export default useFocusTrap;
