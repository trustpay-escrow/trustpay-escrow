/**
 * Stellar Passkey wallet adapter (#302).
 *
 * Uses the WebAuthn `navigator.credentials` API to register a secp256r1
 * (P-256) credential and sign Soroban auth payloads. The derived account is a
 * contract address (`C...`) that a passkey / account-abstraction smart wallet
 * (SEP-0030 style) can control, so no seed phrase is ever created.
 *
 * Scope: this adapter produces the secp256r1 public key, the raw 64-byte
 * signature and the Soroban `__check_auth` argument map. Delegating control of
 * a deployed escrow contract to that signer is a contract-side concern.
 */

import { nativeToScVal, StrKey, xdr } from '@stellar/stellar-sdk';
import type {
  PasskeyAssertion,
  PasskeyCredential,
  Secp256r1PublicKey,
  WalletAdapter,
  WalletConnection,
} from './types';

export const PASSKEY_STORAGE_KEY = 'trustpay.passkey.credential.v1';
export const PASSKEY_RP_NAME = 'TrustPay Escrow';
export const PASSKEY_TIMEOUT_MS = 60_000;
const P256_CURVE_OID = '2a8648ce3d030107';

/* ------------------------------------------------------------------ */
/* Encoding helpers                                                    */
/* ------------------------------------------------------------------ */

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto is required for passkey wallet support.');
  return subtle;
}

/** 32-byte unpredictable challenge for WebAuthn registration / assertions. */
export function generatePasskeyChallenge(length = 32): Uint8Array {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random number generation is unavailable in this browser.');
  }
  if (length < 16) throw new Error('WebAuthn challenges must be at least 16 bytes.');
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await getSubtle().digest('SHA-256', bytes as unknown as BufferSource);
  return new Uint8Array(digest);
}

function defaultRpId(): string {
  if (typeof window === 'undefined') return 'localhost';
  return window.location.hostname || 'localhost';
}

/** True when this browser exposes WebAuthn credential creation and use. */
export function isPasskeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.credentials !== 'undefined' &&
    typeof navigator.credentials.create === 'function' &&
    typeof navigator.credentials.get === 'function' &&
    typeof (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential !== 'undefined'
  );
}

/* ------------------------------------------------------------------ */
/* WebAuthn options                                                    */
/* ------------------------------------------------------------------ */

export interface PasskeyRegistrationInput {
  userName: string;
  /** Stable bytes identifying the account; max 64 bytes per WebAuthn. */
  userId?: Uint8Array;
  rpId?: string;
  challenge?: Uint8Array;
  displayName?: string;
}

export function buildPasskeyRegistrationOptions(
  input: PasskeyRegistrationInput
): PublicKeyCredentialCreationOptions {
  const rpId = input.rpId ?? defaultRpId();
  const userId = input.userId ?? generatePasskeyChallenge(32);
  if (userId.byteLength > 64) {
    throw new Error('WebAuthn user ids must be 64 bytes or fewer.');
  }

  return {
    challenge: (input.challenge ?? generatePasskeyChallenge()) as unknown as BufferSource,
    rp: { id: rpId, name: PASSKEY_RP_NAME },
    user: {
      id: userId as unknown as BufferSource,
      name: input.userName,
      displayName: input.displayName ?? input.userName,
    },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
    attestation: 'none',
    timeout: PASSKEY_TIMEOUT_MS,
  };
}

export function buildPasskeyAssertionOptions(input: {
  credentialId: string;
  challenge?: Uint8Array;
  rpId?: string;
}): PublicKeyCredentialRequestOptions {
  return {
    challenge: (input.challenge ?? generatePasskeyChallenge()) as unknown as BufferSource,
    rpId: input.rpId ?? defaultRpId(),
    allowCredentials: [
      {
        id: base64UrlToBytes(input.credentialId) as unknown as BufferSource,
        type: 'public-key',
        transports: ['internal', 'hybrid'],
      },
    ],
    userVerification: 'required',
    timeout: PASSKEY_TIMEOUT_MS,
  };
}

