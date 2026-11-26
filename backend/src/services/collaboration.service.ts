import type { IncomingMessage, Server } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import { logger } from '../shared/utils/logger.js';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_QUERY_AWARENESS = 2;
const ROOM_PATH = /^\/collab\/([A-Za-z0-9_-]{1,128})$/;

interface CollaborationRoom {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<WebSocket>;
}

const rooms = new Map<string, CollaborationRoom>();

function getRoom(roomId: string): CollaborationRoom {
  const existing = rooms.get(roomId);
  if (existing) return existing;

  const doc = new Y.Doc({ guid: `trustpay-scope-${roomId}` });
  const awareness = new awarenessProtocol.Awareness(doc);
  const room: CollaborationRoom = { doc, awareness, clients: new Set() };

  doc.on('update', (update: Uint8Array, origin: unknown) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const payload = encoding.toUint8Array(encoder);
    room.clients.forEach((client) => {
      if (client !== origin && client.readyState === WebSocket.OPEN) client.send(payload);
    });
  });

  awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    if (origin instanceof WebSocket) return;
    const clients = [...added, ...updated, ...removed];
    if (clients.length === 0) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, clients));
    const payload = encoding.toUint8Array(encoder);
    room.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
  });

  rooms.set(roomId, room);
  return room;
}

function broadcastToRoom(room: CollaborationRoom, payload: Uint8Array, except?: WebSocket) {
  room.clients.forEach((client) => {
    if (client !== except && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function handleMessage(room: CollaborationRoom, ws: WebSocket, data: Buffer) {
  if (data.length === 0) return;
  const messageType = data[0];
  const payload = data.subarray(1);

  if (messageType === MESSAGE_SYNC) {
    const decoder = decoding.createDecoder(payload);
    const encoder = encoding.createEncoder();
    try {
      syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws, (error: any) => {
        logger.warn(`Yjs sync message failed for collaboration room: ${error.message}`);
      });
      if (encoding.length(encoder) > 0) {
        ws.send(encoding.toUint8Array(encoder));
      }
    } catch (error: any) {
      logger.warn(`Invalid Yjs sync payload: ${error.message}`);
    }
    return;
  }

  if (messageType === MESSAGE_AWARENESS) {
    awarenessProtocol.applyAwarenessUpdate(room.awareness, payload, ws);
    broadcastToRoom(room, data, ws);
    return;
  }

  if (messageType === MESSAGE_QUERY_AWARENESS) {
    const states = room.awareness.getStates();
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(room.awareness, [...states.keys()]));
    ws.send(encoding.toUint8Array(encoder));
  }
}

function handleConnection(ws: WebSocket, roomId: string) {
  const room = getRoom(roomId);
  room.clients.add(ws);
  logger.info(`Collaboration client joined room ${roomId} (${room.clients.size} clients)`);

  ws.on('message', (data: WebSocket.RawData) => {
    const buffer = Array.isArray(data)
      ? Buffer.concat(data)
      : Buffer.isBuffer(data)
        ? data
        : Buffer.from(data as ArrayBuffer);
    handleMessage(room, ws, buffer);
  });

  ws.on('close', () => {
    room.clients.delete(ws);
    logger.info(`Collaboration client left room ${roomId} (${room.clients.size} clients)`);
    if (room.clients.size === 0) {
      room.awareness.destroy();
      room.doc.destroy();
      rooms.delete(roomId);
    }
  });

  ws.on('error', (error) => {
    logger.warn(`Collaboration websocket error in room ${roomId}: ${error.message}`);
  });
}

export function attachCollaborationWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    try {
      const host = req.headers.host || 'localhost';
      const url = new URL(req.url || '/', `http://${host}`);
      const match = url.pathname.match(ROOM_PATH);

      if (!match) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        handleConnection(ws, match[1]);
      });
    } catch (error: any) {
      logger.warn(`Collaboration upgrade failed: ${error.message}`);
      socket.destroy();
    }
  });

  return wss;
}
