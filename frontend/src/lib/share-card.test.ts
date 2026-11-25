import { describe, it, expect, vi } from 'vitest';
import type { Milestone, Project } from '@/types';
import {
  buildShareFilename,
  buildShareText,
  buildTwitterIntentUrl,
  CARD_HEIGHT,
  CARD_WIDTH,
  deriveShareCardData,
  downloadBlob,
  formatCardAmount,
  renderElementToPng,
  truncateMiddle,
  truncateTitle,
} from './share-card';

const milestone = (over: Partial<Milestone> = {}): Milestone => ({
  id: 'm1',
  milestone_index: 0,
  title: 'Design handoff',
  amount: 400,
  status: 'approved',
  ...over,
});

const project = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  title: 'Landing page redesign',
  description: '',
  category: 'Design',
  budget: 1250,
  token: 'USDC',
  status: 'in_progress',
  tx_hash: 'a'.repeat(64),
  milestones: [milestone()],
  ...over,
});

describe('deriveShareCardData', () => {
  it('celebrates an explicitly chosen milestone', () => {
    const d = deriveShareCardData(project(), milestone({ title: 'Final delivery', amount: 850 }));
    expect(d).toMatchObject({ kind: 'milestone', milestoneTitle: 'Final delivery', amount: 850, token: 'USDC' });
  });

  it('celebrates the whole project once it is completed', () => {
    const d = deriveShareCardData(project({ status: 'completed' }));
    expect(d).toMatchObject({ kind: 'project', amount: 1250 });
    expect(d?.milestoneTitle).toBeUndefined();
  });

  it('falls back to the most recently approved milestone', () => {
    const d = deriveShareCardData(
      project({
        milestones: [
          milestone({ id: 'a', title: 'First', amount: 100 }),
          milestone({ id: 'b', title: 'Pending one', status: 'pending' }),
          milestone({ id: 'c', title: 'Second', amount: 200 }),
        ],
      })
    );
    expect(d).toMatchObject({ kind: 'milestone', milestoneTitle: 'Second', amount: 200 });
  });

  it('returns null when nothing has been completed yet', () => {
    expect(deriveShareCardData(project({ milestones: [milestone({ status: 'submitted' })] }))).toBeNull();
    expect(deriveShareCardData(project({ milestones: undefined }))).toBeNull();
  });

  it('prefers the tx hash for the Stellar stamp, then the contract id, then none', () => {
    expect(deriveShareCardData(project())).toMatchObject({ verificationType: 'tx', verificationId: 'a'.repeat(64) });
    expect(deriveShareCardData(project({ tx_hash: undefined, contract_id: 'CABC' }))).toMatchObject({
      verificationType: 'contract',
      verificationId: 'CABC',
    });
    expect(deriveShareCardData(project({ tx_hash: undefined }))).toMatchObject({ verificationType: 'none' });
  });

  it('clamps and rounds ratings into 1-5 and drops invalid ones', () => {
    expect(deriveShareCardData(project(), undefined, 4.6)?.rating).toBe(5);
    expect(deriveShareCardData(project(), undefined, 9)?.rating).toBe(5);
    expect(deriveShareCardData(project(), undefined, 0)?.rating).toBe(1);
    expect(deriveShareCardData(project(), undefined, NaN)?.rating).toBeUndefined();
    expect(deriveShareCardData(project())?.rating).toBeUndefined();
  });

  it('defaults the token to USDC', () => {
    expect(deriveShareCardData(project({ token: undefined }))?.token).toBe('USDC');
  });
});

describe('formatting helpers', () => {
  it('formats amounts with grouping and at most two decimals', () => {
    expect(formatCardAmount(1250, 'USDC')).toBe('1,250 USDC');
    expect(formatCardAmount(0.126, 'XLM')).toBe('0.13 XLM');
    expect(formatCardAmount(NaN, 'USDC')).toBe('0 USDC');
  });

  it('truncates long titles and hashes without touching short ones', () => {
    expect(truncateTitle('short')).toBe('short');
    expect(truncateTitle('x'.repeat(100), 10)).toBe('xxxxxxxxx…');
    expect(truncateMiddle('abcdefghijklmnopqrstuvwxyz', 4, 4)).toBe('abcd…wxyz');
    expect(truncateMiddle('abc', 4, 4)).toBe('abc');
  });

  it('builds a safe png filename', () => {
    expect(buildShareFilename('Landing page / redesign!', 'project')).toBe('trustpay-project-landing-page-redesign.png');
    expect(buildShareFilename('???')).toBe('trustpay-milestone-card.png');
  });
});

