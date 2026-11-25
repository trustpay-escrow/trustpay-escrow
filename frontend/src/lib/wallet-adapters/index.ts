import { isPasskeySupported, passkeyWalletAdapter } from './passkey-adapter';
import type { WalletAdapter, WalletAdapterId } from './types';

export * from './types';
export {
  PASSKEY_RP_NAME,
  PASSKEY_STORAGE_KEY,
  base64UrlToBytes,
  buildPasskeyAssertionOptions,
  buildPasskeyAuthArgs,
  buildPasskeyRegistrationOptions,
  bytesToBase64Url,
  bytesToHex,
  clearStoredPasskey,
  connectPasskeyWallet,
  derivePasskeySmartAccountAddress,
  derToRawSignature,
  generatePasskeyChallenge,
  isPasskeySupported,
  loadStoredPasskey,
  parseSecp256r1PublicKey,
  passkeyWalletAdapter,
  registerPasskey,
  saveStoredPasskey,
  sha256,
  signSorobanPayloadWithPasskey,
  signWithPasskey,
} from './passkey-adapter';

/** Every wallet adapter the app knows how to render. */
export const WALLET_ADAPTERS: WalletAdapter[] = [passkeyWalletAdapter];

export const PASSKEY_FALLBACK_MESSAGE =
  'Passkeys are unavailable in this browser. You can still connect with Freighter, xBull, Albedo, Rabet, or a Stellar public key.';

export function resolveWalletAdapter(id: WalletAdapterId): WalletAdapter | undefined {
  return WALLET_ADAPTERS.find((adapter) => adapter.id === id);
}

export async function listAvailableWalletAdapters(): Promise<WalletAdapter[]> {
  const results = await Promise.all(
    WALLET_ADAPTERS.map(async (adapter) => ({ adapter, available: await adapter.isAvailable() }))
  );
  return results.filter((result) => result.available).map((result) => result.adapter);
}

/** True when the current browser can register and use passkeys. */
export function detectPasskeySupport(): boolean {
  return isPasskeySupported();
}
