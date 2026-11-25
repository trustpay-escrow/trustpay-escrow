/**
 * Peer-to-peer review call signaling (#304).
 *
 * The module intentionally keeps signaling transport-agnostic: a WebSocket
 * relay can be supplied through `NEXT_PUBLIC_WEBRTC_SIGNALING_URL`, otherwise
 * two tabs on the same origin use a BroadcastChannel. In both cases the SDP /
 * ICE payloads are encrypted with an AES-GCM key derived over ECDH P-256, so
 * the relay only ever sees ciphertext.
 */

export type ReviewCallRole = 'client' | 'freelancer';

export type SignalingMessageType =
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'hangup'
  | 'session-start'
  | 'session-end';

export interface SignalingEnvelope<T = unknown> {
  version: 1;
  id: string;
  roomId: string;
  sender: string;
  role: ReviewCallRole;
  type: SignalingMessageType;
  payload: T;
  sentAt: string;
}

export type IceCandidatePayload = {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment?: string | null;
};

export type SessionDescriptionPayload = {
  type: 'offer' | 'answer';
  sdp: string;
};

const MAX_SIGNALING_MESSAGE_LENGTH = 256 * 1024;
const SIGNALING_TYPES: SignalingMessageType[] = [
  'offer',
  'answer',
  'ice-candidate',
  'hangup',
  'session-start',
  'session-end',
];

export class SignalingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignalingError';
  }
}

function randomId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSignalingMessage<T>(
  input: {
    roomId: string;
    sender: string;
    role: ReviewCallRole;
    type: SignalingMessageType;
    payload: T;
  },
  now: Date = new Date()
): SignalingEnvelope<T> {
  if (!input.roomId.trim()) throw new SignalingError('A signaling room id is required.');
  if (!input.sender.trim()) throw new SignalingError('A participant address is required.');
  return {
    version: 1,
    id: randomId(),
    roomId: input.roomId.trim(),
    sender: input.sender,
    role: input.role,
    type: input.type,
    payload: input.payload,
    sentAt: now.toISOString(),
  };
}

export function serializeSignalingMessage(message: SignalingEnvelope): string {
  return JSON.stringify(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Parses and validates an untrusted signaling frame. Throws `SignalingError`
 * for malformed frames so a relay cannot crash the call UI.
 */
export function parseSignalingMessage(raw: string): SignalingEnvelope {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new SignalingError('Empty signaling frame.');
  }
  if (raw.length > MAX_SIGNALING_MESSAGE_LENGTH) {
    throw new SignalingError('Signaling frame exceeds the maximum allowed size.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SignalingError('Signaling frame is not valid JSON.');
  }

  if (!isRecord(parsed)) throw new SignalingError('Signaling frame must be an object.');
  if (parsed.version !== 1) throw new SignalingError(`Unsupported signaling version: ${String(parsed.version)}.`);
  if (typeof parsed.id !== 'string' || !parsed.id) throw new SignalingError('Signaling frame is missing an id.');
  if (typeof parsed.roomId !== 'string' || !parsed.roomId) {
    throw new SignalingError('Signaling frame is missing a room id.');
  }
  if (typeof parsed.sender !== 'string' || !parsed.sender) {
    throw new SignalingError('Signaling frame is missing a sender address.');
  }
  if (parsed.role !== 'client' && parsed.role !== 'freelancer') {
    throw new SignalingError('Signaling frame has an invalid participant role.');
  }
  if (!SIGNALING_TYPES.includes(parsed.type as SignalingMessageType)) {
    throw new SignalingError(`Unsupported signaling message type: ${String(parsed.type)}.`);
  }
  if (typeof parsed.sentAt !== 'string' || Number.isNaN(Date.parse(parsed.sentAt))) {
    throw new SignalingError('Signaling frame has an invalid timestamp.');
  }
  if (!('payload' in parsed)) throw new SignalingError('Signaling frame is missing a payload.');

  return parsed as unknown as SignalingEnvelope;
}

export function isOfferPayload(value: unknown): value is SessionDescriptionPayload {
  return (
    isRecord(value) &&
    (value.type === 'offer' || value.type === 'answer') &&
    typeof value.sdp === 'string' &&
    value.sdp.length > 0
  );
}

export function isIceCandidatePayload(value: unknown): value is IceCandidatePayload {
  return (
    isRecord(value) &&
    typeof value.candidate === 'string' &&
    (value.sdpMid === null || typeof value.sdpMid === 'string') &&
    (value.sdpMLineIndex === null || typeof value.sdpMLineIndex === 'number')
  );
}

/* ------------------------------------------------------------------ */
/* Base64 helpers and WebCrypto encryption                             */
/* ------------------------------------------------------------------ */

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
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
  if (!subtle) {
    throw new SignalingError('WebCrypto is unavailable, so encrypted signaling cannot start.');
  }
  return subtle;
}

export interface SessionKeyPair {
  privateKey: CryptoKey;
  /** Public JWK shared with the peer in the unencrypted hello frame. */
  publicKeyJwk: JsonWebKey;
}

export async function generateSessionKeyPair(): Promise<SessionKeyPair> {
  const subtle = getSubtle();
  const pair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveKey',
    'deriveBits',
  ]);
  const publicKeyJwk = await subtle.exportKey('jwk', pair.publicKey);
  return { privateKey: pair.privateKey, publicKeyJwk };
}

