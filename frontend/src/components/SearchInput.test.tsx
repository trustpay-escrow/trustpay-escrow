import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchInput } from './SearchInput';
import React, { useState } from 'react';

function ControlledSearch({ initial = '' }: { initial?: string }) {
  const [val, setVal] = useState(initial);
  return <SearchInput value={val} onChange={setVal} placeholder="Search projects..." />;
}

describe('SearchInput Component', () => {
  it('hides clear button when input is empty', () => {
    render(<ControlledSearch initial="" />);
    expect(screen.queryByTestId('clear-search-button')).not.toBeInTheDocument();
  });

  it('renders clear button when input has text', () => {
    render(<ControlledSearch initial="Escrow" />);
    expect(screen.getByTestId('clear-search-button')).toBeInTheDocument();
  });

  it('clears text and maintains input focus when clear button is clicked', () => {
    render(<ControlledSearch initial="Milestone 1" />);
    const input = screen.getByRole('searchbox');
    const clearBtn = screen.getByTestId('clear-search-button');

    expect(input).toHaveValue('Milestone 1');
    fireEvent.click(clearBtn);

    expect(input).toHaveValue('');
    expect(document.activeElement).toBe(input);
  });

  it('clears search text immediately when Escape key is pressed', () => {
    render(<ControlledSearch initial="Stellar" />);
    const input = screen.getByRole('searchbox');

    expect(input).toHaveValue('Stellar');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(input).toHaveValue('');
    expect(document.activeElement).toBe(input);
  });
});