/* ------------------------------------------------------------------ */
/* DER / COSE parsing                                                  */
/* ------------------------------------------------------------------ */

interface DerTlv {
  tag: number;
  contentStart: number;
  contentEnd: number;
  end: number;
}

function readDerTlv(bytes: Uint8Array, offset: number): DerTlv {
  if (offset + 2 > bytes.length) throw new Error('Truncated DER structure.');
  const tag = bytes[offset];
  let cursor = offset + 1;
  let length = bytes[cursor];
  cursor += 1;

  if (length & 0x80) {
    const lengthBytes = length & 0x7f;
    if (lengthBytes === 0 || lengthBytes > 4) throw new Error('Unsupported DER length encoding.');
    length = 0;
    for (let i = 0; i < lengthBytes; i += 1) {
      if (cursor >= bytes.length) throw new Error('Truncated DER length.');
      length = (length << 8) | bytes[cursor];
      cursor += 1;
    }
  }

  const contentStart = cursor;
  const contentEnd = contentStart + length;
  if (contentEnd > bytes.length) throw new Error('DER structure exceeds the buffer.');
  return { tag, contentStart, contentEnd, end: contentEnd };
}

/**
 * Parses a DER SubjectPublicKeyInfo (what `AuthenticatorAttestationResponse.getPublicKey()`
 * returns) into the uncompressed P-256 point used by Soroban contracts.
 */
export function parseSecp256r1PublicKey(spki: ArrayBuffer | Uint8Array): Secp256r1PublicKey {
  const bytes = spki instanceof Uint8Array ? spki : new Uint8Array(spki);

  // Some browsers return the raw 0x04 || X || Y point.
  if (bytes.length === 65 && bytes[0] === 0x04) {
    return toPublicKey(bytes.slice(1, 33), bytes.slice(33, 65));
  }

  const root = readDerTlv(bytes, 0);
  if (root.tag !== 0x30) throw new Error('Public key is not a DER SubjectPublicKeyInfo structure.');

  let bitString: Uint8Array | null = null;
  let offset = root.contentStart;
  while (offset < root.contentEnd) {
    const tlv = readDerTlv(bytes, offset);
    if (tlv.tag === 0x03) {
      const content = bytes.slice(tlv.contentStart, tlv.contentEnd);
      if (content.length < 2 || content[0] !== 0) {
        throw new Error('Unsupported EC public key bit string.');
      }
      bitString = content.slice(1);
      break;
    }
    offset = tlv.end;
  }

  if (!bitString) throw new Error('DER structure does not contain an EC public key.');
  const oid = bytesToHex(bytes).includes(P256_CURVE_OID);
  if (!oid) throw new Error('Public key is not on the P-256 (secp256r1) curve.');
  if (bitString.length !== 65 || bitString[0] !== 0x04) {
    throw new Error('Uncompressed P-256 points must be 65 bytes starting with 0x04.');
  }

  return toPublicKey(bitString.slice(1, 33), bitString.slice(33, 65));
}

function toPublicKey(x: Uint8Array, y: Uint8Array): Secp256r1PublicKey {
  const uncompressed = new Uint8Array(65);
  uncompressed[0] = 0x04;
  uncompressed.set(x, 1);
  uncompressed.set(y, 33);
  return {
    x: bytesToHex(x),
    y: bytesToHex(y),
    uncompressedHex: bytesToHex(uncompressed),
  };
}

