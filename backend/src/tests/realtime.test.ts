import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import http from 'http';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';
import { app } from '../app.js';
import { env } from '../config/env.js';
import { realtimeService } from '../services/realtime.service.js';
import { supabase } from '../config/supabase.js';

// Mock Stellar Addresses for testing
const CLIENT_ADDRESS = 'GCLIENT111111111111111111111111111111111111111111111111CLIENT';
const FREELANCER_ADDRESS = 'GFREELANCER222222222222222222222222222222222222222222222FREE';
const ARBITER_ADDRESS = 'GARBITER333333333333333333333333333333333333333333333333ARBI';
const STRANGER_ADDRESS = 'GSTRANGER9999999999999999999999999999999999999999999999STRN';

const PROJECT_ID = 'b7e21a22-3841-4560-9d33-4f114c0a1b22';

function createToken(address: string, role = 'client'): string {
  return jwt.sign(
    {
      sub: address,
      stellar_address: address,
      role,
      is_client: true,
      is_freelancer: true,
    },
    env.jwtSecret,
    { expiresIn: '1h' }
  );
}

// Mock Supabase
vi.mock('../config/supabase.js', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

describe('🛡️ Participant Authorization & Real-Time Push Gateway (SSE)', () => {
  const clientToken = createToken(CLIENT_ADDRESS, 'client');
  const freelancerToken = createToken(FREELANCER_ADDRESS, 'freelancer');
  const arbiterToken = createToken(ARBITER_ADDRESS, 'arbiter');
  const strangerToken = createToken(STRANGER_ADDRESS, 'client');

  beforeEach(() => {
    vi.clearAllMocks();
    realtimeService.reset();

    // Default mock setup for supabase tables
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'projects') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: PROJECT_ID,
              title: 'Decentralized Escrow Contract',
              client_id: 'client-user-id',
              freelancer_id: 'freelancer-user-id',
              arbiter_id: 'arbiter-user-id',
            },
            error: null,
          }),
        };
      }

      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              { id: 'client-user-id', stellar_address: CLIENT_ADDRESS },
              { id: 'freelancer-user-id', stellar_address: FREELANCER_ADDRESS },
              { id: 'arbiter-user-id', stellar_address: ARBITER_ADDRESS },
            ],
            error: null,
          }),
        };
      }

      if (table === 'messages') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'msg-1',
                project_id: PROJECT_ID,
                sender_address: CLIENT_ADDRESS,
                receiver_address: FREELANCER_ADDRESS,
                content: 'Hello, welcome to the project!',
                created_at: new Date().toISOString(),
              },
            ],
            error: null,
          }),
          insert: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'msg-2',
              project_id: PROJECT_ID,
              sender_address: CLIENT_ADDRESS,
              receiver_address: FREELANCER_ADDRESS,
              content: 'Project specs attached.',
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        };
      }

      if (table === 'notifications') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'notif-1',
                recipient_address: CLIENT_ADDRESS,
                title: 'Welcome',
                message: 'Your project is live',
                is_read: false,
              },
            ],
            error: null,
          }),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'notif-1',
              recipient_address: CLIENT_ADDRESS,
            },
            error: null,
          }),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'notif-1',
              recipient_address: CLIENT_ADDRESS,
              is_read: true,
            },
            error: null,
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });
  });

  afterEach(() => {
    realtimeService.reset();
  });

  // ============================================================================
  // 1. Participant Authorization & IDOR Message Snooping Protection
  // ============================================================================
  describe('Project Messages Participant Authorization & IDOR Protection', () => {
    it('rejects unauthenticated requests to GET /api/projects/:projectId/messages with 401', async () => {
      const res = await request(app).get(`/api/projects/${PROJECT_ID}/messages`);
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Authentication required');
    });

    it('rejects non-participant (stranger) with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/projects/${PROJECT_ID}/messages`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden: You are not an authorized participant');
    });

    it('allows the project client to read messages with 200 OK', async () => {
      const res = await request(app)
        .get(`/api/projects/${PROJECT_ID}/messages`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('messages');
      expect(Array.isArray(res.body.messages)).toBe(true);
      expect(res.body.messages.length).toBe(1);
    });

    it('allows the project freelancer to read messages with 200 OK', async () => {
      const res = await request(app)
        .get(`/api/projects/${PROJECT_ID}/messages`)
        .set('Authorization', `Bearer ${freelancerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(1);
    });

    it('allows the project arbiter to read messages with 200 OK', async () => {
      const res = await request(app)
        .get(`/api/projects/${PROJECT_ID}/messages`)
        .set('Authorization', `Bearer ${arbiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(1);
    });
  });

  // ============================================================================
  // 2. Anti-Spoofing and Participant Enforcement on Send Message
  // ============================================================================
  describe('Message Anti-Spoofing & Participant Validation', () => {
    it('rejects sender address spoofing when sender_address != authenticated user', async () => {
      const res = await request(app)
        .post(`/api/projects/${PROJECT_ID}/messages`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          sender_address: ARBITER_ADDRESS, // Maliciously impersonating Arbiter
          receiver_address: FREELANCER_ADDRESS,
          content: 'I rule in favor of the client.',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('You cannot send messages on behalf of another user');
    });

    it('rejects sending messages if authenticated user is not a participant of the project', async () => {
      const res = await request(app)
        .post(`/api/projects/${PROJECT_ID}/messages`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({
          sender_address: STRANGER_ADDRESS,
          receiver_address: FREELANCER_ADDRESS,
          content: 'Unsolicited message',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('You are not an authorized participant');
    });

    it('rejects message if receiver address is identical to sender address', async () => {
      const res = await request(app)
        .post(`/api/projects/${PROJECT_ID}/messages`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          sender_address: CLIENT_ADDRESS,
          receiver_address: CLIENT_ADDRESS,
          content: 'Talking to myself',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Receiver address cannot be identical to sender address');
    });

    it('rejects message if receiver address is not a participant of the project', async () => {
      const res = await request(app)
        .post(`/api/projects/${PROJECT_ID}/messages`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          sender_address: CLIENT_ADDRESS,
          receiver_address: STRANGER_ADDRESS,
          content: 'Hello stranger',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Receiver address is not an authorized participant');
    });

    it('successfully sends message and broadcasts via realtimeService when valid participant', async () => {
      const broadcastSpy = vi.spyOn(realtimeService, 'broadcastToProject');

      const res = await request(app)
        .post(`/api/projects/${PROJECT_ID}/messages`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          sender_address: CLIENT_ADDRESS,
          receiver_address: FREELANCER_ADDRESS,
          content: 'Project specs attached.',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Message sent successfully');
      expect(res.body.data).toHaveProperty('id', 'msg-2');

      // Verify real-time push broadcast triggered
      expect(broadcastSpy).toHaveBeenCalledWith(
        PROJECT_ID,
        'message',
        expect.objectContaining({ id: 'msg-2' })
      );
    });
  });

  // ============================================================================
  // 3. Notification Endpoints Access Control & Anti-Snooping
  // ============================================================================
  describe('Notification Endpoints Access Control', () => {
    it('rejects unauthenticated GET /api/notifications/:address with 401', async () => {
      const res = await request(app).get(`/api/notifications/${CLIENT_ADDRESS}`);
      expect(res.status).toBe(401);
    });

    it('rejects snooping another user notifications with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/notifications/${CLIENT_ADDRESS}`)
        .set('Authorization', `Bearer ${strangerToken}`); // Stranger trying to read Client's inbox

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('You can only view your own notifications');
    });

    it('allows reading own notifications with 200 OK', async () => {
      const res = await request(app)
        .get(`/api/notifications/${CLIENT_ADDRESS}`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('notifications');
      expect(res.body.notifications).toHaveLength(1);
    });

    it('rejects mark-all-read for another user with 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/notifications/read-all/${CLIENT_ADDRESS}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('You can only mark your own notifications as read');
    });

    it('rejects deleting notification belonging to another user with 403 Forbidden', async () => {
      const res = await request(app)
        .delete('/api/notifications/notif-1')
        .set('Authorization', `Bearer ${strangerToken}`); // Stranger trying to delete Client's notif

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('You can only delete your own notifications');
    });
  });

  // ============================================================================
  // 4. RealtimeService SSE Stream Functionality
  // ============================================================================
  describe('RealtimeService Server-Sent Events Push Gateway', () => {
    function createMockResponse() {
      const emitter = new EventEmitter();
      const writes: string[] = [];
      const headers: Record<string, string> = {};

      const res = {
        writeHead: vi.fn((statusCode: number, head: Record<string, string>) => {
          Object.assign(headers, head);
        }),
        write: vi.fn((chunk: string) => {
          writes.push(chunk);
          return true;
        }),
        flushHeaders: vi.fn(),
        on: vi.fn((event: string, handler: any) => emitter.on(event, handler)),
        emitClose: () => emitter.emit('close'),
        getWrites: (): string[] => writes,
        getHeaders: (): Record<string, string> => headers,
      };

      return res as any;
    }

    it('registers user SSE stream, sends standard SSE headers, and delivers real-time notifications', () => {
      const mockRes = createMockResponse();

      realtimeService.registerUserStream(CLIENT_ADDRESS, mockRes);

      // Verify SSE headers
      expect(mockRes.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        })
      );

      // Verify connected handshake sent
      expect(mockRes.getWrites()[0]).toContain('event: connected');

      // Broadcast a notification to client
      const notificationData = { id: 'notif-99', title: 'Payment Released', message: 'Funds transferred' };
      const deliveredCount = realtimeService.broadcastToUser(CLIENT_ADDRESS, 'notification', notificationData);

      expect(deliveredCount).toBe(1);
      expect(mockRes.getWrites().some((w: string) => w.includes('event: notification') && w.includes('Payment Released'))).toBe(true);

      // Verify connection count stats
      const stats = realtimeService.getStats();
      expect(stats.totalUserConnections).toBe(1);

      // Disconnect client
      mockRes.emitClose();
      expect(realtimeService.getStats().totalUserConnections).toBe(0);
    });

    it('registers project SSE stream and delivers chat and onchain events to project participants', () => {
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();

      realtimeService.registerProjectStream(PROJECT_ID, mockRes1);
      realtimeService.registerProjectStream(PROJECT_ID, mockRes2);

      expect(realtimeService.getStats().totalProjectConnections).toBe(2);

      // Broadcast chat message
      const chatData = { id: 'msg-live-1', content: 'Escrow funded!' };
      const delivered = realtimeService.broadcastToProject(PROJECT_ID, 'message', chatData);

      expect(delivered).toBe(2);
      expect(mockRes1.getWrites().some((w: string) => w.includes('event: message') && w.includes('Escrow funded!'))).toBe(true);
      expect(mockRes2.getWrites().some((w: string) => w.includes('event: message') && w.includes('Escrow funded!'))).toBe(true);

      // Broadcast on-chain event
      const onchainData = { topic: 'milestone.approved', milestoneIndex: 0, status: 'approved', ledger: 500 };
      realtimeService.broadcastToProject(PROJECT_ID, 'onchain_event', onchainData);

      expect(mockRes1.getWrites().some((w: string) => w.includes('event: onchain_event') && w.includes('milestone.approved'))).toBe(true);

      // Close one client
      mockRes1.emitClose();
      expect(realtimeService.getStats().totalProjectConnections).toBe(1);

      // Close second client
      mockRes2.emitClose();
      expect(realtimeService.getStats().totalProjectConnections).toBe(0);
    });

    it('supports query parameter token authentication for EventSource SSE connections', async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const port = (server.address() as any).port;

      await new Promise<void>((resolve, reject) => {
        const req = http.get(
          `http://127.0.0.1:${port}/api/notifications/stream/${CLIENT_ADDRESS}?token=${encodeURIComponent(clientToken)}`,
          (res) => {
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('text/event-stream');
            expect(res.headers['connection']).toBe('keep-alive');

            res.on('data', (chunk) => {
              const text = chunk.toString();
              if (text.includes('event: connected')) {
                req.destroy();
                server.close(() => resolve());
              }
            });
          }
        );

        req.on('error', (err) => {
          if ((err as any).code === 'ECONNRESET') {
            return;
          }
          server.close(() => reject(err));
        });
      });
    });
  });
});
