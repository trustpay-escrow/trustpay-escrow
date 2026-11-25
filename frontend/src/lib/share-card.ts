import type { Milestone, Project } from '@/types';

export type CardTheme = 'dark' | 'light';

/** Social card dimensions (Twitter/LinkedIn large-image card). */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export interface ShareCardData {
  kind: 'milestone' | 'project';
  projectTitle: string;
  milestoneTitle?: string;
  amount: number;
  token: string;
  /** Transaction hash (preferred) or contract id used for the verification stamp. */
  verificationId?: string;
  verificationType: 'tx' | 'contract' | 'none';
  /** Optional 1-5 contractor rating. */
  rating?: number;
}

/**
 * Decide what to celebrate. An explicit milestone wins; otherwise a completed
 * project celebrates the whole project; otherwise the most recently approved
 * milestone. Returns null when there is nothing finished to share, so callers
 * can hide the share affordance.
 */
export function deriveShareCardData(
  project: Project,
  milestone?: Milestone,
  rating?: number
): ShareCardData | null {
  const token = project.token || 'USDC';
  const txHash = project.tx_hash;
  const verificationId = txHash || project.contract_id;
  const verificationType: ShareCardData['verificationType'] = txHash
    ? 'tx'
    : project.contract_id
      ? 'contract'
      : 'none';
  const base = {
    projectTitle: project.title,
    token,
    verificationId,
    verificationType,
    rating: normalizeRating(rating),
  };

  const approved = (project.milestones ?? []).filter((m) => m.status === 'approved');
  if (milestone) {
    return { ...base, kind: 'milestone', milestoneTitle: milestone.title, amount: milestone.amount };
  }
  if (project.status === 'completed') {
    return { ...base, kind: 'project', amount: project.budget };
  }
  const latest = approved[approved.length - 1];
  if (latest) {
    return { ...base, kind: 'milestone', milestoneTitle: latest.title, amount: latest.amount };
  }
  return null;
}

function normalizeRating(rating?: number): number | undefined {
  if (rating === undefined || !Number.isFinite(rating)) return undefined;
  return Math.min(5, Math.max(1, Math.round(rating)));
}

export function formatCardAmount(amount: number, token: string): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${token}`;
}

export function truncateTitle(title: string, max = 64): string {
  const t = title.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export function truncateMiddle(value: string, head = 6, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** Pre-composed announcement for the Share-to-X intent. */
export function buildShareText(data: ShareCardData): string {
  const what =
    data.kind === 'milestone' && data.milestoneTitle
      ? `completed the "${truncateTitle(data.milestoneTitle, 60)}" milestone on "${truncateTitle(data.projectTitle, 60)}"`
      : `completed "${truncateTitle(data.projectTitle, 80)}"`;
  const parts = [
    `Just ${what} and ${formatCardAmount(data.amount, data.token)} was released through TrustPay Escrow on Stellar ✅`,
  ];
  if (data.rating) parts.push(`Rated ${data.rating}/5 ⭐`);
  parts.push('#Stellar #Web3 #Freelance');
  return parts.join(' ');
}

/** https://developer.x.com/en/docs/x-for-websites/tweet-button/guides/web-intent */
export function buildTwitterIntentUrl({ text, url }: { text: string; url?: string }): string {
  const intent = new URL('https://twitter.com/intent/tweet');
  intent.searchParams.set('text', text);
  if (url) intent.searchParams.set('url', url);
  return intent.toString();
}

export function buildShareFilename(title: string, kind: ShareCardData['kind'] = 'milestone'): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `trustpay-${kind}-${slug || 'card'}.png`;
}

type Html2Canvas = (element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>;

/**
 * Rasterise the card element to a PNG blob at 2x for a crisp 2400x1260 image.
 * `html2canvasImpl` is injectable so tests don't need a real layout engine.
 */
export async function renderElementToPng(
  element: HTMLElement,
  opts: { scale?: number; html2canvasImpl?: Html2Canvas } = {}
): Promise<Blob> {
  const html2canvas: Html2Canvas =
    opts.html2canvasImpl ?? ((await import('html2canvas')).default as unknown as Html2Canvas);
  const canvas = await html2canvas(element, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    scale: opts.scale ?? 2,
    backgroundColor: null,
    useCORS: true,
    logging: false,
  });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas produced no image data'))), 'image/png');
  });
}

export function downloadBlob(blob: Blob, filename: string, doc: Document = document): void {
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  doc.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
