import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CurrencyAmountInput, currencyPrefix } from './CurrencyAmountInput';

describe('currencyPrefix', () => {
  it('maps every supported escrow token to its badge', () => {
    expect(currencyPrefix('USDC')).toBe('$');
    expect(currencyPrefix('PYUSD')).toBe('$');
    expect(currencyPrefix('EURC')).toBe('€');
    expect(currencyPrefix('XLM')).toBe('XLM');
    expect(currencyPrefix('usdc')).toBe('$');
  });
});

describe('CurrencyAmountInput', () => {
  it('renders the prefix inside the field and updates it when the token changes', () => {
    const { rerender } = render(
      <CurrencyAmountInput token="USDC" value="900" onChange={() => {}} />
    );

    expect(screen.getByTestId('currency-prefix').textContent).toBe('$');
    expect(screen.getByTestId('currency-amount-input').getAttribute('value')).toBe('900');

    rerender(<CurrencyAmountInput token="EURC" value="900" onChange={() => {}} />);
    expect(screen.getByTestId('currency-prefix').textContent).toBe('€');

    rerender(<CurrencyAmountInput token="XLM" value="900" onChange={() => {}} />);
    expect(screen.getByTestId('currency-prefix').textContent).toBe('XLM');
  });

  it('keeps the numeric value clean of currency symbols', () => {
    const onChange = vi.fn();
    render(<CurrencyAmountInput token="EURC" value="" onChange={onChange} />);

    fireEvent.change(screen.getByTestId('currency-amount-input'), {
      target: { value: '12.50' },
    });

    expect(onChange).toHaveBeenCalledWith('12.50');
    expect(screen.getByTestId('currency-amount-input').getAttribute('type')).toBe('number');
    expect(screen.getByTestId('currency-prefix').getAttribute('aria-hidden')).toBe('true');
  });
});