describe('share to X intent', () => {
  const data = deriveShareCardData(project(), undefined, 5)!;

  it('pre-composes announcement text with title, amount, rating and tags', () => {
    const text = buildShareText(data);
    expect(text).toContain('"Design handoff"');
    expect(text).toContain('"Landing page redesign"');
    expect(text).toContain('400 USDC');
    expect(text).toContain('Rated 5/5');
    expect(text).toContain('#Stellar');
  });

  it('omits the rating line when there is no rating', () => {
    expect(buildShareText({ ...data, rating: undefined })).not.toContain('Rated');
  });

  it('describes a completed project without a milestone name', () => {
    const text = buildShareText(deriveShareCardData(project({ status: 'completed' }))!);
    expect(text).toContain('completed "Landing page redesign"');
    expect(text).toContain('1,250 USDC');
  });

  it('builds the intent URL with url-encoded text and url params', () => {
    const text = 'Shipped "it" & got paid 100% ✅';
    const href = buildTwitterIntentUrl({ text, url: 'https://stellar.expert/explorer/testnet/tx/abc?x=1&y=2' });
    const parsed = new URL(href);
    expect(parsed.origin + parsed.pathname).toBe('https://twitter.com/intent/tweet');
    expect(parsed.searchParams.get('text')).toBe(text);
    expect(parsed.searchParams.get('url')).toBe('https://stellar.expert/explorer/testnet/tx/abc?x=1&y=2');
    // The raw URL must be encoded so its own query string cannot leak into the intent's.
    expect(href).not.toContain('&y=2');
  });

  it('omits the url param when no link is given', () => {
    expect(new URL(buildTwitterIntentUrl({ text: 'hi' })).searchParams.has('url')).toBe(false);
  });
});

describe('renderElementToPng', () => {
  const makeCanvas = (blob: Blob | null) =>
    ({ toBlob: (cb: (b: Blob | null) => void) => cb(blob) }) as unknown as HTMLCanvasElement;

  it('rasterises the element at 1200x630 and 2x scale and returns a PNG blob', async () => {
    const png = new Blob(['x'], { type: 'image/png' });
    const impl = vi.fn().mockResolvedValue(makeCanvas(png));
    const el = document.createElement('div');

    const out = await renderElementToPng(el, { html2canvasImpl: impl });

    expect(out).toBe(png);
    expect(impl).toHaveBeenCalledTimes(1);
    expect(impl.mock.calls[0][0]).toBe(el);
    expect(impl.mock.calls[0][1]).toMatchObject({
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      scale: 2,
      backgroundColor: null,
      useCORS: true,
    });
    expect(CARD_WIDTH).toBe(1200);
    expect(CARD_HEIGHT).toBe(630);
  });

  it('rejects when the canvas yields no image data', async () => {
    const impl = vi.fn().mockResolvedValue(makeCanvas(null));
    await expect(renderElementToPng(document.createElement('div'), { html2canvasImpl: impl })).rejects.toThrow(
      'no image data'
    );
  });

  it('propagates renderer failures', async () => {
    const impl = vi.fn().mockRejectedValue(new Error('tainted canvas'));
    await expect(renderElementToPng(document.createElement('div'), { html2canvasImpl: impl })).rejects.toThrow(
      'tainted canvas'
    );
  });
});

describe('downloadBlob', () => {
  it('clicks a temporary download link and revokes the object URL', async () => {
    vi.useFakeTimers();
    const create = vi.fn().mockReturnValue('blob:mock');
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('card.png');
      expect(this.href).toBe('blob:mock');
    });

    downloadBlob(new Blob(['x']), 'card.png');

    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a[download]')).toBeNull();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:mock');

    click.mockRestore();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
