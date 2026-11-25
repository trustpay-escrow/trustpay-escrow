import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCurrencyStore, FIAT_CURRENCIES, FALLBACK_RATES } from './currencyStore';

// Mock localStorage
const mockStorage: Record<string, string> = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => { mockStorage[key] = String(value); },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
    length: 0,
    key: (i: number) => Object.keys(mockStorage)[i] ?? null,
  },
  writable: true,
});

describe('useCurrencyStore Zustand Store', () => {
  beforeEach(() => {
    useCurrencyStore.getState().setError(null);
    useCurrencyStore.setState({
      displayCurrency: 'USD',
      fxRates: useCurrencyStore.getState().fxRates, // reset to initial
      isConnected: false,
      lastError: null,
    });
    mockStorage['trustpay-currency-storage'] = '';
  });

  it('initializes with USD as default display currency', () => {
    const state = useCurrencyStore.getState();
    expect(state.displayCurrency).toBe('USD');
  });

  it('supports all 16 fiat currencies', () => {
    expect(FIAT_CURRENCIES).toHaveLength(16);
    expect(FIAT_CURRENCIES).toContain('USD');
    expect(FIAT_CURRENCIES).toContain('EUR');
    expect(FIAT_CURRENCIES).toContain('GBP');
    expect(FIAT_CURRENCIES).toContain('JPY');
    expect(FIAT_CURRENCIES).toContain('CAD');
    expect(FIAT_CURRENCIES).toContain('AUD');
    expect(FIAT_CURRENCIES).toContain('CHF');
    expect(FIAT_CURRENCIES).toContain('CNY');
    expect(FIAT_CURRENCIES).toContain('INR');
    expect(FIAT_CURRENCIES).toContain('BRL');
    expect(FIAT_CURRENCIES).toContain('MXN');
    expect(FIAT_CURRENCIES).toContain('NGN');
    expect(FIAT_CURRENCIES).toContain('ZAR');
    expect(FIAT_CURRENCIES).toContain('SGD');
    expect(FIAT_CURRENCIES).toContain('HKD');
    expect(FIAT_CURRENCIES).toContain('KRW');
  });

  it('updates display currency and persists to localStorage', () => {
    useCurrencyStore.getState().setDisplayCurrency('EUR');
    expect(useCurrencyStore.getState().displayCurrency).toBe('EUR');

    // Check persistence
    const stored = JSON.parse(window.localStorage.getItem('trustpay-currency-storage') ?? '{}');
    expect(stored.state.displayCurrency).toBe('EUR');
  });

  it('converts crypto to fiat using fallback rates', () => {
    const state = useCurrencyStore.getState();
    
    // 100 USDC -> USD (rate 1.0)
    expect(state.convertCryptoToFiat(100, 'USDC', 'USD')).toBe(100);
    
    // 100 USDC -> EUR (fallback rate 0.92)
    expect(state.convertCryptoToFiat(100, 'USDC', 'EUR')).toBeCloseTo(92, 1);
    
    // 1000 XLM -> USD (fallback rate 0.11)
    expect(state.convertCryptoToFiat(1000, 'XLM', 'USD')).toBeCloseTo(110, 1);
  });

  it('falls back to fallback rates when live rates not available', () => {
    const state = useCurrencyStore.getState();
    
    // Should use fallback for unsupported pair
    const rate = state.getRate('USDC', 'XYZ' as any);
    expect(rate).toBeNull();
    
    // But fallback works for supported pairs
    const fallbackRate = state.getRate('USDC', 'EUR');
    expect(fallbackRate).toBe(FALLBACK_RATES.USDC.EUR);
  });

  it('formats fiat amounts with currency symbol', () => {
    const state = useCurrencyStore.getState();
    
    // USD
    state.setDisplayCurrency('USD');
    expect(state.formatFiat(1234.56)).toContain('$');
    expect(state.formatFiat(1234.56)).toContain('1,234.56');
    
    // EUR
    state.setDisplayCurrency('EUR');
    expect(state.formatFiat(1234.56)).toContain('€');
    
    // GBP
    state.setDisplayCurrency('GBP');
    expect(state.formatFiat(1234.56)).toContain('£');
    
    // JPY (no decimals)
    state.setDisplayCurrency('JPY');
    expect(state.formatFiat(123456)).toContain('¥');
  });

  it('updates FX rates and marks as connected', () => {
    const state = useCurrencyStore.getState();
    
    const newRates = [
      { base: 'USDC', quote: 'USD', rate: 1.01, timestamp: new Date().toISOString(), source: 'live' as const },
      { base: 'USDC', quote: 'EUR', rate: 0.93, timestamp: new Date().toISOString(), source: 'live' as const },
    ];
    
    state.updateFXRates(newRates);
    
    expect(state.isConnected).toBe(true);
    expect(state.lastError).toBeNull();
    expect(state.fxRates.USDC.USD.rate).toBe(1.01);
    expect(state.fxRates.USDC.USD.source).toBe('live');
    expect(state.fxRates.USDC.EUR.rate).toBe(0.93);
  });

  it('handles conversion arithmetic with token decimals', () => {
    const state = useCurrencyStore.getState();
    state.setDisplayCurrency('USD');
    
    // USDC has 7 decimals on Stellar - test raw amount conversion
    const rawUSDC = 100_000_000; // 100 USDC in stroops (7 decimals)
    const humanUSDC = rawUSDC / 10_000_000; // 100
    
    const fiatValue = state.convertCryptoToFiat(humanUSDC, 'USDC', 'USD');
    expect(fiatValue).toBe(100);
    
    // XLM has 7 decimals
    const rawXLM = 1_000_000_000; // 100 XLM
    const humanXLM = rawXLM / 10_000_000; // 100
    const xlmFiat = state.convertCryptoToFiat(humanXLM, 'XLM', 'USD');
    expect(xlmFiat).toBeCloseTo(11, 0); // ~0.11 * 100
  });

  it('persists display currency across reloads', () => {
    useCurrencyStore.getState().setDisplayCurrency('GBP');
    expect(useCurrencyStore.getState().displayCurrency).toBe('GBP');
    
    // Simulate new store instance (in real app this would be a new browser tab)
    const persisted = JSON.parse(window.localStorage.getItem('trustpay-currency-storage') ?? '{}');
    expect(persisted.state.displayCurrency).toBe('GBP');
  });

  it('falls back to USD when network fails', () => {
    const state = useCurrencyStore.getState();
    state.setError('Network error');
    state.setConnected(false);
    
    // Should still be able to convert using fallback rates
    const value = state.convertCryptoToFiat(50, 'USDC', 'EUR');
    expect(value).toBeCloseTo(46, 1); // 50 * 0.92
    
    // Error state preserved
    expect(state.lastError).toBe('Network error');
    expect(state.isConnected).toBe(false);
  });
});
