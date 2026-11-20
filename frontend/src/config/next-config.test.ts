import { describe, it, expect, vi, afterEach } from 'vitest';

describe('next.config compiler.removeConsole', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('strips console output in production but keeps error and warn', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const config = (await import('../../next.config')).default;
    expect(config.compiler?.removeConsole).toEqual({ exclude: ['error', 'warn'] });
  });

  it('leaves console output untouched in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    const config = (await import('../../next.config')).default;
    expect(config.compiler?.removeConsole).toBe(false);
  });
});
