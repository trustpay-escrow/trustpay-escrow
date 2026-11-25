import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { Project } from '@/types';

const html2canvasMock = vi.hoisted(() => vi.fn());
vi.mock('html2canvas', () => ({ default: html2canvasMock }));
vi.mock('@/lib/soroban', () => ({
  getStellarExplorerUrl: (id: string, type: string) => `https://explorer.test/${type}/${id}`,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import { ShareableMilestoneCard, ShareMilestoneButton } from './ShareableMilestoneCard';

const TX = 'f'.repeat(64);

const project = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  title: 'Landing page redesign',
  description: '',
  category: 'Design',
  budget: 1250,
  token: 'USDC',
  status: 'in_progress',
  tx_hash: TX,
  milestones: [{ id: 'm1', milestone_index: 0, title: 'Design handoff', amount: 400, status: 'approved' }],
  ...over,
});

const pngCanvas = () => ({
  toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['png'], { type: 'image/png' })),
});

describe('ShareableMilestoneCard', () => {
  let click: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    html2canvasMock.mockReset().mockResolvedValue(pngCanvas());
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() }));
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => {
    click.mockRestore();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders a 1200x630 card with project, amount, brand badge and Stellar stamp', () => {
    render(<ShareableMilestoneCard project={project()} rating={5} />);
    const card = screen.getByTestId('share-card-capture');

    expect(card).toHaveStyle({ width: '1200px', height: '630px' });
    expect(card).toHaveTextContent('TrustPay Escrow');
    expect(card).toHaveTextContent('Milestone Completed');
    expect(card).toHaveTextContent('Landing page redesign');
    expect(card).toHaveTextContent('Design handoff');
    expect(screen.getByTestId('share-card-capture-amount')).toHaveTextContent('400 USDC');
    expect(card).toHaveTextContent('Verified on Stellar');
    expect(card).toHaveTextContent('Tx ffffffff…ffffffff');
    expect(within(card).getByLabelText('Rated 5 out of 5')).toBeInTheDocument();
    // The on-screen preview shows the same content.
    expect(screen.getByTestId('share-card-preview')).toHaveTextContent('Landing page redesign');
  });

  it('only uses colours html2canvas can parse (no oklch/var/color-mix) inside the capture', () => {
    render(<ShareableMilestoneCard project={project()} />);
    const html = screen.getByTestId('share-card-capture').outerHTML;
    expect(html).not.toMatch(/oklch|oklab|color-mix|var\(--/);
  });

  it('supports dark and light themes for preview and export', () => {
    render(<ShareableMilestoneCard project={project()} />);
    expect(screen.getByTestId('share-card-capture')).toHaveAttribute('data-theme-name', 'dark');
    const darkBg = (screen.getByTestId('share-card-capture') as HTMLElement).style.background;

    fireEvent.click(screen.getByRole('button', { name: 'light' }));

    expect(screen.getByTestId('share-card-capture')).toHaveAttribute('data-theme-name', 'light');
    expect(screen.getByTestId('share-card-preview')).toHaveAttribute('data-theme-name', 'light');
    expect((screen.getByTestId('share-card-capture') as HTMLElement).style.background).not.toBe(darkBg);
    expect(screen.getByRole('button', { name: 'light' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'dark' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('can start in the light theme', () => {
    render(<ShareableMilestoneCard project={project()} initialTheme="light" />);
    expect(screen.getByTestId('share-card-capture')).toHaveAttribute('data-theme-name', 'light');
  });

  it('Download PNG renders the full-size card element to canvas and saves the file', async () => {
    render(<ShareableMilestoneCard project={project()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download PNG' }));

    await waitFor(() => expect(html2canvasMock).toHaveBeenCalledTimes(1));
    const [element, options] = html2canvasMock.mock.calls[0];
    expect(element).toBe(screen.getByTestId('share-card-capture')); // capture node, not the scaled preview
    expect(options).toMatchObject({ width: 1200, height: 630, scale: 2 });

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('trustpay-milestone-design-handoff.png');
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('renders the exported card in the selected theme', async () => {
    render(<ShareableMilestoneCard project={project()} />);
    fireEvent.click(screen.getByRole('button', { name: 'light' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download PNG' }));
    await waitFor(() => expect(html2canvasMock).toHaveBeenCalled());
    expect((html2canvasMock.mock.calls[0][0] as HTMLElement).dataset.themeName).toBe('light');
  });

  it('shows an error and does not download when rendering fails', async () => {
    html2canvasMock.mockRejectedValue(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ShareableMilestoneCard project={project()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download PNG' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(click).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Download PNG' })).not.toBeDisabled();
  });

  it('Share to X opens a tweet intent with the announcement and the explorer link', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<ShareableMilestoneCard project={project()} rating={4} />);
    fireEvent.click(screen.getByRole('button', { name: 'Share to X' }));

    expect(open).toHaveBeenCalledTimes(1);
    const [href, target, features] = open.mock.calls[0];
    expect(target).toBe('_blank');
    expect(features).toBe('noopener,noreferrer');

    const intent = new URL(href as string);
    expect(intent.origin + intent.pathname).toBe('https://twitter.com/intent/tweet');
    const text = intent.searchParams.get('text')!;
    expect(text).toContain('Design handoff');
    expect(text).toContain('400 USDC');
    expect(text).toContain('Rated 4/5');
    expect(intent.searchParams.get('url')).toBe(`https://explorer.test/tx/${TX}`);
  });

  it('honours an explicit shareUrl', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<ShareableMilestoneCard project={project()} shareUrl="https://trustpay.example/p/1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Share to X' }));
    expect(new URL(open.mock.calls[0][0] as string).searchParams.get('url')).toBe('https://trustpay.example/p/1');
  });

  it('renders nothing when there is nothing finished to share', () => {
    const { container } = render(<ShareableMilestoneCard project={project({ milestones: [] })} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ShareMilestoneButton', () => {
  it('is hidden until a milestone is approved or the project is completed', () => {
    const { container, rerender } = render(<ShareMilestoneButton project={project({ milestones: [] })} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<ShareMilestoneButton project={project()} />);
    expect(screen.getByRole('button', { name: 'Share Achievement' })).toBeInTheDocument();

    rerender(<ShareMilestoneButton project={project({ milestones: [], status: 'completed' })} />);
    expect(screen.getByRole('button', { name: 'Share Achievement' })).toBeInTheDocument();
  });

  it('opens the card in a dialog and closes it with the button or Escape', () => {
    render(<ShareMilestoneButton project={project()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Share Achievement' }));
    const dialog = screen.getByRole('dialog', { name: 'Share achievement' });
    expect(within(dialog).getByRole('button', { name: 'Download PNG' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Share to X' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close share dialog' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Share Achievement' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
