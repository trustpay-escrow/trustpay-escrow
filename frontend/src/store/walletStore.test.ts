import { describe, it, expect, beforeEach } from 'vitest';
import { useWalletStore } from './walletStore';

describe('useWalletStore Zustand Store', () => {
  beforeEach(() => {
    useWalletStore.getState().disconnect();
  });

  it('initializes with default disconnected client state', () => {
    const state = useWalletStore.getState();
    expect(state.address).toBeNull();
    expect(state.activeRole).toBe('client');
    expect(state.isClient).toBe(true);
    expect(state.isFreelancer).toBe(true);
  });

  it('updates wallet information upon connection', () => {
    const mockAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGOF2W2GOGC25NC47WG';
    useWalletStore.getState().setWalletInfo(mockAddress, true, true);

    const state = useWalletStore.getState();
    expect(state.address).toBe(mockAddress);
    expect(state.isClient).toBe(true);
    expect(state.isFreelancer).toBe(true);
    expect(state.walletName).toBe('Freighter');
  });

  it('toggles between client and freelancer roles', () => {
    useWalletStore.getState().setActiveRole('freelancer');
    expect(useWalletStore.getState().activeRole).toBe('freelancer');

    useWalletStore.getState().setActiveRole('client');
    expect(useWalletStore.getState().activeRole).toBe('client');
  });

  it('clears session on disconnect', () => {
    useWalletStore.getState().setWalletInfo('GBRP...', true, true);
    useWalletStore.getState().setActiveRole('freelancer');
    useWalletStore.getState().disconnect();

    const state = useWalletStore.getState();
    expect(state.address).toBeNull();
    expect(state.activeRole).toBe('client');
  });
});
