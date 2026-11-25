import { webcrypto } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  EncryptedSignalingTransport,
  SignalingError,
  computeConnectionQuality,
  createSignalingMessage,
  decryptSignalingMessage,
  deriveSharedSessionKey,
  encryptSignalingMessage,
  generateSessionKeyPair,
  isIceCandidatePayload,
  isOfferPayload,
  parseSignalingMessage,
  readRtcStats,
  serializeSignalingMessage,
  type SignalingEnvelope,
} from './webrtc-signaling';

beforeAll(() => {
  vi.stubGlobal('crypto', webcrypto);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const offer = createSignalingMessage({
  roomId: 'project-42-review',
  sender: 'GCLIENT',
  role: 'client',
  type: 'offer',
  payload: { type: 'offer' as const, sdp: 'v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\n' },
});

describe('signaling message serialization (#304)', () => {
  it('round-trips an SDP offer through JSON', () => {
    const parsed = parseSignalingMessage(serializeSignalingMessage(offer));
    expect(parsed).toMatchObject({
      version: 1,
      roomId: 'project-42-review',
      sender: 'GCLIENT',
      role: 'client',
      type: 'offer',
    });
    expect(isOfferPayload(parsed.payload)).toBe(true);
  });

  it('creates unique message ids and ISO timestamps', () => {
    const first = createSignalingMessage({
      roomId: 'r',
      sender: 'GA',
      role: 'client',
      type: 'ice-candidate',
      payload: {},
    });
    const second = createSignalingMessage({
      roomId: 'r',
      sender: 'GA',
      role: 'client',
      type: 'ice-candidate',
      payload: {},
    });
    expect(first.id).not.toBe(second.id);
    expect(Number.isNaN(Date.parse(first.sentAt))).toBe(false);
  });

  it('rejects malformed, oversized and unsupported frames', () => {
    expect(() => parseSignalingMessage('')).toThrow(SignalingError);
    expect(() => parseSignalingMessage('{not json')).toThrow(/valid JSON/);
    expect(() => parseSignalingMessage(JSON.stringify({ ...offer, version: 2 }))).toThrow(/version/);
    expect(() => parseSignalingMessage(JSON.stringify({ ...offer, sender: '' }))).toThrow(/sender/);
    expect(() => parseSignalingMessage(JSON.stringify({ ...offer, type: 'malware' }))).toThrow(/type/);
    expect(() => parseSignalingMessage(JSON.stringify({ ...offer, sentAt: 'not-a-date' }))).toThrow(
      /timestamp/
    );
    expect(() => parseSignalingMessage('x'.repeat(300_000))).toThrow(/maximum/);
  });

  it('validates SDP and ICE payload shapes', () => {
    expect(isOfferPayload({ type: 'answer', sdp: 'v=0' })).toBe(true);
    expect(isOfferPayload({ type: 'answer', sdp: '' })).toBe(false);
    expect(isOfferPayload({ type: 'candidate', sdp: 'v=0' })).toBe(false);
    expect(
      isIceCandidatePayload({ candidate: 'candidate:1 1 UDP 1 1.2.3.4 1000 typ host', sdpMid: '0', sdpMLineIndex: 0 })
    ).toBe(true);
    expect(isIceCandidatePayload({ candidate: 123 })).toBe(false);
  });
});

describe('encrypted signaling handshake (#304)', () => {
  it('encrypts with an ECDH-derived AES-GCM key and decrypts on the peer', async () => {
    const client = await generateSessionKeyPair();
    const freelancer = await generateSessionKeyPair();

    const clientKey = await deriveSharedSessionKey(client.privateKey, freelancer.publicKeyJwk);
    const freelancerKey = await deriveSharedSessionKey(freelancer.privateKey, client.publicKeyJwk);

    const frame = await encryptSignalingMessage(clientKey, offer);
    expect(frame).not.toContain('GCLIENT');
    expect(frame).not.toContain('v=0');

    const decrypted = await decryptSignalingMessage(freelancerKey, frame);
    expect(decrypted).toMatchObject({ id: offer.id, type: 'offer', sender: 'GCLIENT' });
  });

  it('rejects peers using a different session key', async () => {
    const client = await generateSessionKeyPair();
    const freelancer = await generateSessionKeyPair();
    const attacker = await generateSessionKeyPair();

    const key = await deriveSharedSessionKey(client.privateKey, freelancer.publicKeyJwk);
    const wrongKey = await deriveSharedSessionKey(attacker.privateKey, freelancer.publicKeyJwk);
    const frame = await encryptSignalingMessage(key, offer);

    await expect(decryptSignalingMessage(wrongKey, frame)).rejects.toThrow(/decrypt/);
  });

  it('rejects non-P-256 peer keys', async () => {
    const client = await generateSessionKeyPair();
    await expect(
      deriveSharedSessionKey(client.privateKey, { kty: 'RSA', n: 'abc', e: 'AQAB' })
    ).rejects.toThrow(/P-256/);
  });

  it('encrypts offers end-to-end between two transports', async () => {
    const receivers: Array<(data: string) => void> = [];
    const received: SignalingEnvelope[] = [];
    const makeChannel = (_name: string, onData: (data: string) => void) => {
      receivers.push(onData);
      return {
        post: (data: string) => {
          receivers.filter((receiver) => receiver !== onData).forEach((receiver) => receiver(data));
        },
        close: () => {},
      };
    };

    const client = new EncryptedSignalingTransport({
      roomId: 'room-1',
      role: 'client',
      localAddress: 'GCLIENT',
      peerAddress: 'GFREELANCER',
      channelFactory: makeChannel,
      onMessage: (message) => received.push(message),
    });
    const freelancer = new EncryptedSignalingTransport({
      roomId: 'room-1',
      role: 'freelancer',
      localAddress: 'GFREELANCER',
      peerAddress: 'GCLIENT',
      channelFactory: makeChannel,
      onMessage: (message) => received.push(message),
    });

    await client.connect();
    await freelancer.connect();

    await vi.waitFor(() => expect(client.isReady).toBe(true));
    await vi.waitFor(() => expect(freelancer.isReady).toBe(true));

    await client.send('offer', { type: 'offer', sdp: 'v=0\r\n' });

    await vi.waitFor(() => expect(received).toHaveLength(1));
    expect(received[0]).toMatchObject({ type: 'offer', sender: 'GCLIENT' });
    expect(received[0].payload).toEqual({ type: 'offer', sdp: 'v=0\r\n' });

    client.close();
    freelancer.close();
  });
});

describe('connection quality metrics (#304)', () => {
  const report = (values: Array<Record<string, unknown>>) => {
    const map = new Map<string, Record<string, unknown>>();
    values.forEach((value, index) => map.set(`stat-${index}`, value));
    return map;
  };

  it('reads RTT, packet loss and byte counters from a stats report', () => {
    const snapshot = readRtcStats(
      report([
        { type: 'inbound-rtp', bytesReceived: 4_000, packetsLost: 5, packetsReceived: 95 },
        { type: 'outbound-rtp', bytesSent: 1_000 },
        { type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.042 },
      ]),
      10_000
    );

    expect(snapshot).toEqual({
      at: 10_000,
      bytesReceived: 4_000,
      bytesSent: 1_000,
      packetsLost: 5,
      packetsReceived: 95,
      rttMs: 42,
    });
  });

  it('computes packet loss and bandwidth from consecutive samples', () => {
    const previous = readRtcStats(
      report([
        { type: 'inbound-rtp', bytesReceived: 1_000, packetsLost: 0, packetsReceived: 90 },
        { type: 'outbound-rtp', bytesSent: 500 },
      ]),
      1_000
    );
    const current = readRtcStats(
      report([
        { type: 'inbound-rtp', bytesReceived: 3_000, packetsLost: 5, packetsReceived: 190 },
        { type: 'outbound-rtp', bytesSent: 1_500 },
      ]),
      3_000
    );

    const quality = computeConnectionQuality(current, previous);
    expect(quality.packetLossPercent).toBeCloseTo((5 / 195) * 100, 5);
    expect(quality.inboundKbps).toBe(8);
    expect(quality.outboundKbps).toBe(4);
    expect(quality.rttMs).toBeNull();
  });

  it('leaves derived metrics empty on the first sample', () => {
    const quality = computeConnectionQuality(readRtcStats(report([]), 1_000));
    expect(quality).toEqual({
      rttMs: null,
      packetLossPercent: null,
      inboundKbps: null,
      outboundKbps: null,
    });
  });
});
