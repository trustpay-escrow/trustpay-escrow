import React, { useRef, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useFocusTrap, getFocusableElements } from './useFocusTrap';

function SingleModalHarness({
  initialOpen = false,
  withFocusableChildren = true,
  onCloseSpy,
}: {
  initialOpen?: boolean;
  withFocusableChildren?: boolean;
  onCloseSpy?: () => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(dialogRef, {
    isOpen: open,
    onClose: () => {
      onCloseSpy?.();
      setOpen(false);
    },
  });

  return (
    <div>
      <main id="main-content" tabIndex={-1}>
        <button type="button" onClick={() => setOpen(true)}>
          Open Dialog
        </button>
      </main>
      {open && (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Sample modal">
          {withFocusableChildren ? (
            <>
              <button type="button">First Action</button>
              <input type="text" aria-label="Middle input" />
              <button type="button" onClick={() => setOpen(false)}>
                Close Action
              </button>
            </>
          ) : (
            <p>No interactive children</p>
          )}
        </div>
      )}
    </div>
  );
}

function StackedModalsHarness() {
  const [outerOpen, setOuterOpen] = useState(false);
  const [innerOpen, setInnerOpen] = useState(false);
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(outerRef, {
    isOpen: outerOpen,
    onClose: () => setOuterOpen(false),
  });

  useFocusTrap(innerRef, {
    isOpen: innerOpen,
    onClose: () => setInnerOpen(false),
  });

  return (
    <div>
      <main id="main-content" tabIndex={-1}>
        <button type="button" onClick={() => setOuterOpen(true)}>
          Open Outer
        </button>
      </main>
      {outerOpen && (
        <div ref={outerRef} role="dialog" aria-modal="true" aria-label="Outer dialog">
          <button type="button" onClick={() => setInnerOpen(true)}>
            Open Inner
          </button>
          <button type="button" onClick={() => setOuterOpen(false)}>
            Close Outer
          </button>
        </div>
      )}
      {innerOpen && (
        <div ref={innerRef} role="dialog" aria-modal="true" aria-label="Inner dialog">
          <button type="button">Inner First</button>
          <button type="button" onClick={() => setInnerOpen(false)}>
            Close Inner
          </button>
        </div>
      )}
    </div>
  );
}

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

describe('useFocusTrap (stacked / WCAG compliance)', () => {
  it('moves initial focus inside the modal, traps Tab and Shift+Tab, and restores focus to trigger on close', () => {
    render(<SingleModalHarness />);
    const trigger = screen.getByRole('button', { name: 'Open Dialog' });
    trigger.focus();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);

    const firstBtn = screen.getByRole('button', { name: 'First Action' });
    const closeBtn = screen.getByRole('button', { name: 'Close Action' });

    // Initial focus moves inside dialog
    expect(firstBtn).toHaveFocus();

    // Shift+Tab from first wraps to last
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(closeBtn).toHaveFocus();

    // Tab from last wraps to first
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(firstBtn).toHaveFocus();

    // Close button returns focus to the triggering element
    fireEvent.click(closeBtn);
    expect(trigger).toHaveFocus();
  });

  it('coordinates stacked modal focus trapping and Escape LIFO order', () => {
    render(<StackedModalsHarness />);
    const openOuter = screen.getByRole('button', { name: 'Open Outer' });
    openOuter.focus();
    fireEvent.click(openOuter);

    const openInner = screen.getByRole('button', { name: 'Open Inner' });
    expect(openInner).toHaveFocus();

    fireEvent.click(openInner);
    const innerFirst = screen.getByRole('button', { name: 'Inner First' });
    expect(innerFirst).toHaveFocus();

    // While inner is open, Tab only cycles within inner modal
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Close Inner' })).toHaveFocus();

    // Escape closes topmost (inner) dialog first and restores focus to Open Inner
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Inner dialog' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Outer dialog' })).toBeInTheDocument();
    expect(openInner).toHaveFocus();

    // Second Escape closes outer dialog and restores focus to Open Outer
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Outer dialog' })).not.toBeInTheDocument();
    expect(openOuter).toHaveFocus();
  });

  it('deduplicates named radio groups in getFocusableElements', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <input type="radio" name="plan" value="a" />
      <input type="radio" name="plan" value="b" checked />
      <input type="radio" name="plan" value="c" />
      <button type="button">Submit</button>
    `;
    document.body.appendChild(container);
    const focusables = getFocusableElements(container);
    expect(focusables).toHaveLength(2);
    expect((focusables[0] as HTMLInputElement).value).toBe('b');
    expect(focusables[1].textContent).toBe('Submit');
    container.remove();
  });

  it('excludes focusable descendants inside display:none ancestors', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <button type="button">Visible</button>
      <div style="display: none">
        <button type="button">Hidden In Ancestor</button>
      </div>
      <button type="button">Also Visible</button>
    `;
    document.body.appendChild(container);
    const focusables = getFocusableElements(container);
    expect(focusables.map((el) => el.textContent)).toEqual(['Visible', 'Also Visible']);
    container.remove();
  });
});

describe('useFocusTrap (#309 signature)', () => {
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
