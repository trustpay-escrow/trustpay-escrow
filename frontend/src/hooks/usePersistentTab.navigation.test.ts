import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  clearPersistedDashboardState,
  usePersistentFilter,
  usePersistentTab,
} from './usePersistentTab';

const WALLET = 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5';

describe('dashboard persistence across navigation (#177)', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
      get length() {
        return Object.keys(store).length;
      },
      clear: () => {
        store = {};
      },
    });
  });

  it('restores the selected tab after the dashboard unmounts and remounts (route change)', () => {
    const first = renderHook(() =>
      usePersistentTab({
        key: 'client_active_tab',
        defaultTab: 'projects',
        allowedTabs: ['projects', 'create', 'applicants', 'saved'] as const,
        walletAddress: WALLET,
      })
    );

    act(() => first.result.current[1]('applicants'));
    expect(first.result.current[0]).toBe('applicants');
    first.unmount();

    // Simulate navigating to /projects/:id and back to /projects.
    const second = renderHook(() =>
      usePersistentTab({
        key: 'client_active_tab',
        defaultTab: 'projects',
        allowedTabs: ['projects', 'create', 'applicants', 'saved'] as const,
        walletAddress: WALLET,
      })
    );

    expect(second.result.current[0]).toBe('applicants');
  });

  it('restores persisted search and token filters after navigation', () => {
    const first = renderHook(() => ({
      search: usePersistentFilter<string>('client_projects_search', '', WALLET),
      token: usePersistentFilter<string>('client_projects_token', 'All', WALLET),
    }));

    act(() => {
      first.result.current.search[1]('audit');
      first.result.current.token[1]('XLM');
    });
    first.unmount();

    const second = renderHook(() => ({
      search: usePersistentFilter<string>('client_projects_search', '', WALLET),
      token: usePersistentFilter<string>('client_projects_token', 'All', WALLET),
    }));

    expect(second.result.current.search[0]).toBe('audit');
    expect(second.result.current.token[0]).toBe('XLM');
  });

  it('clears every persisted tab/filter key on logout', () => {
    store['trustpay_tab_client_active_tab'] = 'applicants';
    store['trustpay_filter_client_projects_search'] = JSON.stringify('audit');
    store['unrelated_key'] = 'keep-me';

    clearPersistedDashboardState();

    expect(store['trustpay_tab_client_active_tab']).toBeUndefined();
    expect(store['trustpay_filter_client_projects_search']).toBeUndefined();
    expect(store['unrelated_key']).toBe('keep-me');
  });
});
