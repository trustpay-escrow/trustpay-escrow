'use client';

import {
  isConnected as isFreighterConnected,
  requestAccess as requestFreighterAccess,
  signTransaction as signFreighterTransaction,
  getNetworkDetails as getFreighterNetworkDetails,
} from '@stellar/freighter-api';

export type SupportedWalletId = 'freighter' | 'xbull' | 'lobstr' | 'hana' | 'albedo' | 'manual';

export interface WalletAdapterInfo {
  id: SupportedWalletId;
  name: string;
  tagline: string;
  type: 'extension' | 'web' | 'mobile';
  icon: string;
  badge?: string;
  badgeColor?: string;
  downloadUrl?: string;
  supportsQr?: boolean;
}

export interface WalletConnectionResult {
  address: string;
  walletName: string;
  walletType: SupportedWalletId;
}

export interface WalletAdapter extends WalletAdapterInfo {
  isInstalled: () => Promise<boolean> | boolean;
  connect: () => Promise<WalletConnectionResult>;
  signTransaction: (
    xdr: string,
    options?: { networkPassphrase?: string }
  ) => Promise<string>;
  getDeepLinkUrl?: (xdr?: string) => string;
}

// Helper for opening Albedo intent popups
async function executeAlbedoIntent<T>(intent: string, params: Record<string, string>): Promise<T> {
  if (typeof window === 'undefined') throw new Error('Window is not available');

  const width = 450;
  const height = 660;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  const query = new URLSearchParams(params).toString();
  const url = `https://albedo.link/intent/${intent}?${query}`;

  const popup = window.open(
    url,
    `albedo-${intent}`,
    `width=${width},height=${height},left=${left},top=${top},status=0,menubar=0,toolbar=0`
  );

  if (!popup) {
    throw new Error('Albedo popup blocked by browser. Please allow popups for albedo.link.');
  }

  return new Promise<T>((resolve, reject) => {
    let closedCheckTimer: any = null;

    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== 'https://albedo.link') return;
      const data = event.data;
      if (!data) return;

      if (data.error) {
        cleanup();
        reject(new Error(data.error.message || data.error || 'Albedo request rejected'));
      } else {
        cleanup();
        resolve(data as T);
      }
    };

    const cleanup = () => {
      if (closedCheckTimer) clearInterval(closedCheckTimer);
      window.removeEventListener('message', messageHandler);
      try {
        if (!popup.closed) popup.close();
      } catch {}
    };

    window.addEventListener('message', messageHandler);

    closedCheckTimer = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('Albedo window closed without completing action'));
      }
    }, 800);
  });
}

// 1. FREIGHTER ADAPTER
export const freighterAdapter: WalletAdapter = {
  id: 'freighter',
  name: 'Freighter Wallet',
  tagline: 'Official SDF browser extension for Soroban',
  type: 'extension',
  icon: '🪐',
  badge: 'Recommended',
  badgeColor: 'blue',
  downloadUrl: 'https://www.freighter.app/',
  supportsQr: false,
  isInstalled: async () => {
    if (typeof window === 'undefined') return false;
    try {
      const res = await isFreighterConnected();
      return typeof res === 'boolean' ? res : Boolean(res?.isConnected);
    } catch {
      return false;
    }
  },
  connect: async () => {
    const conn = await isFreighterConnected();
    const installed = typeof conn === 'boolean' ? conn : Boolean(conn?.isConnected);
    if (!installed) {
      throw new Error('Freighter wallet extension is not installed. Please install Freighter from freighter.app.');
    }
    const response = await requestFreighterAccess();
    if (response.error) {
      throw new Error(typeof response.error === 'string' ? response.error : 'Freighter access denied');
    }
    if (!response.address) {
      throw new Error('Freighter did not return a public address');
    }
    return {
      address: response.address,
      walletName: 'Freighter',
      walletType: 'freighter',
    };
  },
  signTransaction: async (xdr: string, options) => {
    const networkPassphrase = options?.networkPassphrase;
    const signResult = await signFreighterTransaction(xdr, { networkPassphrase });
    if (typeof signResult === 'string') return signResult;
    if (signResult && (signResult as any).signedTxXdr) return (signResult as any).signedTxXdr;
    if (signResult && (signResult as any).signedTransaction) return (signResult as any).signedTransaction;
    if (signResult && (signResult as any).error) {
      throw new Error(typeof (signResult as any).error === 'string' ? (signResult as any).error : (signResult as any).error.message || 'Signing failed');
    }
    throw new Error('Freighter signing returned invalid or empty response');
  },
};

