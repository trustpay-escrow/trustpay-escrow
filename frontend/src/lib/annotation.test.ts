import { describe, it, expect, vi } from 'vitest';
import {
  arrowHead,
  buildEvidenceFilename,
  canRedo,
  canUndo,
  clampPoint,
  clearAll,
  commit,
  drawShapes,
  emptyHistory,
  exportAnnotatedPng,
  fitSize,
  MAX_DIMENSION,
  MAX_HISTORY,
  normalizeRect,
  redo,
  Shape,
  shapeFromDrag,
  strokeWidthFor,
  undo,
} from './annotation';

const redact = (x = 0): Shape => ({ kind: 'redact', x, y: 0, w: 10, h: 10 });
const box = (x = 0): Shape => ({ kind: 'highlight', x, y: 0, w: 10, h: 10 });

describe('geometry', () => {
  it('fitSize only ever scales down, preserving aspect ratio', () => {
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitSize(4000, 2000)).toEqual({ width: 2000, height: 1000 });
    expect(fitSize(1000, 5000)).toEqual({ width: 400, height: 2000 });
    expect(fitSize(3000, 3000, 1500)).toEqual({ width: 1500, height: 1500 });
    expect(MAX_DIMENSION).toBe(2000);
  });

  it('strokeWidthFor stays visible on small images and grows with large ones', () => {
    expect(strokeWidthFor(300)).toBe(3);
    expect(strokeWidthFor(1500)).toBe(5);
    expect(strokeWidthFor(2000)).toBe(7);
  });

  it('normalizeRect handles drags in any direction', () => {
    expect(normalizeRect({ x: 50, y: 40 }, { x: 10, y: 5 })).toEqual({ x: 10, y: 5, w: 40, h: 35 });
  });

  it('clampPoint keeps drags inside the canvas', () => {
    expect(clampPoint({ x: -5, y: 900 }, 100, 200)).toEqual({ x: 0, y: 200 });
    expect(clampPoint({ x: 50, y: 60 }, 100, 200)).toEqual({ x: 50, y: 60 });
  });

  it('arrowHead barbs are symmetric about the shaft and sit behind the tip', () => {
    const [a, b] = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 20);
    expect(a.x).toBeLessThan(100);
    expect(b.x).toBeLessThan(100);
    expect(a.x).toBeCloseTo(b.x);
    expect(a.y).toBeCloseTo(-b.y);
    expect(Math.hypot(100 - a.x, a.y)).toBeCloseTo(20);
  });
});

describe('shapeFromDrag', () => {
  const s = { x: 10, y: 10 };
  it('builds highlight and redact rectangles from any drag direction', () => {
    expect(shapeFromDrag('highlight', s, { x: 5, y: 40 })).toEqual({ kind: 'highlight', x: 5, y: 10, w: 5, h: 30 });
    expect(shapeFromDrag('redact', s, { x: 60, y: 50 })).toEqual({ kind: 'redact', x: 10, y: 10, w: 50, h: 40 });
  });

  it('builds arrows and pen strokes', () => {
    expect(shapeFromDrag('arrow', s, { x: 50, y: 50 })).toEqual({ kind: 'arrow', from: s, to: { x: 50, y: 50 } });
    const path = [s, { x: 12, y: 14 }, { x: 20, y: 20 }];
    expect(shapeFromDrag('pen', s, s, path)).toEqual({ kind: 'pen', points: path });
  });

  it('discards accidental clicks and tiny drags', () => {
    expect(shapeFromDrag('redact', s, { x: 11, y: 11 })).toBeNull();
    expect(shapeFromDrag('redact', s, { x: 100, y: 11 })).toBeNull(); // zero-height sliver
    expect(shapeFromDrag('highlight', s, s)).toBeNull();
    expect(shapeFromDrag('arrow', s, { x: 11, y: 11 })).toBeNull();
    expect(shapeFromDrag('pen', s, s, [s])).toBeNull();
  });
});