export async function deriveSharedSessionKey(
  privateKey: CryptoKey,
  peerPublicKeyJwk: JsonWebKey
): Promise<CryptoKey> {
  const subtle = getSubtle();
  if (peerPublicKeyJwk.kty !== 'EC' || peerPublicKeyJwk.crv !== 'P-256') {
    throw new SignalingError('Peer signaling key must be an ECDH P-256 key.');
  }
  const peerKey = await subtle.importKey(
    'jwk',
    peerPublicKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  return subtle.deriveKey(
    { name: 'ECDH', public: peerKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedSignalingFrame {
  version: 1;
  iv: string;
  data: string;
}

export async function encryptSignalingMessage(
  key: CryptoKey,
  message: SignalingEnvelope
): Promise<string> {
  const subtle = getSubtle();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(serializeSignalingMessage(message));
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encoded as unknown as BufferSource
  );
  const frame: EncryptedSignalingFrame = {
    version: 1,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(ciphertext)),
  };
  return JSON.stringify(frame);
}

export async function decryptSignalingMessage(key: CryptoKey, frame: string): Promise<SignalingEnvelope> {
  const subtle = getSubtle();
  let parsed: unknown;
  try {
    parsed = JSON.parse(frame);
  } catch {
    throw new SignalingError('Encrypted signaling frame is not valid JSON.');
  }
  if (!isRecord(parsed) || parsed.version !== 1 || typeof parsed.iv !== 'string' || typeof parsed.data !== 'string') {
    throw new SignalingError('Encrypted signaling frame is malformed.');
  }

  let plaintext: ArrayBuffer;
  try {
    plaintext = await subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(parsed.iv) as unknown as BufferSource },
      key,
      base64ToBytes(parsed.data) as unknown as BufferSource
    );
  } catch {
    throw new SignalingError('Could not decrypt the signaling frame with this session key.');
  }

  return parseSignalingMessage(new TextDecoder().decode(plaintext));
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

interface SignalingChannel {
  post(data: string): void;
  close(): void;
}

export interface SignalingTransportOptions {
  roomId: string;
  role: ReviewCallRole;
  localAddress: string;
  peerAddress?: string;
  /** WebSocket relay URL. When omitted a same-origin BroadcastChannel is used. */
  signalingUrl?: string;
  onMessage: (message: SignalingEnvelope) => void;
  onPeerReady?: () => void;
  onError?: (error: Error) => void;
  /** Test hook for injecting an in-memory channel. */
  channelFactory?: (name: string, onData: (data: string) => void) => SignalingChannel;
}

interface HelloFrame {
  kind: 'trustpay-review-hello';
  version: 1;
  roomId: string;
  sender: string;
  role: ReviewCallRole;
  publicKeyJwk: JsonWebKey;
}

function isHelloFrame(value: unknown): value is HelloFrame {
  return (
    isRecord(value) &&
    value.kind === 'trustpay-review-hello' &&
    value.version === 1 &&
    typeof value.roomId === 'string' &&
    typeof value.sender === 'string' &&
    (value.role === 'client' || value.role === 'freelancer') &&
    isRecord(value.publicKeyJwk)
  );
}

function createBrowserChannel(
  name: string,
  onData: (data: string) => void,
  signalingUrl?: string
): SignalingChannel {
  if (signalingUrl) {
    const socket = new WebSocket(signalingUrl);
    socket.onmessage = (event) => {
      if (typeof event.data === 'string') onData(event.data);
    };
    return {
      post: (data) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(data);
      },
      close: () => socket.close(),
    };
  }

  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(name);
    channel.onmessage = (event) => {
      if (typeof event.data === 'string') onData(event.data);
    };
    return {
      post: (data) => channel.postMessage(data),
      close: () => channel.close(),
    };
  }

  throw new SignalingError('No signaling transport is available in this browser.');
}

