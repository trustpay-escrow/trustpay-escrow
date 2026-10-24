import { describe, it, expect, vi } from 'vitest';
import { prisma, checkPrismaConnection, disconnectPrisma } from '../config/prisma.js';

describe('Prisma Client & Supabase PostgreSQL Integration', () => {
  it('instantiates the Prisma Client singleton with all Supabase models available', () => {
    expect(prisma).toBeDefined();
    // Validate that all schema models mapped to Supabase are present on Prisma instance
    expect(prisma.user).toBeDefined();
    expect(prisma.project).toBeDefined();
    expect(prisma.milestone).toBeDefined();
    expect(prisma.dispute).toBeDefined();
    expect(prisma.projectFile).toBeDefined();
    expect(prisma.proposal).toBeDefined();
    expect(prisma.notification).toBeDefined();
    expect(prisma.message).toBeDefined();
  });

  it('safely performs checkPrismaConnection without crashing when unconfigured or offline', async () => {
    const isConnected = await checkPrismaConnection();
    // In CI / local test environment without direct DB credentials, gracefully returns false
    expect(typeof isConnected).toBe('boolean');
  });

  it('gracefully executes disconnectPrisma without unhandled rejection', async () => {
    await expect(disconnectPrisma()).resolves.not.toThrow();
  });
});
