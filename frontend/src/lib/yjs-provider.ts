import * as Y from 'yjs';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { readSyncMessage, writeSyncStep1, writeUpdate } from 'y-protocols/sync';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_QUERY_AWARENESS = 2;
const REMOTE_ORIGIN = 'trustpay-collab-server';

export type CollaborationStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  role?: string;
}

export interface CollaborativeScopeProviderOptions {
  roomId: string;
  doc: Y.Doc;
  user: CollaborationUser;
  url?: string;
  onStatusChange?: (status: CollaborationStatus) => void;
}

function defaultWebSocketBase(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return apiUrl.replace(/^http/, 'ws');
}

export class CollaborativeScopeProvider {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  status: CollaborationStatus = 'disconnected';

  private readonly roomId: string;
  private readonly user: CollaborationUser;
  private readonly url: string;
  private readonly onStatusChange?: (status: CollaborationStatus) => void;
  private ws: WebSocket | null = null;
  private destroyed = false;

  constructor(options: CollaborativeScopeProviderOptions) {
    this.roomId = options.roomId;
    this.doc = options.doc;
    this.user = options.user;
    this.url = options.url || process.env.NEXT_PUBLIC_COLLAB_WS_URL || defaultWebSocketBase();
    this.onStatusChange = options.onStatusChange;
    this.awareness = new Awareness(this.doc);
    this.awareness.setLocalState({ user: this.user });

    this.doc.on('update', this.handleDocUpdate);
    this.awareness.on('update', this.handleAwarenessUpdate);
  }

  connect() {
    if (this.destroyed || this.ws) return;

    const endpoint = `${this.url.replace(/\/$/, '')}/collab/${encodeURIComponent(this.roomId)}`;
    this.setStatus('connecting');

    try {
      const ws = new WebSocket(endpoint);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;

      ws.onopen = () => {
        this.setStatus('connected');
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        writeSyncStep1(encoder, this.doc);
        ws.send(encoding.toUint8Array(encoder));
      };

      ws.onmessage = (event) => {
        void this.handleMessage(event.data);
      };

      ws.onclose = () => {
        this.ws = null;
        if (!this.destroyed) this.setStatus('disconnected');
      };

      ws.onerror = () => {
        if (!this.destroyed) this.setStatus('error');
      };
    } catch {
      this.setStatus('error');
    }
  }

  reconnect() {
    this.disconnectSocket();
    this.connect();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.doc.off('update', this.handleDocUpdate);
    this.awareness.off('update', this.handleAwarenessUpdate);
    try {
      this.awareness.setLocalState(null);
    } catch {
      // ignore awareness cleanup errors during teardown
    }
    this.awareness.destroy();
    this.disconnectSocket();
    this.doc.destroy();
  }

  private disconnectSocket() {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      try {
        ws.close();
      } catch {
        // ignore close errors during teardown
      }
    }
  }

  private setStatus(status: CollaborationStatus) {
    this.status = status;
    this.onStatusChange?.(status);
  }

  private send(payload: Uint8Array) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    }
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE_ORIGIN) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    writeUpdate(encoder, update);
    this.send(encoding.toUint8Array(encoder));
  };

  private handleAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ) => {
    if (origin === REMOTE_ORIGIN) return;
    const clients = [...added, ...updated, ...removed];
    if (clients.length === 0) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(this.awareness, clients));
    this.send(encoding.toUint8Array(encoder));
  };

  private async handleMessage(data: unknown) {
    let bytes: Uint8Array;
    if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else if (ArrayBuffer.isView(data)) {
      bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
      bytes = new Uint8Array(await data.arrayBuffer());
    } else {
      return;
    }

    if (bytes.length === 0) return;
    const messageType = bytes[0];
    const payload = bytes.subarray(1);

    if (messageType === MESSAGE_SYNC) {
      const decoder = decoding.createDecoder(payload);
      const encoder = encoding.createEncoder();
      try {
        readSyncMessage(decoder, encoder, this.doc, REMOTE_ORIGIN, (error) => {
          console.warn('Failed to apply collaborative scope update', error);
        });
        if (encoding.length(encoder) > 0) {
          this.send(encoding.toUint8Array(encoder));
        }
      } catch (error) {
        console.warn('Invalid collaborative sync payload', error);
      }
      return;
    }

    if (messageType === MESSAGE_AWARENESS) {
      applyAwarenessUpdate(this.awareness, payload, REMOTE_ORIGIN);
      return;
    }

    if (messageType === MESSAGE_QUERY_AWARENESS) {
      const states = this.awareness.getStates();
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(this.awareness, [...states.keys()]));
      this.send(encoding.toUint8Array(encoder));
    }
  }
}