// 2. XBULL ADAPTER
export const xBullAdapter: WalletAdapter = {
  id: 'xbull',
  name: 'xBull Wallet',
  tagline: 'DeFi & Soroban browser extension / Web App',
  type: 'extension',
  icon: '🐂',
  badge: 'Popular',
  badgeColor: 'amber',
  downloadUrl: 'https://xbull.app/',
  supportsQr: false,
  isInstalled: () => {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).xBullSDK || (window as any).xbull);
  },
  connect: async () => {
    if (typeof window !== 'undefined' && (window as any).xBullSDK) {
      const xBull = (window as any).xBullSDK;
      const pubKey = await xBull.getPublicKey();
      if (!pubKey) {
        throw new Error('xBull authorization was cancelled or denied');
      }
      return {
        address: pubKey,
        walletName: 'xBull Wallet',
        walletType: 'xbull',
      };
    }
    throw new Error('xBull extension is not detected in your browser. Install xBull from xbull.app or use Albedo.');
  },
  signTransaction: async (xdr: string, options) => {
    if (typeof window !== 'undefined' && (window as any).xBullSDK) {
      const xBull = (window as any).xBullSDK;
      const res = await xBull.sign({
        xdr,
        network: options?.networkPassphrase,
      });
      if (typeof res === 'string') return res;
      if (res && res.signedTxXdr) return res.signedTxXdr;
      if (res && res.xdr) return res.xdr;
      throw new Error('xBull signing cancelled');
    }
    throw new Error('xBull SDK not detected');
  },
};

// 3. LOBSTR ADAPTER (Mobile & Web via QR / Deep-link)
export const lobstrAdapter: WalletAdapter = {
  id: 'lobstr',
  name: 'Lobstr Wallet',
  tagline: 'Mobile & Web Stellar wallet with QR pairing',
  type: 'mobile',
  icon: '🦞',
  badge: 'Mobile QR',
  badgeColor: 'cyan',
  downloadUrl: 'https://lobstr.co/',
  supportsQr: true,
  isInstalled: () => {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).lobstr);
  },
  connect: async () => {
    // If browser extension detected
    if (typeof window !== 'undefined' && (window as any).lobstr) {
      const lobstr = (window as any).lobstr;
      const pubKey = await lobstr.getPublicKey();
      if (pubKey) {
        return {
          address: pubKey,
          walletName: 'Lobstr Wallet',
          walletType: 'lobstr',
        };
      }
    }
    // Return instruction / intent for QR connect
    throw new Error('Lobstr mobile QR connect: scan the QR code in your Lobstr app or enter your public key.');
  },
  signTransaction: async (xdr: string, options) => {
    if (typeof window !== 'undefined' && (window as any).lobstr) {
      const lobstr = (window as any).lobstr;
      const signed = await lobstr.signTransaction(xdr, options);
      if (signed) return signed;
    }
    // Fallback to SEP-0007 web+stellar intent
    const sep0007Url = `web+stellar:tx?xdr=${encodeURIComponent(xdr)}`;
    if (typeof window !== 'undefined') {
      window.open(sep0007Url, '_blank');
    }
    throw new Error('Lobstr mobile signature requested. Please approve in your Lobstr app.');
  },
  getDeepLinkUrl: (xdr) => {
    if (xdr) return `lobstr://tx?xdr=${encodeURIComponent(xdr)}`;
    return 'lobstr://';
  },
};

