import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRovingTabIndex } from './useRovingTabIndex';

function RovingHarness({ disabledIndices = [] as number[] }: { disabledIndices?: number[] }) {
  const items = ['Client', 'Freelancer', 'Arbiter'];
  const [active, setActive] = useState(0);
  const { getItemProps } = useRovingTabIndex({
    count: items.length,
    activeIndex: active,
    onSelect: setActive,
    orientation: 'horizontal',
    isDisabled: (index) => disabledIndices.includes(index),
  });

  return (
    <div role="tablist" aria-label="Role selector">
      {items.map((label, index) => {
        const props = getItemProps(index);
        const disabled = disabledIndices.includes(index);
        return (
          <button
            key={label}
            type="button"
            role="tab"
            disabled={disabled}
            aria-selected={active === index}
            ref={props.ref}
            tabIndex={props.tabIndex}
            onKeyDown={props.onKeyDown}
            onClick={() => setActive(index)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

describe('useRovingTabIndex', () => {
  it('sets tabIndex=0 on active item and -1 on inactive items, moving focus with Arrow/Home/End', () => {
    render(<RovingHarness />);
    const client = screen.getByRole('tab', { name: 'Client' });
    const freelancer = screen.getByRole('tab', { name: 'Freelancer' });
    const arbiter = screen.getByRole('tab', { name: 'Arbiter' });

    expect(client).toHaveAttribute('tabindex', '0');
    expect(freelancer).toHaveAttribute('tabindex', '-1');
    expect(arbiter).toHaveAttribute('tabindex', '-1');

    client.focus();
    fireEvent.keyDown(client, { key: 'ArrowRight' });
    expect(freelancer).toHaveFocus();
    expect(freelancer).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(freelancer, { key: 'End' });
    expect(arbiter).toHaveFocus();
    expect(arbiter).toHaveAttribute('aria-selected', 'true');

    // Wraps from end back to start
    fireEvent.keyDown(arbiter, { key: 'ArrowRight' });
    expect(client).toHaveFocus();

    // Wraps from start to end on ArrowLeft
    fireEvent.keyDown(client, { key: 'ArrowLeft' });
    expect(arbiter).toHaveFocus();

    fireEvent.keyDown(arbiter, { key: 'Home' });
    expect(client).toHaveFocus();
  });

  it('skips disabled items and ignores browser shortcut chords with Alt/Ctrl/Meta', () => {
    render(<RovingHarness disabledIndices={[1]} />);
    const client = screen.getByRole('tab', { name: 'Client' });
    const arbiter = screen.getByRole('tab', { name: 'Arbiter' });

    client.focus();
    // Browser back/forward chord should not hijack focus
    fireEvent.keyDown(client, { key: 'ArrowRight', altKey: true });
    expect(client).toHaveFocus();

    // ArrowRight skips disabled index 1 -> focuses Arbiter
    fireEvent.keyDown(client, { key: 'ArrowRight' });
    expect(arbiter).toHaveFocus();
  });

  it('does not hang when all items are disabled', () => {
    render(<RovingHarness disabledIndices={[0, 1, 2]} />);
    const client = screen.getByRole('tab', { name: 'Client' });
    expect(() => fireEvent.keyDown(client, { key: 'ArrowRight' })).not.toThrow();
  });
});