/** Converts a DER ECDSA signature into the fixed 64-byte `r || s` form. */
export function derToRawSignature(der: Uint8Array): Uint8Array {
  const root = readDerTlv(der, 0);
  if (root.tag !== 0x30) throw new Error('ECDSA signature is not a DER sequence.');

  let offset = root.contentStart;
  const integers: Uint8Array[] = [];
  while (offset < root.contentEnd) {
    const tlv = readDerTlv(der, offset);
    if (tlv.tag === 0x02) {
      integers.push(der.slice(tlv.contentStart, tlv.contentEnd));
    }
    offset = tlv.end;
  }

  if (integers.length !== 2) throw new Error('ECDSA signature must contain r and s integers.');

  const normalize = (value: Uint8Array): Uint8Array => {
    let start = 0;
    while (start < value.length - 1 && value[start] === 0) start += 1;
    const trimmed = value.slice(start);
    if (trimmed.length > 32) throw new Error('ECDSA signature integer exceeds 32 bytes.');
    const out = new Uint8Array(32);
    out.set(trimmed, 32 - trimmed.length);
    return out;
  };

  const raw = new Uint8Array(64);
  raw.set(normalize(integers[0]), 0);
  raw.set(normalize(integers[1]), 32);
  return raw;
}

/**
 * Derives the smart-account contract address from the passkey public key.
 * The digest is derived from the credential's uncompressed key so the address
 * is stable for a given passkey on every device.
 */
export async function derivePasskeySmartAccountAddress(
  publicKey: Secp256r1PublicKey
): Promise<string> {
  const seed = new TextEncoder().encode(`trustpay:passkey:v1:${publicKey.uncompressedHex}`);
  const digest = await sha256(seed);
  return StrKey.encodeContract(
    digest as unknown as Parameters<typeof StrKey.encodeContract>[0]
  );
}

/* ------------------------------------------------------------------ */
/* Registration and signing                                            */
/* ------------------------------------------------------------------ */

function requireCredentials(): CredentialsContainer {
  if (!isPasskeySupported()) {
    throw new Error(
      'This browser or device does not support passkeys (TouchID / FaceID / Windows Hello).'
    );
  }
  return navigator.credentials;
}

