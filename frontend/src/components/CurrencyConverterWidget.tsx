'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useCurrencyStore, FIAT_CURRENCIES, FiatCurrency, FXRate, CryptoCurrency, startFXPolling, fetchLiveFXRates } from '@/store/currencyStore';
import { SUPPORTED_TOKENS, CryptoCurrency as TokenSymbol } from '@/config/tokens';
import { useWalletStore, useActiveWalletAddress } from '@/store/walletStore';
import { useTokenBalances } from '@/hooks/useCreateProjectForm';

interface BalanceItem {
  symbol: CryptoCurrency;
  balance: number;
  fiatValue: number;
  rate: FXRate | null;
}

export function CurrencyConverterWidget() {
  const {
    displayCurrency,
    fxRates,
    isConnected,
    lastError,
    setDisplayCurrency,
    convertCryptoToDisplayCurrency,
    formatFiat,
    getRate,
  } = useCurrencyStore();

  const { address } = useWalletStore();
  const activeWalletAddress = useActiveWalletAddress();
  const [isPolling, setIsPolling] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch token balances using existing hook
  const { balances, loading: balancesLoading } = useTokenBalances(activeWalletAddress);

  // Compute balance items with fiat conversion
  const balanceItems: BalanceItem[] = useMemo(() => {
    if (!balances || balancesLoading) return [];

    return Object.entries(balances)
      .filter(([symbol]) => SUPPORTED_TOKENS[symbol as TokenSymbol])
      .map(([symbol, balance]) => {
        const crypto = symbol as CryptoCurrency;
        const fiatValue = convertCryptoToDisplayCurrency(balance, crypto);
        const rate = fxRates[crypto]?.[displayCurrency] ?? null;
        return { symbol: crypto, balance, fiatValue, rate };
      });
  }, [balances, balancesLoading, fxRates, displayCurrency, convertCryptoToDisplayCurrency]);

  // Total portfolio value in display currency
  const totalPortfolioValue = useMemo(
    () => balanceItems.reduce((sum, item) => sum + item.fiatValue, 0),
    [balanceItems]
  );

  // Start/stop polling based on connection
  useEffect(() => {
    if (!address) {
      setIsPolling(false);
      return;
    }
    setIsPolling(true);
    const cleanup = startFXPolling(60000);
    return () => {
      setIsPolling(false);
      cleanup();
    };
  }, [address]);

  // Manual refresh handler
  const handleRefresh = async () => {
    try {
      const rates = await fetchLiveFXRates();
      useCurrencyStore.getState().updateFXRates(rates);
    } catch (error) {
      console.error('[CurrencyConverterWidget] Manual refresh failed:', error);
    }
  };

  // Format rate change indicator
  const getRateChangeClass = (rate: FXRate | null) => {
    if (!rate || rate.source === 'fallback') return '';
    // In a real app, compare with previous rate
    return 'text-green-600 dark:text-green-400';
  };

  if (!address) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 text-center text-gray-500 dark:text-gray-400">
        Connect wallet to view portfolio value in {displayCurrency}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Portfolio Value
        </h3>
        <div className="flex items-center gap-2">
          {/* Currency Selector */}
          <select
            value={displayCurrency}
            onChange={(e) => setDisplayCurrency(e.target.value as FiatCurrency)}
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Display currency"
          >
            {FIAT_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>

          {/* Connection Status */}
          <span
            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
              isConnected
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
              }`}
            />
            {isConnected ? 'Live' : 'Fallback'}
          </span>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isPolling}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Refresh exchange rates"
          >
            <svg
              className={`w-5 h-5 ${isPolling ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          {/* Expand/Collapse */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label={showDetails ? 'Collapse details' : 'Expand details'}
          >
            <svg
              className={`w-5 h-5 transition-transform ${showDetails ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Total Portfolio Value */}
      <div className="mb-4">
        <div className="text-3xl font-bold text-gray-900 dark:text-white">
          {formatFiat(totalPortfolioValue)}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Total across {balanceItems.length} asset{balanceItems.length !== 1 ? 's' : ''}
        </div>
        {lastError && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            ⚠ {lastError}
          </div>
        )}
      </div>

      {/* Details Panel */}
      {showDetails && balanceItems.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Asset Breakdown
          </h4>
          <div className="space-y-1">
            {balanceItems.map((item) => {
              const tokenConfig = SUPPORTED_TOKENS[item.symbol];
              const rate = item.rate;
              return (
                <div
                  key={item.symbol}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-900/50"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xl"
                      aria-hidden="true"
                    >
                      {tokenConfig?.icon || item.symbol}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.symbol}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {item.balance.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 7,
                        })} {item.symbol}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatFiat(item.fiatValue)}
                    </div>
                    <div
                      className={`text-xs ${getRateChangeClass(rate)}`}
                    >
                      1 {item.symbol} = {rate?.rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} {displayCurrency}
                      {rate?.source === 'fallback' && ' (est.)'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {lastError && !showDetails && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-red-700 dark:text-red-300">
              Using fallback rates: {lastError}
            </span>
            <button
              onClick={handleRefresh}
              className="text-xs text-red-700 dark:text-red-300 hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact version for dashboard badges
export function CurrencyBadge({ amount, crypto }: { amount: number; crypto: CryptoCurrency }) {
  const { displayCurrency, convertCryptoToDisplayCurrency, formatFiat } = useCurrencyStore();
  const fiatValue = convertCryptoToDisplayCurrency(amount, crypto);
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-sm font-medium text-gray-900 dark:text-white">
      {formatFiat(fiatValue)}
    </span>
  );
}
