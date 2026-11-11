import { Response } from 'express';
import { logger } from '../shared/utils/logger.js';

export interface RealtimeEventData {
  event: string;
  data: any;
  timestamp: string;
}

/**
 * Real-Time Server-Sent Events (SSE) Push Gateway
 * Manages low-latency real-time connections for user notifications and project chat/on-chain events.
 */
export class RealtimeService {
  // Map of recipientAddress (uppercase) -> Set of active Express Response streams
  private userStreams: Map<string, Set<Response>> = new Map();

  // Map of projectId -> Set of active Express Response streams
  private projectStreams: Map<string, Set<Response>> = new Map();

  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Initializes periodic keep-alive heartbeat comments (: keep-alive\n\n)
   * to prevent Cloudflare, Nginx, or corporate proxies from dropping idle SSE connections.
   */
  public startHeartbeat(intervalMs = 25000): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, intervalMs);

    // Unref so the interval timer does not hold the Node process open in test suites
    if (this.heartbeatInterval && typeof this.heartbeatInterval.unref === 'function') {
      this.heartbeatInterval.unref();
    }
  }

  public stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendHeartbeat(): void {
    const heartbeatComment = `: keep-alive\n\n`;

    // Ping all user streams
    for (const [address, clients] of this.userStreams.entries()) {
      for (const res of Array.from(clients)) {
        try {
          res.write(heartbeatComment);
        } catch (err) {
          clients.delete(res);
        }
      }
      if (clients.size === 0) {
        this.userStreams.delete(address);
      }
    }

    // Ping all project streams
    for (const [projectId, clients] of this.projectStreams.entries()) {
      for (const res of Array.from(clients)) {
        try {
          res.write(heartbeatComment);
        } catch (err) {
          clients.delete(res);
        }
      }
      if (clients.size === 0) {
        this.projectStreams.delete(projectId);
      }
    }
  }

  /**
   * Registers a client response stream for user-specific events (e.g. notifications).
   */
  public registerUserStream(address: string, res: Response): void {
    const key = address.trim().toUpperCase();
    if (!this.userStreams.has(key)) {
      this.userStreams.set(key, new Set());
    }
    this.userStreams.get(key)!.add(res);

    logger.info(`[RealtimeService] User connected to SSE stream: ${key} (connections: ${this.userStreams.get(key)!.size})`);

    // Setup standard SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    // Send initial connection handshake event
    this.sendEventToResponse(res, 'connected', {
      status: 'connected',
      channel: `user:${key}`,
      timestamp: new Date().toISOString(),
    });

    res.on('close', () => {
      this.unregisterUserStream(key, res);
    });
  }

  public unregisterUserStream(address: string, res: Response): void {
    const key = address.trim().toUpperCase();
    const clients = this.userStreams.get(key);
    if (clients) {
      clients.delete(res);
      logger.info(`[RealtimeService] User disconnected from SSE: ${key} (remaining: ${clients.size})`);
      if (clients.size === 0) {
        this.userStreams.delete(key);
      }
    }
  }

  /**
   * Registers a client response stream for project-specific events (e.g. chat messages, on-chain events).
   */
  public registerProjectStream(projectId: string, res: Response): void {
    const key = projectId.trim();
    if (!this.projectStreams.has(key)) {
      this.projectStreams.set(key, new Set());
    }
    this.projectStreams.get(key)!.add(res);

    logger.info(`[RealtimeService] Client joined project SSE stream: ${key} (connections: ${this.projectStreams.get(key)!.size})`);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    this.sendEventToResponse(res, 'connected', {
      status: 'connected',
      channel: `project:${key}`,
      timestamp: new Date().toISOString(),
    });

    res.on('close', () => {
      this.unregisterProjectStream(key, res);
    });
  }

  public unregisterProjectStream(projectId: string, res: Response): void {
    const key = projectId.trim();
    const clients = this.projectStreams.get(key);
    if (clients) {
      clients.delete(res);
      logger.info(`[RealtimeService] Client left project SSE stream: ${key} (remaining: ${clients.size})`);
      if (clients.size === 0) {
        this.projectStreams.delete(key);
      }
    }
  }

  /**
   * Broadcasts an event to all active streams for a specific user.
   */
  public broadcastToUser(address: string, event: string, data: any): number {
    const key = address.trim().toUpperCase();
    const clients = this.userStreams.get(key);
    if (!clients || clients.size === 0) {
      return 0;
    }

    let sent = 0;
    for (const res of Array.from(clients)) {
      try {
        this.sendEventToResponse(res, event, data);
        sent++;
      } catch (err) {
        clients.delete(res);
      }
    }
    return sent;
  }

  /**
   * Broadcasts an event to all active streams in a project channel.
   */
  public broadcastToProject(projectId: string, event: string, data: any): number {
    const key = projectId.trim();
    const clients = this.projectStreams.get(key);
    if (!clients || clients.size === 0) {
      return 0;
    }

    let sent = 0;
    for (const res of Array.from(clients)) {
      try {
        this.sendEventToResponse(res, event, data);
        sent++;
      } catch (err) {
        clients.delete(res);
      }
    }
    return sent;
  }

  private sendEventToResponse(res: Response, event: string, data: any): void {
    const formattedData = typeof data === 'string' ? data : JSON.stringify(data);
    res.write(`event: ${event}\ndata: ${formattedData}\n\n`);
  }

  public getStats() {
    return {
      activeUserChannels: this.userStreams.size,
      activeProjectChannels: this.projectStreams.size,
      totalUserConnections: Array.from(this.userStreams.values()).reduce((acc, set) => acc + set.size, 0),
      totalProjectConnections: Array.from(this.projectStreams.values()).reduce((acc, set) => acc + set.size, 0),
    };
  }

  public reset(): void {
    this.userStreams.clear();
    this.projectStreams.clear();
  }
}

export const realtimeService = new RealtimeService();

