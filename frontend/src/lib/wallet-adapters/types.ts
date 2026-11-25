export type WalletAdapterId = 'passkey' | 'freighter' | 'manual';

/** Uncompressed secp256r1 public key, the format Soroban passkey verifiers expect. */
export interface Secp256r1PublicKey {
  /** 32-byte X coordinate, hex encoded. */
  x: string;
  /** 32-byte Y coordinate, hex encoded. */
  y: string;
  /** `04 || X || Y`, hex encoded (65 bytes). */
  uncompressedHex: string;
}

export interface PasskeyCredential {
  credentialId: string;
  publicKey: Secp256r1PublicKey;
  /** Smart-account contract address derived from the passkey public key. */
  accountAddress: string;
  label: string;
  createdAt: string;
}

export interface PasskeyAssertion {
  credentialId: string;
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  /** 64-byte `r || s` signature accepted by Soroban's secp256r1 host function. */
  signature: Uint8Array;
  /** Original DER-encoded signature from WebAuthn, useful for debugging. */
  signatureDer: Uint8Array;
  userHandle: Uint8Array | null;
}

export interface WalletConnection {
  address: string;
  walletName: string;
  kind: WalletAdapterId;
  passkey?: PasskeyCredential;
}

export interface WalletAdapter {
  id: WalletAdapterId;
  name: string;
  isAvailable(): Promise<boolean>;
  connect(options?: { userName?: string; label?: string }): Promise<WalletConnection>;
  disconnect(): Promise<void>;
  /** Signs an arbitrary payload (e.g. a Soroban auth digest) with the passkey. */
  signPayload?(
    payload: Uint8Array
  ): Promise<{ signature: PasskeyAssertion; publicKey: Secp256r1PublicKey }>;
}
