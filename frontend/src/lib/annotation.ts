/**
 * Pure logic for the evidence annotation canvas: shapes, undo/redo history,
 * geometry, drawing and PNG export.
 *
 * All coordinates are in "working space": the source image scaled down (never
 * up) so its longest side is at most MAX_DIMENSION. The on-screen canvas and
 * the exported PNG share that space, so what the user sees is what is exported
 * regardless of how large the canvas is displayed.
 */

export type AnnotationTool = 'pen' | 'highlight' | 'arrow' | 'redact';

export interface Point {
  x: number;
  y: number;
}

export type Shape =
  | { kind: 'pen'; points: Point[] }
  | { kind: 'highlight'; x: number; y: number; w: number; h: number }
  | { kind: 'arrow'; from: Point; to: Point }
  | { kind: 'redact'; x: number; y: number; w: number; h: number };

/** Longest side of the working/exported image, to keep evidence files small. */
export const MAX_DIMENSION = 2000;
export const MAX_HISTORY = 100;
/** Drags smaller than this (in working px) are treated as accidental clicks. */
export const MIN_SHAPE_SIZE = 3;

export const HIGHLIGHT_COLOR = '#ef4444';
export const REDACTION_COLOR = '#000000';

export function fitSize(width: number, height: number, max = MAX_DIMENSION): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Stroke width that stays visible on both small and large images. */
export function strokeWidthFor(workingWidth: number): number {
  return Math.max(3, Math.round(workingWidth / 300));
}

export function normalizeRect(a: Point, b: Point): { x: number; y: number; w: number; h: number } {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

/** Keep a point inside the canvas so drags past the edge still produce valid shapes. */
export function clampPoint(p: Point, width: number, height: number): Point {
  return { x: Math.min(width, Math.max(0, p.x)), y: Math.min(height, Math.max(0, p.y)) };
}

/** Build the shape for a finished drag, or null when it is too small to keep. */
export function shapeFromDrag(tool: AnnotationTool, start: Point, end: Point, path: Point[] = []): Shape | null {
  if (tool === 'pen') {
    return path.length >= 2 ? { kind: 'pen', points: path } : null;
  }
  if (tool === 'arrow') {
    return Math.hypot(end.x - start.x, end.y - start.y) < MIN_SHAPE_SIZE ? null : { kind: 'arrow', from: start, to: end };
  }
  const r = normalizeRect(start, end);
  if (r.w < MIN_SHAPE_SIZE || r.h < MIN_SHAPE_SIZE) return null;
  return tool === 'highlight' ? { kind: 'highlight', ...r } : { kind: 'redact', ...r };
}

/** The two barbs of an arrow head at `to`, pointing along from -> to. */
export function arrowHead(from: Point, to: Point, size: number): [Point, Point] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const spread = Math.PI / 7;
  return [
    { x: to.x - size * Math.cos(angle - spread), y: to.y - size * Math.sin(angle - spread) },
    { x: to.x - size * Math.cos(angle + spread), y: to.y - size * Math.sin(angle + spread) },
  ];
}

// ── Undo / redo ──────────────────────────────────────────────────────────────

export interface History {
  past: Shape[][];
  present: Shape[];
  future: Shape[][];
}

export const emptyHistory = (): History => ({ past: [], present: [], future: [] });
export const canUndo = (h: History) => h.past.length > 0;
export const canRedo = (h: History) => h.future.length > 0;

/** Add a shape. Any redo branch is discarded, as in every editor. */
export function commit(h: History, shape: Shape): History {
  return {
    past: [...h.past, h.present].slice(-MAX_HISTORY),
    present: [...h.present, shape],
    future: [],
  };
}

export function undo(h: History): History {
  if (!canUndo(h)) return h;
  return {
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [h.present, ...h.future],
  };
}

export function redo(h: History): History {
  if (!canRedo(h)) return h;
  return {
    past: [...h.past, h.present].slice(-MAX_HISTORY),
    present: h.future[0],
    future: h.future.slice(1),
  };
}

/** Remove every mark. Recorded as a step, so Undo brings the marks back. */
export function clearAll(h: History): History {
  if (h.present.length === 0) return h;
  return { past: [...h.past, h.present].slice(-MAX_HISTORY), present: [], future: [] };
}

// ── Drawing ──────────────────────────────────────────────────────────────────

type Ctx = Pick<
  CanvasRenderingContext2D,
  | 'save'
  | 'restore'
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'stroke'
  | 'fill'
  | 'fillRect'
  | 'strokeRect'
  | 'closePath'
> &
  Partial<CanvasRenderingContext2D>;

/**
 * Paint every shape. Redactions are painted LAST and fully opaque, whatever
 * order they were drawn in, so no pen stroke, highlight or arrow can ever sit
 * on top of a redaction bar or soften it.
 */
export function drawShapes(ctx: Ctx, shapes: Shape[], workingWidth: number): void {
  const lw = strokeWidthFor(workingWidth);
  const ordered = [...shapes.filter((s) => s.kind !== 'redact'), ...shapes.filter((s) => s.kind === 'redact')];

  for (const s of ordered) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw;
    if (s.kind === 'pen') {
      ctx.strokeStyle = HIGHLIGHT_COLOR;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      s.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (s.kind === 'highlight') {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = HIGHLIGHT_COLOR;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = HIGHLIGHT_COLOR;
      ctx.strokeRect(s.x, s.y, s.w, s.h);
    } else if (s.kind === 'arrow') {
      ctx.strokeStyle = HIGHLIGHT_COLOR;
      ctx.fillStyle = HIGHLIGHT_COLOR;
      ctx.beginPath();
      ctx.moveTo(s.from.x, s.from.y);
      ctx.lineTo(s.to.x, s.to.y);
      ctx.stroke();
      const [a, b] = arrowHead(s.from, s.to, lw * 5);
      ctx.beginPath();
      ctx.moveTo(s.to.x, s.to.y);
      ctx.lineTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.globalAlpha = 1;
      ctx.fillStyle = REDACTION_COLOR;
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }
    ctx.restore();
  }
}

// ── Export ───────────────────────────────────────────────────────────────────

export function buildEvidenceFilename(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '');
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `evidence-${slug || 'screenshot'}-annotated.png`;
}

/**
 * Flatten the image and its marks into a single opaque PNG at working size.
 *
 * Redaction is irreversible by construction: the output is re-encoded from
 * canvas pixels, so the covered pixels no longer exist in the file, there is
 * no layer or vector data to recover, and the source file's metadata (EXIF,
 * GPS, embedded thumbnails) is not carried over.
 */
export async function exportAnnotatedPng(
  image: CanvasImageSource,
  shapes: Shape[],
  size: { width: number; height: number },
  createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')
): Promise<Blob> {
  const canvas = createCanvas();
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.drawImage(image, 0, 0, size.width, size.height);
  drawShapes(ctx, shapes, size.width);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the annotated image'))),
      'image/png'
    );
  });
}
