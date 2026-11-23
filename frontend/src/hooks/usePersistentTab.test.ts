import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistentTab, usePersistentFilter } from './usePersistentTab';

describe('usePersistentTab & usePersistentFilter', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = String(v);
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
      clear: () => {
        mockStorage = {};
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('usePersistentTab', () => {
    it('returns defaultTab on first mount when sessionStorage is empty', () => {
      const { result } = renderHook(() =>
        usePersistentTab({
          key: 'test_tab',
          defaultTab: 'projects',
          allowedTabs: ['projects', 'create', 'applicants'] as const,
          walletAddress: 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5',
        })
      );

      expect(result.current[0]).toBe('projects');
    });

    it('persists selected tab to sessionStorage when setActiveTab is called', () => {
      const { result } = renderHook(() =>
        usePersistentTab({
          key: 'test_tab',
          defaultTab: 'projects',
          allowedTabs: ['projects', 'create', 'applicants'] as const,
          walletAddress: 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5',
        })
      );

      act(() => {
        result.current[1]('applicants');
      });

      expect(result.current[0]).toBe('applicants');
      expect(mockStorage['trustpay_tab_test_tab']).toBe('applicants');
    });

    it('restores previously saved tab from sessionStorage on mount', () => {
      mockStorage['trustpay_tab_test_tab'] = 'create';
      mockStorage['trustpay_wallet_addr_test_tab'] = 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5';

      const { result } = renderHook(() =>
        usePersistentTab({
          key: 'test_tab',
          defaultTab: 'projects',
          allowedTabs: ['projects', 'create', 'applicants'] as const,
          walletAddress: 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5',
        })
      );

      expect(result.current[0]).toBe('create');
    });

    it('falls back to defaultTab when stored value is invalid or corrupted', () => {
      mockStorage['trustpay_tab_test_tab'] = 'invalid_corrupted_tab_value';
      mockStorage['trustpay_wallet_addr_test_tab'] = 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5';

      const { result } = renderHook(() =>
        usePersistentTab({
          key: 'test_tab',
          defaultTab: 'projects',
          allowedTabs: ['projects', 'create', 'applicants'] as const,
          walletAddress: 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5',
        })
      );

      expect(result.current[0]).toBe('projects');
      expect(mockStorage['trustpay_tab_test_tab']).toBeUndefined();
    });

    it('clears persisted tab state and resets to defaultTab when wallet disconnects', () => {
      mockStorage['trustpay_tab_test_tab'] = 'applicants';
      mockStorage['trustpay_wallet_addr_test_tab'] = 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5';

      let wallet: string | null = 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5';
      const { result, rerender } = renderHook(() =>
        usePersistentTab({
          key: 'test_tab',
          defaultTab: 'projects',
          allowedTabs: ['projects', 'create', 'applicants'] as const,
          walletAddress: wallet,
        })
      );

      expect(result.current[0]).toBe('applicants');

      // Disconnect wallet
      wallet = null;
      rerender();

      expect(result.current[0]).toBe('projects');
      expect(mockStorage['trustpay_tab_test_tab']).toBeUndefined();
    });

    it('resets tab state when switching to a different wallet address', () => {
      mockStorage['trustpay_tab_test_tab'] = 'applicants';
      mockStorage['trustpay_wallet_addr_test_tab'] = 'WALLET_A';

      let wallet: string | null = 'WALLET_A';
      const { result, rerender } = renderHook(() =>
        usePersistentTab({
          key: 'test_tab',
          defaultTab: 'projects',
          allowedTabs: ['projects', 'create', 'applicants'] as const,
          walletAddress: wallet,
        })
      );

      expect(result.current[0]).toBe('applicants');

      // Switch to WALLET_B
      wallet = 'WALLET_B';
      rerender();

      expect(result.current[0]).toBe('projects');
      expect(mockStorage['trustpay_tab_test_tab']).toBeUndefined();
    });

    it('clearPersistedTab resets active tab and removes sessionStorage keys', () => {
      const { result } = renderHook(() =>
        usePersistentTab({
          key: 'test_tab',
          defaultTab: 'projects',
          allowedTabs: ['projects', 'create', 'applicants'] as const,
          walletAddress: 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5',
        })
      );

      act(() => {
        result.current[1]('create');
      });
      expect(result.current[0]).toBe('create');

      act(() => {
        result.current[2](); // clearPersistedTab
      });

      expect(result.current[0]).toBe('projects');
      expect(mockStorage['trustpay_tab_test_tab']).toBeUndefined();
    });
  });

  describe('usePersistentFilter', () => {
    it('persists and restores string filter values in sessionStorage', () => {
      const { result } = renderHook(() =>
        usePersistentFilter('search_test', '', 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5')
      );

      expect(result.current[0]).toBe('');

      act(() => {
        result.current[1]('react developer');
      });

      expect(result.current[0]).toBe('react developer');
      expect(mockStorage['trustpay_filter_search_test']).toBe(JSON.stringify('react developer'));
    });

    it('falls back to defaultValue on corrupted JSON in storage', () => {
      mockStorage['trustpay_filter_search_test'] = '{bad json syntax';

      const { result } = renderHook(() =>
        usePersistentFilter('search_test', 'fallback_query', 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5')
      );

      expect(result.current[0]).toBe('fallback_query');
    });

    it('clears persisted filter when wallet logs out', () => {
      mockStorage['trustpay_filter_search_test'] = JSON.stringify('rust developer');

      let wallet: string | null = 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5';
      const { rerender } = renderHook(() =>
        usePersistentFilter('search_test', '', wallet)
      );

      wallet = null;
      rerender();

      expect(mockStorage['trustpay_filter_search_test']).toBeUndefined();
    });
  });
});
