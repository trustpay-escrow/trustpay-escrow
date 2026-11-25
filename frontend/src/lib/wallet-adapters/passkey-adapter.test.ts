import { webcrypto } from 'node:crypto';
import { xdr } from '@stellar/stellar-sdk';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PASSKEY_STORAGE_KEY,
  base64UrlToBytes,
  buildPasskeyAssertionOptions,
  buildPasskeyAuthArgs,
  buildPasskeyRegistrationOptions,
  bytesToBase64Url,
  connectPasskeyWallet,
  derToRawSignature,
  derivePasskeySmartAccountAddress,
  generatePasskeyChallenge,
  isPasskeySupported,
  loadStoredPasskey,
  parseSecp256r1PublicKey,
  registerPasskey,
  sha256,
  signSorobanPayloadWithPasskey,
  signWithPasskey,
} from './passkey-adapter';

function buildSpki(): Uint8Array {
  const x = new Uint8Array(32).fill(0x11);
  const y = new Uint8Array(32).fill(0x22);
  return Uint8Array.from([
    0x30, 0x59,
    0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
    0x03, 0x42, 0x00, 0x04,
    ...x,
    ...y,
  ]);
}

function derSignature(r: number, s: number): Uint8Array {
  const encodeInteger = (value: number) => {
    const raw = [value];
    if (raw[0] & 0x80) raw.unshift(0);
    return [0x02, raw.length, ...raw];
  };
  const body = [...encodeInteger(r), ...encodeInteger(s)];
  return Uint8Array.from([0x30, body.length, ...body]);
}

const createMock = vi.fn();
const getMock = vi.fn();

beforeAll(() => {
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('PublicKeyCredential', class PublicKeyCredential {});
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: { create: createMock, get: getMock },
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'credentials');
});

beforeEach(() => {
  localStorage.clear();
  createMock.mockReset();
  getMock.mockReset();
});

describe('WebAuthn utilities (#302)', () => {
  it('generates unique 32-byte challenges and rejects short ones', () => {
    const first = generatePasskeyChallenge();
    const second = generatePasskeyChallenge();
    expect(first).toHaveLength(32);
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(false);
    expect(() => generatePasskeyChallenge(8)).toThrow(/16 bytes/);
  });

  it('round-trips base64url credential ids', () => {
    const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes);
    expect(bytesToBase64Url(bytes)).not.toMatch(/[+/=]/);
  });

  it('builds registration options that request a P-256 resident credential', () => {
    const options = buildPasskeyRegistrationOptions({
      userName: 'ada@example.com',
      rpId: 'app.trustpay.test',
      challenge: new Uint8Array(32).fill(7),
      userId: new Uint8Array(16).fill(3),
    });

    expect(options.rp.id).toBe('app.trustpay.test');
    expect(options.rp.name).toContain('TrustPay');
    expect(options.pubKeyCredParams).toEqual([{ type: 'public-key', alg: -7 }]);
    expect(options.authenticatorSelection?.userVerification).toBe('required');
    expect(options.challenge).toEqual(new Uint8Array(32).fill(7));
  });

  it('builds assertion options scoped to the stored credential', () => {
    const credentialId = bytesToBase64Url(Uint8Array.from([9, 8, 7]));
    const options = buildPasskeyAssertionOptions({ credentialId, rpId: 'app.trustpay.test' });
    expect(options.rpId).toBe('app.trustpay.test');
    expect(options.allowCredentials?.[0].type).toBe('public-key');
    expect(Array.from(new Uint8Array(options.allowCredentials![0].id as ArrayBuffer))).toEqual([9, 8, 7]);
  });
});

describe('secp256r1 key and signature parsing (#302)', () => {
  it('extracts the uncompressed P-256 point from a DER SubjectPublicKeyInfo', () => {
    const publicKey = parseSecp256r1PublicKey(buildSpki());
    expect(publicKey.x).toBe('11'.repeat(32));
    expect(publicKey.y).toBe('22'.repeat(32));
    expect(publicKey.uncompressedHex).toBe(`04${'11'.repeat(32)}${'22'.repeat(32)}`);
    expect(publicKey.uncompressedHex).toHaveLength(130);
  });

  it('accepts a raw uncompressed point', () => {
    const raw = Uint8Array.from([0x04, ...new Uint8Array(64).fill(5)]);
    expect(parseSecp256r1PublicKey(raw).uncompressedHex).toBe(
      `04${Buffer.from(new Uint8Array(64).fill(5)).toString('hex')}`
    );
  });

  it('rejects malformed and non-P-256 keys', () => {
    expect(() => parseSecp256r1PublicKey(Uint8Array.from([0x30, 0x00]))).toThrow();
    const rsaSpki = buildSpki();
    rsaSpki.fill(0, 12, 21); // drop the ecPublicKey OID
    expect(() => parseSecp256r1PublicKey(rsaSpki)).toThrow(/P-256/);
  });

  it('converts DER ECDSA signatures to 64-byte r||s', () => {
    const raw = derToRawSignature(derSignature(1, 2));
    expect(raw).toHaveLength(64);
    expect(raw[31]).toBe(1);
    expect(raw[63]).toBe(2);
  });

  it('normalises integers with a DER sign pad byte', () => {
    const raw = derToRawSignature(derSignature(0x80, 0xff));
    expect(raw[31]).toBe(0x80);
    expect(raw[63]).toBe(0xff);
  });

  it('derives a deterministic Soroban smart-account address', async () => {
    const publicKey = parseSecp256r1PublicKey(buildSpki());
    const first = await derivePasskeySmartAccountAddress(publicKey);
    const second = await derivePasskeySmartAccountAddress(publicKey);
    expect(first).toBe(second);
    expect(first.startsWith('C')).toBe(true);
    expect(first).toHaveLength(56);

    const other = await derivePasskeySmartAccountAddress(
      parseSecp256r1PublicKey(Uint8Array.from([0x04, ...new Uint8Array(64).fill(9)]))
    );
    expect(other).not.toBe(first);
  });
});

