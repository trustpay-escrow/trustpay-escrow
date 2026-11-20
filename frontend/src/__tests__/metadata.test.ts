import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateMetadata, fetchProjectMetadata } from '@/app/projects/[id]/layout';

describe('Project Dynamic SEO Metadata (Issue #170)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('generates dynamic title, OpenGraph tags, and Twitter tags for valid project', async () => {
    const mockProject = {
      id: 'proj-123',
      title: 'Build Stellar Smart Escrow',
      description: 'Implement automated Soroban escrow with milestone verification and multi-token collateral.',
      budget: 1500,
      token: 'USDC',
      category: 'Smart Contracts',
      status: 'open',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ project: mockProject }),
    } as any);

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: 'proj-123' }),
    });

    // Acceptance criteria: Generates dynamic page title: '[Budget] Project Title | TrustPay Escrow'
    expect(metadata.title).toBe('[1500 USDC] Build Stellar Smart Escrow | TrustPay Escrow');
    expect(metadata.description).toContain('Implement automated Soroban escrow');

    // OpenGraph tags
    expect(metadata.openGraph).toBeDefined();
    expect(metadata.openGraph?.title).toBe('[1500 USDC] Build Stellar Smart Escrow | TrustPay Escrow');
    expect(metadata.openGraph?.description).toContain('Implement automated Soroban escrow');
    expect(metadata.openGraph?.siteName).toBe('TrustPay Escrow');
    expect(metadata.openGraph?.url).toContain('/projects/proj-123');

    const ogImages = metadata.openGraph?.images as Array<any>;
    expect(ogImages).toBeDefined();
    expect(ogImages.length).toBeGreaterThan(0);
    expect(ogImages[0].url).toContain('/api/og');
    expect(ogImages[0].url).toContain(encodeURIComponent('Build Stellar Smart Escrow'));
    expect(ogImages[0].url).toContain(encodeURIComponent('1500 USDC'));
    expect(ogImages[0].width).toBe(1200);
    expect(ogImages[0].height).toBe(630);

    // Twitter Card tags
    expect(metadata.twitter).toBeDefined();
    expect((metadata.twitter as any)?.card).toBe('summary_large_image');
    expect((metadata.twitter as any)?.title).toBe('[1500 USDC] Build Stellar Smart Escrow | TrustPay Escrow');
    expect((metadata.twitter as any)?.description).toContain('Implement automated Soroban escrow');
    const twitterImages = (metadata.twitter as any)?.images as Array<string>;
    expect(twitterImages[0]).toContain('/api/og');
  });

  it('generates fallback metadata gracefully when project ID is invalid or not found', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Project not found' }),
    } as any);

  const metadata = await generateMetadata({
    params: Promise.resolve({ id: 'non-existent-999' }),
  });

    expect(metadata.title).toBe('Project Not Found | TrustPay Escrow');
    expect(metadata.description).toContain('The requested escrow project could not be found');
    expect(metadata.openGraph?.title).toBe('Project Not Found | TrustPay Escrow');
    expect((metadata.twitter as any)?.card).toBe('summary_large_image');
  });

  it('generates graceful fallback metadata when network or server error occurs', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network Connection Refused'));

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: 'error-id' }),
    });

    expect(metadata.title).toBe('Project Not Found | TrustPay Escrow');
    expect(metadata.description).toBeDefined();
    expect(metadata.openGraph?.siteName).toBe('TrustPay Escrow');
    expect((metadata.twitter as any)?.card).toBe('summary_large_image');
  });

  it('truncates long descriptions to 160 characters with ellipsis', async () => {
    const longDescription = 'A'.repeat(250);
    const mockProject = {
      id: 'proj-long',
      title: 'Long Project Description',
      description: longDescription,
      budget: 250,
      token: 'XLM',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ project: mockProject }),
    } as any);

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: 'proj-long' }),
    });

    expect(metadata.description?.length).toBeLessThanOrEqual(160);
    expect(metadata.description?.endsWith('...')).toBe(true);
  });
});
