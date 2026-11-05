import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Keypair, Networks, Transaction } from '@stellar/stellar-sdk';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import { env } from '../config/env.js';
import { serverKeypair } from '../config/stellar.js';
import { supabase } from '../config/supabase.js';

describe('Stellar SEP-0010 Cryptographic Web Authentication', () => {
  const clientKeypair = Keypair.random();
  const clientAddress = clientKeypair.publicKey();

  describe('GET /api/auth/challenge', () => {
    it('returns 400 if account parameter is missing', async () => {
      const res = await request(app).get('/api/auth/challenge');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 if account parameter is not a valid Stellar Ed25519 address', async () => {
      const res = await request(app).get('/api/auth/challenge?account=not-a-valid-address');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid Stellar public key format');
    });

    it('generates a valid SEP-0010 challenge transaction for a valid Stellar address', async () => {
      const res = await request(app).get(`/api/auth/challenge?account=${clientAddress}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('transaction');
      expect(res.body).toHaveProperty('network');
      expect(res.body).toHaveProperty('server_public_key', serverKeypair.publicKey());
      expect(res.body.expires_in).toBe(300);

      // Verify that transaction XDR parses and contains server signature
      const tx = new Transaction(res.body.transaction, env.stellarNetworkPassphrase);
      expect(tx.signatures.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/auth/verify', () => {
    it('returns 400 if transaction XDR is missing in request body', async () => {
      const res = await request(app).post('/api/auth/verify').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Signed transaction XDR is required');
    });

    it('returns 400 if transaction XDR is malformed or invalid', async () => {
      const res = await request(app)
        .post('/api/auth/verify')
        .send({ transaction: 'invalid-xdr-string' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 401 if transaction is signed by the wrong account', async () => {
      // 1. Get challenge for clientAddress
      const challengeRes = await request(app).get(`/api/auth/challenge?account=${clientAddress}`);
      const challengeXdr = challengeRes.body.transaction;

      // 2. Sign with an attacker keypair instead of clientKeypair
      const attackerKeypair = Keypair.random();
      const tx = new Transaction(challengeXdr, env.stellarNetworkPassphrase);
      tx.sign(attackerKeypair);
      const attackerSignedXdr = tx.toXDR();

      // 3. Verify must reject
      const verifyRes = await request(app)
        .post('/api/auth/verify')
        .send({ transaction: attackerSignedXdr });

      expect(verifyRes.status).toBe(401);
      expect(verifyRes.body.error).toContain('Signature verification failed');
    });

    it('successfully verifies a valid signed challenge and issues a secure JWT cookie', async () => {
      // 1. Get challenge
      const challengeRes = await request(app).get(`/api/auth/challenge?account=${clientAddress}`);
      const challengeXdr = challengeRes.body.transaction;

      // 2. Sign with correct clientKeypair
      const tx = new Transaction(challengeXdr, env.stellarNetworkPassphrase);
      tx.sign(clientKeypair);
      const signedXdr = tx.toXDR();

      // Mock user in Supabase
      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'mock-user-id',
            stellar_address: clientAddress,
            email: 'test@example.com',
            role: 'user',
            is_client: true,
            is_freelancer: true,
          },
          error: null,
        }),
      } as any);

      // 3. Submit for verification
      const verifyRes = await request(app)
        .post('/api/auth/verify')
        .send({ transaction: signedXdr });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body).toHaveProperty('token');
      expect(verifyRes.body).toHaveProperty('user');
      expect(verifyRes.body.user.stellar_address).toBe(clientAddress);

      // Verify Set-Cookie header contains httpOnly token
      const cookies = verifyRes.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const tokenCookie = (Array.isArray(cookies) ? cookies : [cookies]).find((c: string) => c.startsWith('token='));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toContain('HttpOnly');

      // Verify JWT payload
      const decoded = jwt.verify(verifyRes.body.token, env.jwtSecret) as any;
      expect(decoded.sub).toBe(clientAddress);

      vi.restoreAllMocks();
    });
  });

  describe('Session Security & Protected Endpoints', () => {
    it('GET /api/auth/me returns 401 without authentication', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Authentication required');
    });

    it('GET /api/auth/me returns user profile when authenticated via Bearer token', async () => {
      const token = jwt.sign(
        { sub: clientAddress, role: 'user', is_client: true, is_freelancer: true },
        env.jwtSecret,
        { expiresIn: '1h' }
      );

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            stellar_address: clientAddress,
            role: 'user',
            is_client: true,
            is_freelancer: true,
          },
          error: null,
        }),
      } as any);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.stellar_address).toBe(clientAddress);

      vi.restoreAllMocks();
    });

    it('POST /api/auth/logout successfully clears cookies', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Logged out');
    });

    it('POST /api/projects rejects unauthenticated requests with 401', async () => {
      const res = await request(app).post('/api/projects').send({
        title: 'Unauthorized Project',
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Authentication required');
    });

    it('POST /api/milestones rejects unauthenticated requests with 401', async () => {
      const res = await request(app).post('/api/milestones').send({
        title: 'Unauthorized Milestone',
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Authentication required');
    });

    it('POST /api/proposals rejects unauthenticated requests with 401', async () => {
      const res = await request(app).post('/api/proposals').send({
        project_id: '123',
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Authentication required');
    });

    it('GET /api/projects/:projectId/messages rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/projects/123/messages');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Authentication required');
    });
  });
});