describe('undo / redo / clear', () => {
  it('commit appends and enables undo', () => {
    const h = commit(emptyHistory(), box(1));
    expect(h.present).toEqual([box(1)]);
    expect(canUndo(h)).toBe(true);
    expect(canRedo(h)).toBe(false);
  });

  it('undo and redo walk the stack one step at a time', () => {
    let h = emptyHistory();
    h = commit(h, box(1));
    h = commit(h, box(2));
    h = commit(h, box(3));

    h = undo(h);
    expect(h.present).toEqual([box(1), box(2)]);
    h = undo(h);
    expect(h.present).toEqual([box(1)]);
    h = redo(h);
    expect(h.present).toEqual([box(1), box(2)]);
    h = redo(h);
    expect(h.present).toEqual([box(1), box(2), box(3)]);
    expect(canRedo(h)).toBe(false);
  });

  it('is a no-op at the ends of the stack', () => {
    const empty = emptyHistory();
    expect(undo(empty)).toBe(empty);
    expect(redo(empty)).toBe(empty);
  });

  it('a new mark after undo discards the redo branch', () => {
    let h = commit(commit(emptyHistory(), box(1)), box(2));
    h = undo(h);
    expect(canRedo(h)).toBe(true);
    h = commit(h, box(9));
    expect(canRedo(h)).toBe(false);
    expect(h.present).toEqual([box(1), box(9)]);
  });

  it('clear removes every mark but can be undone', () => {
    let h = commit(commit(emptyHistory(), box(1)), redact(2));
    h = clearAll(h);
    expect(h.present).toEqual([]);
    h = undo(h);
    expect(h.present).toEqual([box(1), redact(2)]);
    h = redo(h);
    expect(h.present).toEqual([]);
  });

  it('clearing an already-empty canvas does not add a history step', () => {
    const empty = emptyHistory();
    expect(clearAll(empty)).toBe(empty);
  });

  it('caps the undo stack at MAX_HISTORY', () => {
    let h = emptyHistory();
    for (let i = 0; i < MAX_HISTORY + 25; i++) h = commit(h, box(i));
    expect(h.past).toHaveLength(MAX_HISTORY);
    expect(h.present).toHaveLength(MAX_HISTORY + 25);
  });

  it('never mutates earlier snapshots', () => {
    const h1 = commit(emptyHistory(), box(1));
    const h2 = commit(h1, box(2));
    expect(h1.present).toEqual([box(1)]);
    expect(h2.past[1]).toEqual([box(1)]);
  });
});

