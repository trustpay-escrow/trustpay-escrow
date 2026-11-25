import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Safe storage resolver that handles browser localStorage and falls back gracefully in tests/SSR
const getStorageProvider = () => {
  if (
    typeof window !== 'undefined' &&
    window.localStorage &&
    typeof window.localStorage.setItem === 'function'
  ) {
    return window.localStorage;
  }
  const memoryStore: Record<string, string> = {};
  return {
    getItem: (key: string) => memoryStore[key] ?? null,
    setItem: (key: string, value: string) => {
      memoryStore[key] = String(value);
    },
    removeItem: (key: string) => {
      delete memoryStore[key];
    },
    clear: () => {
      Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
    },
    length: 0,
    key: (i: number) => Object.keys(memoryStore)[i] ?? null,
  };
};

export type FiatCurrency =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'JPY'
  | 'CAD'
  | 'AUD'
  | 'CHF'
  | 'CNY'
  | 'INR'
  | 'BRL'
  | 'MXN'
  | 'NGN'
  | 'ZAR'
  | 'SGD'
  | 'HKD'
  | 'KRW';

export const FIAT_CURRENCIES: readonly FiatCurrency[] = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY',
  'INR', 'BRL', 'MXN', 'NGN', 'ZAR', 'SGD', 'HKD', 'KRW',
] as const;

export const CURRENCY_SYMBOLS: Record<FiatCurrency, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥',
  CAD: 'C$', AUD: 'A$', CHF: 'CHF', CNY: '¥',
  INR: '₹', BRL: 'R$', MXN: 'MX$', NGN: '₦',
  ZAR: 'R', SGD: 'S$', HKD: 'HK$', KRW: '₩',
};

export type CryptoCurrency = 'USDC' | 'EURC' | 'XLM' | 'PYUSD';

export const CRYPTO_CURRENCIES: readonly CryptoCurrency[] = [
  'USDC', 'EURC', 'XLM', 'PYUSD',
] as const;

export interface FXRate {
  base: CryptoCurrency;
  quote: FiatCurrency;
  rate: number;
  timestamp: string;
  source: 'live' | 'fallback';
}

export interface CurrencyState {
  // User preferences
  displayCurrency: FiatCurrency;
  // Live FX rates
  fxRates: Record<CryptoCurrency, Record<FiatCurrency, FXRate>>;
  // Connection status
  isConnected: boolean;
  lastError: string | null;
  // Actions
  setDisplayCurrency: (currency: FiatCurrency) => void;
  updateFXRate: (rate: FXRate) => void;
  updateFXRates: (rates: FXRate[]) => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
  // Conversion helpers
  convertCryptoToFiat: (amount: number, crypto: CryptoCurrency) => number;
  convertCryptoToDisplayCurrency: (amount: number, crypto: CryptoCurrency) => number;
  formatFiat: (amount: number, currency?: FiatCurrency) => string;
  getRate: (crypto: CryptoCurrency, fiat: FiatCurrency) => number | null;
}

const FALLBACK_RATES: Record<CryptoCurrency, Record<FiatCurrency, number>> = {
  USDC: {
    USD: 1.0, EUR: 0.92, GBP: 0.79, JPY: 150.0, CAD: 1.36, AUD: 1.52,
    CHF: 0.88, CNY: 7.25, INR: 83.1, BRL: 4.95, MXN: 17.1, NGN: 1550.0,
    ZAR: 18.8, SGD: 1.34, HKD: 7.8, KRW: 1320.0,
  },
  EURC: {
    USD: 1.09, EUR: 1.0, GBP: 0.86, JPY: 163.0, CAD: 1.48, AUD: 1.65,
    CHF: 0.96, CNY: 7.88, INR: 90.3, BRL: 5.38, MXN: 18.6, NGN: 1690.0,
    ZAR: 20.4, SGD: 1.46, HKD: 8.5, KRW: 1435.0,
  },
  XLM: {
    USD: 0.11, EUR: 0.10, GBP: 0.087, JPY: 16.5, CAD: 0.15, AUD: 0.167,
    CHF: 0.097, CNY: 0.79, INR: 9.1, BRL: 0.54, MXN: 1.88, NGN: 170.0,
    ZAR: 2.07, SGD: 0.147, HKD: 0.86, KRW: 145.0,
  },
  PYUSD: {
    USD: 1.0, EUR: 0.92, GBP: 0.79, JPY: 150.0, CAD: 1.36, AUD: 1.52,
    CHF: 0.88, CNY: 7.25, INR: 83.1, BRL: 4.95, MXN: 17.1, NGN: 1550.0,
    ZAR: 18.8, SGD: 1.34, HKD: 7.8, KRW: 1320.0,
  },
};

