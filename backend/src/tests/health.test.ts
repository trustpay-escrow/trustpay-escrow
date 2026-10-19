import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Backend API Health & Liveness Probes', () => {
  it('GET /health returns 200 OK with modular architecture confirmation', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('architecture', 'Modular Domain Architecture');
    expect(res.body).toHaveProperty('message');
  });

  it('handles 404 for unknown routes gracefully', async () => {
    const res = await request(app).get('/api/unknown-endpoint-probe');
    expect(res.status).toBe(404);
  });
});