/** Fake 2D context that records every call and the state in effect at each. */
function fakeCtx() {
  const calls: Array<{ op: string; args: unknown[]; fillStyle?: unknown; globalAlpha?: number }> = [];
  const ctx: Record<string, unknown> = { globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1 };
  const stack: Array<Record<string, unknown>> = [];
  for (const op of ['beginPath', 'moveTo', 'lineTo', 'stroke', 'fill', 'closePath', 'drawImage', 'fillRect', 'strokeRect']) {
    ctx[op] = (...args: unknown[]) => calls.push({ op, args, fillStyle: ctx.fillStyle, globalAlpha: ctx.globalAlpha as number });
  }
  ctx.save = () => stack.push({ ...ctx });
  ctx.restore = () => Object.assign(ctx, stack.pop());
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('drawShapes', () => {
  it('paints redactions as fully opaque black rectangles', () => {
    const { ctx, calls } = fakeCtx();
    drawShapes(ctx, [{ kind: 'redact', x: 5, y: 6, w: 70, h: 20 }], 1000);
    const fill = calls.find((c) => c.op === 'fillRect')!;
    expect(fill.args).toEqual([5, 6, 70, 20]);
    expect(fill.fillStyle).toBe('#000000');
    expect(fill.globalAlpha).toBe(1);
  });

  it('paints redactions after every other mark, regardless of creation order', () => {
    const { ctx, calls } = fakeCtx();
    const shapes: Shape[] = [
      redact(0),
      box(5), // drawn after the redaction by the user, over the same area
      { kind: 'pen', points: [{ x: 1, y: 1 }, { x: 4, y: 4 }] },
      { kind: 'arrow', from: { x: 0, y: 0 }, to: { x: 30, y: 30 } },
    ];
    drawShapes(ctx, shapes, 1000);

    const ops = calls.map((c) => `${c.op}:${c.fillStyle}`);
    const lastRedact = ops.lastIndexOf('fillRect:#000000');
    const lastMark = Math.max(
      ops.lastIndexOf('strokeRect:#ef4444'),
      ops.lastIndexOf('stroke:#ef4444'),
      ops.lastIndexOf('fill:#ef4444')
    );
    expect(lastRedact).toBeGreaterThan(lastMark);
    expect(lastRedact).toBe(calls.length - 1); // the redaction is the very last thing painted
  });

  it('draws highlight boxes as a translucent fill plus an outline', () => {
    const { ctx, calls } = fakeCtx();
    drawShapes(ctx, [box(2)], 1000);
    expect(calls.find((c) => c.op === 'fillRect')!.globalAlpha).toBeLessThan(0.5);
    expect(calls.some((c) => c.op === 'strokeRect')).toBe(true);
  });

  it('draws a pen stroke as one connected path and an arrow with a filled head', () => {
    const pen = fakeCtx();
    drawShapes(pen.ctx, [{ kind: 'pen', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }] }], 1000);
    expect(pen.calls.filter((c) => c.op === 'lineTo')).toHaveLength(2);
    expect(pen.calls.filter((c) => c.op === 'stroke')).toHaveLength(1);

    const arrow = fakeCtx();
    drawShapes(arrow.ctx, [{ kind: 'arrow', from: { x: 0, y: 0 }, to: { x: 50, y: 0 } }], 1000);
    expect(arrow.calls.some((c) => c.op === 'fill')).toBe(true);
  });

  it('leaves the context state clean for the next shape (save/restore)', () => {
    const { ctx } = fakeCtx();
    drawShapes(ctx, [box(0), redact(0)], 1000);
    expect((ctx as unknown as { globalAlpha: number }).globalAlpha).toBe(1);
  });
});

describe('buildEvidenceFilename', () => {
  it('derives a safe png name and drops the original extension', () => {
    expect(buildEvidenceFilename('Screen Shot 2026-11-20 at 10.31.PM.jpeg')).toBe(
      'evidence-screen-shot-2026-11-20-at-10-31-pm-annotated.png'
    );
    expect(buildEvidenceFilename('???.png')).toBe('evidence-screenshot-annotated.png');
  });
});

describe('exportAnnotatedPng', () => {
  const image = {} as CanvasImageSource;

  function fakeCanvas(blob: Blob | null) {
    const { ctx, calls } = fakeCtx();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctx),
      toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(blob)),
    } as unknown as HTMLCanvasElement;
    return { canvas, calls };
  }

  it('flattens white background, image and marks onto a canvas of the working size', async () => {
    const png = new Blob(['x'], { type: 'image/png' });
    const { canvas, calls } = fakeCanvas(png);

    const out = await exportAnnotatedPng(image, [box(1), redact(2)], { width: 640, height: 480 }, () => canvas);

    expect(out).toBe(png);
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');

    const ops = calls.map((c) => c.op);
    expect(calls[0]).toMatchObject({ op: 'fillRect', args: [0, 0, 640, 480], fillStyle: '#ffffff' }); // opaque base
    expect(ops.indexOf('drawImage')).toBeLessThan(ops.indexOf('strokeRect')); // marks sit on top of the image
    expect(calls.find((c) => c.op === 'drawImage')!.args.slice(1)).toEqual([0, 0, 640, 480]);
    expect(calls[calls.length - 1]).toMatchObject({ op: 'fillRect', fillStyle: '#000000', globalAlpha: 1 }); // redaction last
  });

  it('rejects when the canvas context is unavailable', async () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    await expect(exportAnnotatedPng(image, [], { width: 1, height: 1 }, () => canvas)).rejects.toThrow('not available');
  });

  it('rejects when the browser cannot encode the image', async () => {
    const { canvas } = fakeCanvas(null);
    await expect(exportAnnotatedPng(image, [], { width: 1, height: 1 }, () => canvas)).rejects.toThrow('encode');
  });
});
