'use client';

import { useCallback, useRef, type KeyboardEvent } from 'react';

export type RovingOrientation = 'horizontal' | 'vertical' | 'both';

export interface UseRovingTabIndexOptions {
  /** Total number of items in the composite widget. */
  count: number;
  /** Currently active/selected item index. */
  activeIndex: number;
  /** Called when keyboard navigation selects a new item index. */
  onSelect: (index: number) => void;
  /** Axis supported by arrow keys (default: `'horizontal'`). */
  orientation?: RovingOrientation;
  /** Optional predicate to skip disabled items during keyboard navigation. */
  isDisabled?: (index: number) => boolean;
}

function findNextEnabled(
  count: number,
  start: number,
  step: 1 | -1,
  isDisabled?: (index: number) => boolean
): number {
  if (count <= 0) return -1;
  for (let offset = 1; offset <= count; offset++) {
    const idx = (start + step * offset + count) % count;
    if (!isDisabled?.(idx)) return idx;
  }
  return -1;
}

function findBoundaryEnabled(
  count: number,
  fromEnd: boolean,
  isDisabled?: (index: number) => boolean
): number {
  if (count <= 0) return -1;
  for (let i = 0; i < count; i++) {
    const idx = fromEnd ? count - 1 - i : i;
    if (!isDisabled?.(idx)) return idx;
  }
  return -1;
}

/**
 * Implements WAI-ARIA roving tabindex (`tabIndex={0}` on active item, `-1` on others)
 * with Arrow, Home, and End navigation. Moves focus imperatively inside `onKeyDown`
 * only—never steals focus on mount or prop updates.
 */
export function useRovingTabIndex({
  count,
  activeIndex,
  onSelect,
  orientation = 'horizontal',
  isDisabled,
}: UseRovingTabIndexOptions) {
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  // Ensure at least one enabled item remains tab-reachable even if activeIndex is disabled or out of range.
  const effectiveIndex =
    activeIndex >= 0 && activeIndex < count && !isDisabled?.(activeIndex)
      ? activeIndex
      : findBoundaryEnabled(count, false, isDisabled);

  const moveFocusTo = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= count) return;
      onSelect(nextIndex);
      const target = itemRefs.current[nextIndex];
      if (target && typeof target.focus === 'function') {
        target.focus();
      }
    },
    [count, onSelect]
  );

  const getItemProps = useCallback(
    (index: number) => ({
      ref: (el: HTMLElement | null) => {
        itemRefs.current[index] = el;
      },
      tabIndex: index === effectiveIndex ? 0 : -1,
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;

        const allowHorizontal = orientation === 'horizontal' || orientation === 'both';
        const allowVertical = orientation === 'vertical' || orientation === 'both';

        let targetIndex = -1;

        if ((allowHorizontal && event.key === 'ArrowRight') || (allowVertical && event.key === 'ArrowDown')) {
          targetIndex = findNextEnabled(count, index, 1, isDisabled);
        } else if (
          (allowHorizontal && event.key === 'ArrowLeft') ||
          (allowVertical && event.key === 'ArrowUp')
        ) {
          targetIndex = findNextEnabled(count, index, -1, isDisabled);
        } else if (event.key === 'Home') {
          targetIndex = findBoundaryEnabled(count, false, isDisabled);
        } else if (event.key === 'End') {
          targetIndex = findBoundaryEnabled(count, true, isDisabled);
        } else {
          return;
        }

        if (targetIndex !== -1) {
          event.preventDefault();
          moveFocusTo(targetIndex);
        }
      },
    }),
    [count, effectiveIndex, isDisabled, moveFocusTo, orientation]
  );

  return { effectiveIndex, getItemProps };
}
