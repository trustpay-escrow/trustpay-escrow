import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';

function TrapDialog({ active, onEscape }: { active: boolean; onEscape: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>({ active, onEscape });

  return (
    <div>
      <button type="button" data-testid="trigger">
        Open
      </button>
      {active && (
        <div ref={ref} role="dialog" aria-modal="true" aria-label="Test dialog" tabIndex={-1}>
          <button type="button" data-testid="first">
            First
          </button>
          <button type="button" data-testid="last">
            Last
          </button>
        </div>
      )}
    </div>
  );
}

describe('useFocusTrap (#309)', () => {
  it('moves focus into the dialog and wraps Tab / Shift+Tab', () => {
    render(<TrapDialog active onEscape={() => {}} />);

    expect(document.activeElement).toBe(screen.getByTestId('first'));

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId('last'));

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByTestId('first'));
  });

  it('calls onEscape when Escape is pressed', () => {
    const onEscape = vi.fn();
    render(<TrapDialog active onEscape={onEscape} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the triggering element when the trap closes', () => {
    const { rerender } = render(<TrapDialog active={false} onEscape={() => {}} />);

    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    rerender(<TrapDialog active onEscape={() => {}} />);
    expect(document.activeElement).toBe(screen.getByTestId('first'));

    rerender(<TrapDialog active={false} onEscape={() => {}} />);
    expect(document.activeElement).toBe(trigger);
  });
});
