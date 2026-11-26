import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CurrencyConverterWidget, ConvertedFiatBadge } from './CurrencyConverterWidget';
import { useCurrencyStore } from '@/store/currencyStore';
import { useWalletStore } from '@/store/walletStore';

describe('CurrencyConverterWidget Component', () => {
  beforeEach(() => {
    localStorage.clear();
    useWalletStore.setState({ address: 'GCLIENT1234567890' } as any);
    useCurrencyStore.setState({
      displayCurrency: 'USD',
      isConnected: false,
      lastError: null,
    });
  });

  it('renders portfolio value and display currency selector when wallet is connected', () => {
    render(<CurrencyConverterWidget />);
    const selector = screen.getByLabelText('Display currency') as HTMLSelectElement;
    expect(selector).toBeInTheDocument();
    expect(selector.value).toBe('USD');
  });

  it('switches display currency when selector changes', () => {
    render(<CurrencyConverterWidget />);
    const selector = screen.getByLabelText('Display currency') as HTMLSelectElement;
    fireEvent.change(selector, { target: { value: 'EUR' } });
    expect(useCurrencyStore.getState().displayCurrency).toBe('EUR');
    expect(selector.value).toBe('EUR');
  });

  it('renders total portfolio value when portfolioItems are passed', () => {
    const portfolio = [
      { amount: 100, token: 'USDC' },
      { amount: 50, token: 'USDC' },
    ];
    render(<CurrencyConverterWidget portfolioItems={portfolio} />);
    expect(screen.getByText('$150.00')).toBeInTheDocument();
    expect(screen.getByText(/Total across 2 assets/)).toBeInTheDocument();
  });

  it('ConvertedFiatBadge renders converted fiat equivalent correctly', () => {
    render(<ConvertedFiatBadge amount={250} token="USDC" />);
    const badge = screen.getByTestId('converted-fiat-badge');
    expect(badge).toHaveTextContent('≈');
    expect(badge).toHaveTextContent('$250.00');
    expect(badge).toHaveTextContent('USD');
  });
});