export async function registerPasskey(
  input: PasskeyRegistrationInput
): Promise<PasskeyCredential> {
  const options = buildPasskeyRegistrationOptions(input);
  const credential = (await requireCredentials().create({
    publicKey: options,
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error('Passkey registration was cancelled.');

  const response = credential.response as AuthenticatorAttestationResponse;
  if (typeof response.getPublicKey !== 'function') {
    throw new Error('This browser cannot export the passkey public key.');
  }
  const spki = response.getPublicKey();
  if (!spki) throw new Error('The authenticator did not return a public key.');

  const publicKey = parseSecp256r1PublicKey(spki);
  return {
    credentialId: bytesToBase64Url(new Uint8Array(credential.rawId)),
    publicKey,
    accountAddress: await derivePasskeySmartAccountAddress(publicKey),
    label: input.displayName ?? input.userName,
    createdAt: new Date().toISOString(),
  };
}

export async function signWithPasskey(input: {
  credentialId: string;
  challenge?: Uint8Array;
  rpId?: string;
}): Promise<PasskeyAssertion> {
  const options = buildPasskeyAssertionOptions(input);
  const assertion = (await requireCredentials().get({
    publicKey: options,
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error('Passkey signature was cancelled.');

  const response = assertion.response as AuthenticatorAssertionResponse;
  const signatureDer = new Uint8Array(response.signature);

  return {
    credentialId: bytesToBase64Url(new Uint8Array(assertion.rawId)),
    authenticatorData: new Uint8Array(response.authenticatorData),
    clientDataJSON: new Uint8Array(response.clientDataJSON),
    signature: derToRawSignature(signatureDer),
    signatureDer,
    userHandle: response.userHandle ? new Uint8Array(response.userHandle) : null,
  };
}

/**
 * Signs a transaction XDR digest. The returned payload can be passed to a
 * passkey smart-account contract's `__check_auth` entry point.
 */
export async function signSorobanPayloadWithPasskey(input: {
  credentialId: string;
  payload: Uint8Array;
  rpId?: string;
}): Promise<{ assertion: PasskeyAssertion; payloadHash: string }> {
  const digest = await sha256(input.payload);
  const assertion = await signWithPasskey({
    credentialId: input.credentialId,
    challenge: digest,
    rpId: input.rpId,
  });
  return { assertion, payloadHash: bytesToHex(digest) };
}

/**
 * Builds the Soroban auth argument map for a passkey smart account. Keeping
 * this pure makes the signed envelope easy to unit test.
 */
export function buildPasskeyAuthArgs(input: {
  publicKey: Secp256r1PublicKey;
  assertion: Pick<PasskeyAssertion, 'signature' | 'authenticatorData' | 'clientDataJSON'>;
}): xdr.ScVal {
  const publicKeyBytes = Uint8Array.from(
    input.publicKey.uncompressedHex.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) ?? []
  );

  const entry = (name: string, value: Uint8Array) =>
    new xdr.ScMapEntry({
      key: nativeToScVal(name, { type: 'symbol' }),
      val: nativeToScVal(value, { type: 'bytes' }),
    });

  return xdr.ScVal.scvMap([
    entry('public_key', publicKeyBytes),
    entry('signature', input.assertion.signature),
    entry('authenticator_data', input.assertion.authenticatorData),
    entry('client_data_json', input.assertion.clientDataJSON),
  ]);
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function isStoredCredential(value: unknown): value is PasskeyCredential {
  const v = value as PasskeyCredential;
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof v.credentialId === 'string' &&
    typeof v.accountAddress === 'string' &&
    typeof v.publicKey?.uncompressedHex === 'string'
  );
}

export function loadStoredPasskey(
  store: Pick<Storage, 'getItem'> | undefined = storage()
): PasskeyCredential | null {
  try {
    const raw = store?.getItem(PASSKEY_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredCredential(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveStoredPasskey(
  credential: PasskeyCredential,
  store: Pick<Storage, 'setItem'> | undefined = storage()
): void {
  try {
    store?.setItem(PASSKEY_STORAGE_KEY, JSON.stringify(credential));
  } catch {
    /* private mode: the passkey still works for this session */
  }
}

export function clearStoredPasskey(store: Pick<Storage, 'removeItem'> | undefined = storage()): void {
  try {
    store?.removeItem(PASSKEY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Adapter                                                             */
/* ------------------------------------------------------------------ */

export async function connectPasskeyWallet(options?: {
  userName?: string;
  label?: string;
}): Promise<WalletConnection> {
  const userName = options?.userName?.trim() || 'TrustPay User';
  const existing = loadStoredPasskey();

  if (existing) {
    const digest = await sha256(new TextEncoder().encode(`trustpay:login:${existing.accountAddress}`));
    await signWithPasskey({ credentialId: existing.credentialId, challenge: digest });
    return {
      address: existing.accountAddress,
      walletName: 'Passkey (WebAuthn)',
      kind: 'passkey',
      passkey: existing,
    };
  }

  const credential = await registerPasskey({
    userName,
    displayName: options?.label || userName,
    userId: generatePasskeyChallenge(32),
  });
  saveStoredPasskey(credential);
  return {
    address: credential.accountAddress,
    walletName: 'Passkey (WebAuthn)',
    kind: 'passkey',
    passkey: credential,
  };
}

export const passkeyWalletAdapter: WalletAdapter = {
  id: 'passkey',
  name: 'Passkey (WebAuthn)',
  isAvailable: async () => isPasskeySupported(),
  connect: connectPasskeyWallet,
  disconnect: async () => {
    // Credentials stay in the platform authenticator; only the local link is removed.
    clearStoredPasskey();
  },
  signPayload: async (payload: Uint8Array) => {
    const credential = loadStoredPasskey();
    if (!credential) throw new Error('Register a passkey before signing escrow actions.');
    const { assertion } = await signSorobanPayloadWithPasskey({
      credentialId: credential.credentialId,
      payload,
    });
    return { signature: assertion, publicKey: credential.publicKey };
  },
};
