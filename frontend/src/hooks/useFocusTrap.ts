'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// Track open focus traps (oldest -> newest) so stacked modals (e.g. a lightbox
// opened inside a form modal) only trap Tab inside the topmost dialog.
const activeTrapStack: HTMLElement[] = [];

function isElementFocusable(el: HTMLElement, container?: HTMLElement): boolean {
  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
    return false;
  }
  if (el.tabIndex < 0) return false;
  if (el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  if (el.closest('fieldset[disabled]') && !el.closest('legend:first-of-type')) return false;

  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;

    let parent = el.parentElement;
    while (parent && parent !== container) {
      if (window.getComputedStyle(parent).display === 'none') return false;
      parent = parent.parentElement;
    }
  }
  return true;
}

/**
 * Returns keyboard-tabbable elements within `container` in DOM order.
 * Safe in both real browsers and jsdom (does not rely on offsetParent/layout rects).
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => isElementFocusable(el, container)
  );

  const checkedRadios = new Map<string, HTMLInputElement>();
  const firstRadios = new Map<string, HTMLInputElement>();

  for (const el of candidates) {
    if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
      if (!firstRadios.has(el.name)) firstRadios.set(el.name, el);
      if (el.checked) checkedRadios.set(el.name, el);
    }
  }

  return candidates.filter((el) => {
    if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
      const active = checkedRadios.get(el.name) ?? firstRadios.get(el.name);
      return el === active;
    }
    return true;
  });
}

function canRestoreFocus(el: HTMLElement | null): el is HTMLElement {
  if (!el || !el.isConnected) return false;
  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return false;
  if (el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  return true;
}

export interface UseFocusTrapExplicitOptions<T extends HTMLElement = HTMLElement> {
  /** Whether the modal / trap is currently active. */
  isOpen?: boolean;
  active?: boolean;
  /** Optional Escape-to-close handler. */
  onClose?: () => void;
  onEscape?: () => void;
  /** Element to focus first when opened. */
  initialFocusRef?: RefObject<T | HTMLElement | null>;
  /** Explicit element to restore focus to when closed. */
  returnFocusRef?: RefObject<T | HTMLElement | null>;
  /** Whether to restore focus to the trigger when closed (default: `true`). */
  restoreFocus?: boolean;
  /** Whether to move initial focus inside the container when opened (default: `true`). */
  autoFocus?: boolean;
}

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  arg1?: RefObject<T | null> | UseFocusTrapExplicitOptions<T>,
  arg2?: UseFocusTrapExplicitOptions<T>
): RefObject<T | null> {
  const internalRef = useRef<T | null>(null);

  const isExplicitRef = arg1 && typeof arg1 === 'object' && 'current' in arg1;
  const containerRef = (isExplicitRef ? arg1 : internalRef) as RefObject<T | null>;
  const options = (isExplicitRef ? arg2 : arg1) || {};

  const active = Boolean(options.isOpen ?? options.active);
  const handleClose = options.onClose ?? options.onEscape;
  const restoreFocus = options.restoreFocus !== false;
  const autoFocus = options.autoFocus !== false;

  useEscapeKey(() => {
    handleClose?.();
  }, active && Boolean(handleClose));

  const returnFocusRefHolder = useRef(options.returnFocusRef);
  returnFocusRefHolder.current = options.returnFocusRef;

  const initialFocusRefHolder = useRef(options.initialFocusRef);
  initialFocusRefHolder.current = options.initialFocusRef;

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    activeTrapStack.push(container);
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (autoFocus) {
      const explicitInitial = initialFocusRefHolder.current?.current;
      if (explicitInitial && container.contains(explicitInitial) && isElementFocusable(explicitInitial, container)) {
        explicitInitial.focus();
      } else {
        const tabbables = getFocusableElements(container);
        if (tabbables.length > 0) {
          tabbables[0].focus();
        } else if (container.tabIndex >= 0) {
          container.focus();
        }
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      if (activeTrapStack[activeTrapStack.length - 1] !== container) return;

      const tabbables = getFocusableElements(container);
      if (tabbables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      const current = document.activeElement;

      if (event.shiftKey) {
        if (current === first || !container.contains(current)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (current === last || !container.contains(current)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const stackIdx = activeTrapStack.lastIndexOf(container);
      if (stackIdx !== -1) activeTrapStack.splice(stackIdx, 1);

      if (!restoreFocus) return;

      const activeNow = document.activeElement;
      const focusWasInsideOrLost =
        !activeNow || activeNow === document.body || container.contains(activeNow);

      if (!focusWasInsideOrLost) return;

      const explicitReturn = returnFocusRefHolder.current?.current ?? null;
      if (canRestoreFocus(explicitReturn)) {
        explicitReturn.focus({ preventScroll: true });
        return;
      }
      if (canRestoreFocus(previousFocus) && !container.contains(previousFocus)) {
        previousFocus.focus({ preventScroll: true });
        return;
      }
      const mainLandmark = document.getElementById('main-content');
      if (mainLandmark instanceof HTMLElement) {
        mainLandmark.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef, restoreFocus, autoFocus]);

  return containerRef;
}

export default useFocusTrap;