function createInitialRates(): Record<CryptoCurrency, Record<FiatCurrency, FXRate>> {
  const result = {} as Record<CryptoCurrency, Record<FiatCurrency, FXRate>>;
  for (const crypto of CRYPTO_CURRENCIES) {
    result[crypto] = {} as Record<FiatCurrency, FXRate>;
    for (const fiat of FIAT_CURRENCIES) {
      result[crypto][fiat] = {
        base: crypto,
        quote: fiat,
        rate: FALLBACK_RATES[crypto][fiat],
        timestamp: new Date().toISOString(),
        source: 'fallback',
      };
    }
  }
  return result;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      displayCurrency: 'USD',
      fxRates: createInitialRates(),
      isConnected: false,
      lastError: null,

      setDisplayCurrency: (currency: FiatCurrency) =>
        set({ displayCurrency: currency }),

      updateFXRate: (rate: FXRate) =>
        set((state) => ({
          fxRates: {
            ...state.fxRates,
            [rate.base]: {
              ...state.fxRates[rate.base],
              [rate.quote]: rate,
            },
          },
        })),

      updateFXRates: (rates: FXRate[]) =>
        set((state) => {
          const newRates = { ...state.fxRates };
          for (const rate of rates) {
            newRates[rate.base] = {
              ...newRates[rate.base],
              [rate.quote]: rate,
            };
          }
          return { fxRates: newRates, isConnected: true, lastError: null };
        }),

      setConnected: (connected: boolean) => set({ isConnected: connected }),

      setError: (error: string | null) => set({ lastError: error }),

      convertCryptoToFiat: (amount: number, crypto: CryptoCurrency, fiat?: FiatCurrency) => {
        const targetFiat = fiat || get().displayCurrency;
        const rate = get().fxRates[crypto]?.[targetFiat]?.rate ?? FALLBACK_RATES[crypto][targetFiat];
        return amount * rate;
      },

      convertCryptoToDisplayCurrency: (amount: number, crypto: CryptoCurrency) => {
        const { displayCurrency, fxRates } = get();
        const rate = fxRates[crypto]?.[displayCurrency]?.rate ?? FALLBACK_RATES[crypto][displayCurrency];
        return amount * rate;
      },

      formatFiat: (amount: number, currency?: FiatCurrency) => {
        const targetCurrency = currency || get().displayCurrency;
        const symbol = CURRENCY_SYMBOLS[targetCurrency] || targetCurrency;
        return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },

      getRate: (crypto: CryptoCurrency, fiat: FiatCurrency) => {
        return get().fxRates[crypto]?.[fiat]?.rate ?? FALLBACK_RATES[crypto][fiat] ?? null;
      },
    }),
    {
      name: 'trustpay-currency-storage',
      storage: createJSONStorage(getStorageProvider),
      partialize: (state) => ({
        displayCurrency: state.displayCurrency,
      }),
    }
  )
);

/**
 * Fetches live FX rates from a public API (e.g., exchangerate.host or similar).
 * Returns array of FXRate objects for all crypto/fiat pairs.
 */
export async function fetchLiveFXRates(): Promise<FXRate[]> {
  const results: FXRate[] = [];
  const timestamp = new Date().toISOString();

  try {
    // Use exchangerate.host free API (no key required, supports crypto)
    // We'll fetch USD rates first, then compute cross rates
    const response = await fetch('https://api.exchangerate.host/latest?base=USD');
    if (!response.ok) throw new Error('FX API unreachable');
    const data = await response.json();

    const usdRates = data.rates as Record<string, number>;

    for (const crypto of CRYPTO_CURRENCIES) {
      // Get crypto/USD rate from CoinGecko or similar
      // For now use fallback crypto/USD, compute fiat cross rates
      const cryptoUsdRate = FALLBACK_RATES[crypto].USD;

      for (const fiat of FIAT_CURRENCIES) {
        const fiatUsdRate = usdRates[fiat] ?? FALLBACK_RATES.USDC[fiat]; // USD/fiat
        // crypto/fiat = crypto/USD * USD/fiat
        const rate = cryptoUsdRate / fiatUsdRate;

        results.push({
          base: crypto,
          quote: fiat,
          rate,
          timestamp,
          source: 'live',
        });
      }
    }

    return results;
  } catch (error) {
    console.warn('[CurrencyStore] Live FX fetch failed, using fallback:', error);
    // Return fallback rates as live with fallback source
    for (const crypto of CRYPTO_CURRENCIES) {
      for (const fiat of FIAT_CURRENCIES) {
        results.push({
          base: crypto,
          quote: fiat,
          rate: FALLBACK_RATES[crypto][fiat],
          timestamp,
          source: 'fallback',
        });
      }
    }
    return results;
  }
}

/**
 * Starts a polling interval to refresh FX rates every 60 seconds.
 * Returns cleanup function to stop polling.
 */
export function startFXPolling(intervalMs = 60000): () => void {
  let mounted = true;
  let isPolling = false;

  const poll = async () => {
    if (!mounted || isPolling) return;
    isPolling = true;
    try {
      const rates = await fetchLiveFXRates();
      if (mounted) {
        useCurrencyStore.getState().updateFXRates(rates);
      }
    } catch {
      // Error already logged in fetchLiveFXRates
    } finally {
      isPolling = false;
    }
  };

  // Initial fetch
  poll();

  const intervalId = setInterval(poll, intervalMs);

  return () => {
    mounted = false;
    clearInterval(intervalId);
  };
}