// 4. HANA WALLET ADAPTER
export const hanaAdapter: WalletAdapter = {
  id: 'hana',
  name: 'Hana Wallet',
  tagline: 'Multi-chain mobile & extension wallet for Stellar',
  type: 'extension',
  icon: '🌸',
  badge: 'Multi-chain',
  badgeColor: 'purple',
  downloadUrl: 'https://hanawallet.io/',
  supportsQr: false,
  isInstalled: () => {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).hanaWallet || (window as any).hana);
  },
  connect: async () => {
    if (typeof window !== 'undefined' && ((window as any).hanaWallet || (window as any).hana)) {
      const hana = (window as any).hanaWallet || (window as any).hana;
      const stellarProvider = hana.stellar || hana;
      if (stellarProvider.getPublicKey) {
        const key = await stellarProvider.getPublicKey();
        if (key) {
          return {
            address: key,
            walletName: 'Hana Wallet',
            walletType: 'hana',
          };
        }
      }
      if (stellarProvider.requestAccess) {
        const res = await stellarProvider.requestAccess();
        if (res && res.address) {
          return {
            address: res.address,
            walletName: 'Hana Wallet',
            walletType: 'hana',
          };
        }
      }
    }
    throw new Error('Hana Wallet extension not detected. Install from hanawallet.io.');
  },
  signTransaction: async (xdr: string, options) => {
    if (typeof window !== 'undefined' && ((window as any).hanaWallet || (window as any).hana)) {
      const hana = (window as any).hanaWallet || (window as any).hana;
      const stellarProvider = hana.stellar || hana;
      if (stellarProvider.signTransaction) {
        const res = await stellarProvider.signTransaction(xdr, options);
        if (typeof res === 'string') return res;
        if (res && res.signedTxXdr) return res.signedTxXdr;
      }
    }
    throw new Error('Hana Wallet signing unavailable');
  },
};

// 5. ALBEDO ADAPTER (Instant Web Intent - Universal)
export const albedoAdapter: WalletAdapter = {
  id: 'albedo',
  name: 'Albedo',
  tagline: 'Universal web intent - works on desktop & mobile without extension',
  type: 'web',
  icon: '⚡',
  badge: 'Universal Web',
  badgeColor: 'emerald',
  downloadUrl: 'https://albedo.link/',
  supportsQr: true,
  isInstalled: () => true, // Universal, always available in any browser
  connect: async () => {
    const data = await executeAlbedoIntent<{ pubkey: string }>('public_key', {});
    if (!data || !data.pubkey) {
      throw new Error('Albedo did not return a public key');
    }
    return {
      address: data.pubkey,
      walletName: 'Albedo',
      walletType: 'albedo',
    };
  },
  signTransaction: async (xdr: string, options) => {
    const network = options?.networkPassphrase?.includes('Test') ? 'testnet' : 'public';
    const data = await executeAlbedoIntent<{ signed_envelope_xdr: string }>('tx', {
      xdr,
      network,
    });
    if (!data || !data.signed_envelope_xdr) {
      throw new Error('Albedo did not return signed transaction XDR');
    }
    return data.signed_envelope_xdr;
  },
  getDeepLinkUrl: (xdr) => {
    if (xdr) return `https://albedo.link/intent/tx?xdr=${encodeURIComponent(xdr)}`;
    return 'https://albedo.link/intent/public_key';
  },
};

// 6. ALL ADAPTERS REGISTRY
export const WALLET_ADAPTERS: Record<SupportedWalletId, WalletAdapter> = {
  freighter: freighterAdapter,
  xbull: xBullAdapter,
  lobstr: lobstrAdapter,
  hana: hanaAdapter,
  albedo: albedoAdapter,
  manual: {
    id: 'manual',
    name: 'Manual Key / Custom',
    tagline: 'Paste any Stellar G... public address',
    type: 'web',
    icon: '🔑',
    badge: 'Auditing',
    isInstalled: () => true,
    connect: async () => {
      throw new Error('Manual public key entry required');
    },
    signTransaction: async () => {
      throw new Error('Manual keys cannot sign transactions cryptographically');
    },
  },
};

export function getAllAdapters(): WalletAdapter[] {
  return [freighterAdapter, xBullAdapter, lobstrAdapter, hanaAdapter, albedoAdapter];
}

export function getWalletAdapter(id: SupportedWalletId): WalletAdapter {
  const adapter = WALLET_ADAPTERS[id];
  if (!adapter) return freighterAdapter;
  return adapter;
}

/**
 * Universal signing helper across all supported wallets
 */
export async function signWithWallet(
  walletType: SupportedWalletId | null | undefined,
  xdr: string,
  options?: { networkPassphrase?: string }
): Promise<string> {
  const adapter = getWalletAdapter(walletType || 'freighter');
  return await adapter.signTransaction(xdr, options);
}