/**
 * Establishes an ECDH key with the other participant and then relays encrypted
 * SDP/ICE frames. Only the public key is ever sent in clear text.
 */
export class EncryptedSignalingTransport {
  private readonly options: SignalingTransportOptions;
  private readonly channelName: string;
  private channel: SignalingChannel | null = null;
  private keys: SessionKeyPair | null = null;
  private sharedKey: CryptoKey | null = null;
  private pending: SignalingEnvelope[] = [];
  private ready = false;
  private closed = false;
  private helloFrame = '';

  constructor(options: SignalingTransportOptions) {
    this.options = options;
    this.channelName = `trustpay-review-${options.roomId}`;
  }

  async connect(): Promise<void> {
    if (this.closed) throw new SignalingError('This signaling transport was already closed.');
    this.keys = await generateSessionKeyPair();

    const factory =
      this.options.channelFactory ??
      ((name: string, onData: (data: string) => void) =>
        createBrowserChannel(name, onData, this.options.signalingUrl));

    this.channel = factory(this.channelName, (data) => void this.handleFrame(data));

    const hello: HelloFrame = {
      kind: 'trustpay-review-hello',
      version: 1,
      roomId: this.options.roomId,
      sender: this.options.localAddress,
      role: this.options.role,
      publicKeyJwk: this.keys.publicKeyJwk,
    };
    this.helloFrame = JSON.stringify(hello);
    this.channel.post(this.helloFrame);
  }

  get isReady(): boolean {
    return this.ready;
  }

  async send(type: SignalingMessageType, payload: unknown): Promise<void> {
    if (this.closed) return;
    const message = createSignalingMessage({
      roomId: this.options.roomId,
      sender: this.options.localAddress,
      role: this.options.role,
      type,
      payload,
    });
    if (this.needsEncryption(type)) {
      this.pending.push(message);
      await this.flush();
      return;
    }
    this.channel?.post(serializeSignalingMessage(message));
  }

  private needsEncryption(type: SignalingMessageType): boolean {
    return type === 'offer' || type === 'answer' || type === 'ice-candidate' || type === 'hangup';
  }

  private async flush(): Promise<void> {
    if (!this.ready || !this.sharedKey || !this.channel) return;
    const queue = this.pending;
    this.pending = [];
    for (const message of queue) {
      const frame = await encryptSignalingMessage(this.sharedKey, message);
      this.channel.post(frame);
    }
  }

