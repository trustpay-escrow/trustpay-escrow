import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CurrencyConverterWidget, ConvertedFiatBadge } from './CurrencyConverterWidget';
import { useCurrencyStore } from '@/store/currencyStore';

describe('CurrencyConverterWidget Component', () => {
  beforeEach(() => {
    localStorage.clear();
    useCurrencyStore.setState({
      selectedCurrency: 'USD',
      rates: {
        USD: 1.0,
        EUR: 0.92,
        GBP: 0.79,
        JPY: 154.5,
        NGN: 1490.0,
        CAD: 1.38,
        AUD: 1.52,
        CHF: 0.88,
        INR: 84.4,
        BRL: 5.75,
        ZAR: 18.2,
        SGD: 1.34,
        HKD: 7.78,
        CNY: 7.24,
        AED: 3.67,
      },
      lastUpdated: null,
      rateTrend: 'neutral',
      isLive: false,
    });
  });

  it('renders the selector button with current currency metadata', () => {
    render(<CurrencyConverterWidget />);
    const button = screen.getByTestId('currency-selector-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('USD');
    expect(button).toHaveTextContent('($)');
    expect(button).toHaveTextContent('🇺🇸');
  });

  it('opens dropdown menu on click and lists supported fiat currencies', () => {
    render(<CurrencyConverterWidget />);
    const button = screen.getByTestId('currency-selector-button');
    fireEvent.click(button);

    expect(screen.getByTestId('currency-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('currency-option-EUR')).toHaveTextContent('Euro');
    expect(screen.getByTestId('currency-option-GBP')).toHaveTextContent('British Pound');
    expect(screen.getByTestId('currency-option-NGN')).toHaveTextContent('Nigerian Naira');
  });

  it('filters currencies via the search input in real time', () => {
    render(<CurrencyConverterWidget />);
    fireEvent.click(screen.getByTestId('currency-selector-button'));

    const searchInput = screen.getByTestId('currency-search-input');
    fireEvent.change(searchInput, { target: { value: 'Naira' } });

    expect(screen.getByTestId('currency-option-NGN')).toBeInTheDocument();
    expect(screen.queryByTestId('currency-option-EUR')).not.toBeInTheDocument();
  });

  it('switches currency when an option is clicked and updates display', () => {
    render(<CurrencyConverterWidget />);
    fireEvent.click(screen.getByTestId('currency-selector-button'));

    const eurOption = screen.getByTestId('currency-option-EUR');
    fireEvent.click(eurOption);

    expect(useCurrencyStore.getState().selectedCurrency).toBe('EUR');
    expect(screen.getByTestId('currency-selector-button')).toHaveTextContent('EUR');
    expect(screen.getByTestId('currency-selector-button')).toHaveTextContent('(€)');
  });

  it('renders portfolio value badge when items are passed', () => {
    const portfolio = [
      { amount: 100, token: 'USDC' },
      { amount: 50, token: 'USDC' },
    ];
    render(<CurrencyConverterWidget portfolioItems={portfolio} />);

    const badge = screen.getByTestId('portfolio-value-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('≈');
    expect(badge).toHaveTextContent('$150.00');
    expect(badge).toHaveTextContent('USD');
  });

  it('ConvertedFiatBadge renders converted fiat equivalent correctly', () => {
    render(<ConvertedFiatBadge amount={250} token="USDC" />);
    const badge = screen.getByTestId('converted-fiat-badge');
    expect(badge).toHaveTextContent('≈');
    expect(badge).toHaveTextContent('$250.00');
  });
});
