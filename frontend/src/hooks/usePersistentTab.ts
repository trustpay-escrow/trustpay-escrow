'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PersistentTabOptions<T extends string = string> {
  key: string;
  defaultTab: T;
  allowedTabs?: readonly T[];
  walletAddress?: string | null;
}

/**
 * usePersistentTab
 *
 * Persists active tab selection in sessionStorage across page navigation.
 * Automatically clears or resets when the wallet address disconnects or changes.
 * Falls back to defaultTab if the stored value is invalid or corrupted.
 */
export function usePersistentTab<T extends string = string>({
  key,
  defaultTab,
  allowedTabs,
  walletAddress,
}: PersistentTabOptions<T>) {
  const storageKey = `trustpay_tab_${key}`;
  const addressKey = `trustpay_wallet_addr_${key}`;

  const getInitialTab = (): T => {
    if (typeof window === 'undefined') return defaultTab;
    try {
      const lastAddress = sessionStorage.getItem(addressKey);
      if (walletAddress && lastAddress && lastAddress !== walletAddress) {
        sessionStorage.removeItem(storageKey);
        sessionStorage.setItem(addressKey, walletAddress);
        return defaultTab;
      }
      if (walletAddress) {
        sessionStorage.setItem(addressKey, walletAddress);
      }

      const stored = sessionStorage.getItem(storageKey);
      if (!stored) return defaultTab;

      if (allowedTabs && allowedTabs.length > 0) {
        if (allowedTabs.includes(stored as T)) {
          return stored as T;
        }
        sessionStorage.removeItem(storageKey);
        return defaultTab;
      }
      return (stored as T) || defaultTab;
    } catch {
      return defaultTab;
    }
  };

  const [activeTab, setActiveTabState] = useState<T>(getInitialTab);

  const prevAddressRef = useRef(walletAddress);
  useEffect(() => {
    if (prevAddressRef.current !== walletAddress) {
      if (!walletAddress) {
        try {
          sessionStorage.removeItem(storageKey);
          sessionStorage.removeItem(addressKey);
        } catch {}
        setActiveTabState(defaultTab);
      } else if (prevAddressRef.current && prevAddressRef.current !== walletAddress) {
        try {
          sessionStorage.removeItem(storageKey);
          sessionStorage.setItem(addressKey, walletAddress);
        } catch {}
        setActiveTabState(defaultTab);
      } else {
        try {
          sessionStorage.setItem(addressKey, walletAddress);
        } catch {}
      }
      prevAddressRef.current = walletAddress;
    }
  }, [walletAddress, storageKey, addressKey, defaultTab]);

  const setActiveTab = useCallback(
    (tab: T) => {
      setActiveTabState(tab);
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(storageKey, tab);
          if (walletAddress) {
            sessionStorage.setItem(addressKey, walletAddress);
          }
        }
      } catch {}
    },
    [storageKey, addressKey, walletAddress]
  );

  const clearPersistedTab = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(storageKey);
        sessionStorage.removeItem(addressKey);
      }
    } catch {}
    setActiveTabState(defaultTab);
  }, [storageKey, addressKey, defaultTab]);

  return [activeTab, setActiveTab, clearPersistedTab] as const;
}

/**
 * usePersistentFilter
 *
 * Persists arbitrary search query or filter state in sessionStorage.
 */
export function usePersistentFilter<T>(
  key: string,
  defaultValue: T,
  walletAddress?: string | null
) {
  const storageKey = `trustpay_filter_${key}`;

  const getInitialValue = (): T => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored === null) return defaultValue;
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  };

  const [filterValue, setFilterValueState] = useState<T>(getInitialValue);

  useEffect(() => {
    if (!walletAddress) {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {}
    }
  }, [walletAddress, storageKey]);

  const setFilterValue = useCallback(
    (val: T | ((prev: T) => T)) => {
      setFilterValueState((prev) => {
        const next = typeof val === 'function' ? (val as (prev: T) => T)(prev) : val;
        try {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(storageKey, JSON.stringify(next));
          }
        } catch {}
        return next;
      });
    },
    [storageKey]
  );

  const clearPersistedFilter = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(storageKey);
      }
    } catch {}
    setFilterValueState(defaultValue);
  }, [storageKey, defaultValue]);

  return [filterValue, setFilterValue, clearPersistedFilter] as const;
}