describe('passkey registration and signing (#302)', () => {
  it('registers a credential and derives its smart account', async () => {
    const spki = buildSpki();
    createMock.mockResolvedValue({
      rawId: Uint8Array.from([1, 2, 3]).buffer,
      response: { getPublicKey: () => spki.buffer },
    });

    const credential = await registerPasskey({ userName: 'ada', userId: new Uint8Array(16) });
    expect(credential.credentialId).toBe(bytesToBase64Url(Uint8Array.from([1, 2, 3])));
    expect(credential.publicKey.x).toBe('11'.repeat(32));
    expect(credential.accountAddress.startsWith('C')).toBe(true);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('signs with a mocked WebAuthn assertion', async () => {
    const der = derSignature(5, 6);
    getMock.mockResolvedValue({
      rawId: Uint8Array.from([4, 5, 6]).buffer,
      response: {
        authenticatorData: Uint8Array.from([7, 7]).buffer,
        clientDataJSON: Uint8Array.from([8, 8]).buffer,
        signature: der.buffer,
        userHandle: null,
      },
    });

    const assertion = await signWithPasskey({ credentialId: 'AQID' });
    expect(assertion.credentialId).toBe(bytesToBase64Url(Uint8Array.from([4, 5, 6])));
    expect(assertion.signature).toHaveLength(64);
    expect(assertion.signature[31]).toBe(5);
    expect(assertion.signature[63]).toBe(6);
    expect(assertion.signatureDer).toEqual(der);
    expect(assertion.authenticatorData).toEqual(Uint8Array.from([7, 7]));
  });

  it('hashes the Soroban payload before signing it', async () => {
    getMock.mockResolvedValue({
      rawId: Uint8Array.from([4, 5, 6]).buffer,
      response: {
        authenticatorData: Uint8Array.from([1]).buffer,
        clientDataJSON: Uint8Array.from([2]).buffer,
        signature: derSignature(1, 1).buffer,
        userHandle: null,
      },
    });

    const payload = new TextEncoder().encode('soroban-auth-entry');
    const { assertion, payloadHash } = await signSorobanPayloadWithPasskey({
      credentialId: 'AQID',
      payload,
    });

    const expectedHash = Buffer.from(await sha256(payload)).toString('hex');
    expect(payloadHash).toBe(expectedHash);
    expect(getMock.mock.calls[0][0].publicKey.challenge).toEqual(await sha256(payload));
    expect(assertion.signature).toHaveLength(64);
  });

  it('builds the Soroban __check_auth argument map', async () => {
    const publicKey = parseSecp256r1PublicKey(buildSpki());
    const assertion = {
      signature: new Uint8Array(64).fill(3),
      authenticatorData: Uint8Array.from([1, 2]),
      clientDataJSON: Uint8Array.from([4, 5]),
    };

    const args = buildPasskeyAuthArgs({ publicKey, assertion });
    expect(args.switch().name).toBe('scvMap');

    const roundTripped = xdr.ScVal.fromXDR(args.toXDR());
    const entries = roundTripped.map()!;
    const byKey = new Map(
      entries.map((entry) => [entry.key().sym().toString(), entry.val().bytes().toString('hex')])
    );

    expect(byKey.get('public_key')).toBe(publicKey.uncompressedHex);
    expect(byKey.get('signature')).toBe('03'.repeat(64));
    expect(byKey.get('authenticator_data')).toBe('0102');
    expect(byKey.get('client_data_json')).toBe('0405');
  });
});

describe('passkey wallet adapter (#302)', () => {
  it('detects WebAuthn support and persists the registered credential', async () => {
    expect(isPasskeySupported()).toBe(true);

    createMock.mockResolvedValue({
      rawId: Uint8Array.from([1]).buffer,
      response: { getPublicKey: () => buildSpki().buffer },
    });

    const connection = await connectPasskeyWallet({ userName: 'Ada' });
    expect(connection.kind).toBe('passkey');
    expect(connection.walletName).toContain('Passkey');
    expect(connection.address.startsWith('C')).toBe(true);
    expect(loadStoredPasskey()?.credentialId).toBe(bytesToBase64Url(Uint8Array.from([1])));
    expect(localStorage.getItem(PASSKEY_STORAGE_KEY)).toContain('accountAddress');
  });

  it('re-uses a stored credential on sign-in and prompts for biometrics', async () => {
    createMock.mockResolvedValue({
      rawId: Uint8Array.from([1]).buffer,
      response: { getPublicKey: () => buildSpki().buffer },
    });
    const first = await connectPasskeyWallet({ userName: 'Ada' });

    getMock.mockResolvedValue({
      rawId: Uint8Array.from([1]).buffer,
      response: {
        authenticatorData: Uint8Array.from([0]).buffer,
        clientDataJSON: Uint8Array.from([0]).buffer,
        signature: derSignature(1, 2).buffer,
        userHandle: null,
      },
    });

    const second = await connectPasskeyWallet();
    expect(second.address).toBe(first.address);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledTimes(1);
  });
});