  private async handleFrame(raw: string): Promise<void> {
    if (this.closed) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    if (isHelloFrame(parsed)) {
      if (parsed.roomId !== this.options.roomId) return;
      // Each peer ignores its own hello. Two participants can share an address
      // only in local demos, so role is used as a tie-breaker.
      if (parsed.sender === this.options.localAddress && parsed.role === this.options.role) return;
      if (this.options.peerAddress && parsed.sender !== this.options.peerAddress) return;
      if (!this.keys) return;

      try {
        this.sharedKey = await deriveSharedSessionKey(this.keys.privateKey, parsed.publicKeyJwk);
        if (!this.ready) {
          this.ready = true;
          // Reply so a peer that joined after our initial hello can derive the
          // same key. Peers that are already ready ignore repeated hellos.
          if (this.helloFrame) this.channel?.post(this.helloFrame);
          this.options.onPeerReady?.();
        }
        await this.flush();
      } catch (error) {
        this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
      return;
    }

    if (!this.sharedKey) {
      this.options.onError?.(new SignalingError('Received a call frame before the encrypted handshake completed.'));
      return;
    }

    try {
      const message = await decryptSignalingMessage(this.sharedKey, raw);
      if (message.roomId !== this.options.roomId) return;
      if (this.options.peerAddress && message.sender !== this.options.peerAddress) return;
      this.options.onMessage(message);
    } catch (error) {
      this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  close(): void {
    this.closed = true;
    this.ready = false;
    this.pending = [];
    this.channel?.close();
    this.channel = null;
  }

  /** Stable per-project room name used by both participants. */
  static roomIdForProject(projectId: string, suffix = 'review'): string {
    return `${projectId.trim()}-${suffix}`;
  }
}

/* ------------------------------------------------------------------ */
/* Connection quality                                                  */
/* ------------------------------------------------------------------ */

export interface RtcStatsSnapshot {
  at: number;
  bytesReceived: number;
  bytesSent: number;
  packetsLost: number;
  packetsReceived: number;
  rttMs: number | null;
}

export interface ConnectionQuality {
  rttMs: number | null;
  packetLossPercent: number | null;
  inboundKbps: number | null;
  outboundKbps: number | null;
}

interface RtcStatsRecord {
  type?: string;
  bytesReceived?: number;
  bytesSent?: number;
  packetsLost?: number;
  packetsReceived?: number;
  state?: string;
  selected?: boolean;
  currentRoundTripTime?: number;
  roundTripTime?: number;
}

type StatsLike = {
  forEach?: (callback: (report: RtcStatsRecord) => void) => void;
  values?: () => Iterable<RtcStatsRecord>;
};

export function readRtcStats(report: StatsLike, now: number = Date.now()): RtcStatsSnapshot {
  const snapshot: RtcStatsSnapshot = {
    at: now,
    bytesReceived: 0,
    bytesSent: 0,
    packetsLost: 0,
    packetsReceived: 0,
    rttMs: null,
  };

  const visit = (statsReport: RtcStatsRecord) => {
    if (!statsReport || typeof statsReport !== 'object') return;
    switch (statsReport.type) {
      case 'inbound-rtp':
        snapshot.bytesReceived += Number(statsReport.bytesReceived) || 0;
        snapshot.packetsLost += Number(statsReport.packetsLost) || 0;
        snapshot.packetsReceived += Number(statsReport.packetsReceived) || 0;
        break;
      case 'outbound-rtp':
        snapshot.bytesSent += Number(statsReport.bytesSent) || 0;
        break;
      case 'candidate-pair':
        if (statsReport.state === 'succeeded' || statsReport.selected) {
          const rtt =
            typeof statsReport.currentRoundTripTime === 'number'
              ? statsReport.currentRoundTripTime
              : typeof statsReport.roundTripTime === 'number'
              ? statsReport.roundTripTime
              : null;
          if (rtt !== null && snapshot.rttMs === null) snapshot.rttMs = Math.round(rtt * 1000);
        }
        break;
      default:
        break;
    }
  };

  if (typeof report.forEach === 'function') {
    report.forEach(visit);
  } else if (typeof report.values === 'function') {
    for (const item of report.values()) visit(item);
  }

  return snapshot;
}

export function computeConnectionQuality(
  current: RtcStatsSnapshot,
  previous?: RtcStatsSnapshot | null
): ConnectionQuality {
  const elapsedMs = previous ? current.at - previous.at : 0;
  const seconds = elapsedMs / 1000;

  const totalPackets = current.packetsReceived + current.packetsLost;
  const packetLossPercent = totalPackets > 0 ? (current.packetsLost / totalPackets) * 100 : null;

  const inboundKbps =
    previous && seconds > 0
      ? Math.max(0, ((current.bytesReceived - previous.bytesReceived) * 8) / 1000 / seconds)
      : null;
  const outboundKbps =
    previous && seconds > 0
      ? Math.max(0, ((current.bytesSent - previous.bytesSent) * 8) / 1000 / seconds)
      : null;

  return {
    rttMs: current.rttMs,
    packetLossPercent,
    inboundKbps,
    outboundKbps,
  };
}

/** Builds the RTCConfiguration used by the review call. */
export function getReviewCallRtcConfiguration(): RTCConfiguration {
  return {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
  };
}
