import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import { EvidenceAnnotationCanvas } from './EvidenceAnnotationCanvas';

type Call = { op: string; args: unknown[]; fillStyle?: unknown; globalAlpha?: number };
let calls: Call[] = [];
let blobResult: Blob | null = new Blob(['png'], { type: 'image/png' });
let imageSize = { w: 1000, h: 500 };

function makeCtx() {
  const ctx: Record<string, unknown> = { globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1 };
  const stack: Array<Record<string, unknown>> = [];
  for (const op of ['beginPath', 'moveTo', 'lineTo', 'stroke', 'fill', 'closePath', 'drawImage', 'fillRect', 'strokeRect', 'clearRect']) {
    ctx[op] = (...args: unknown[]) => calls.push({ op, args, fillStyle: ctx.fillStyle, globalAlpha: ctx.globalAlpha as number });
  }
  ctx.save = () => stack.push({ ...ctx });
  ctx.restore = () => Object.assign(ctx, stack.pop());
  return ctx;
}

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = imageSize.w;
  naturalHeight = imageSize.h;
  crossOrigin: string | null = null;
  set src(value: string) {
    queueMicrotask(() => (value.includes('broken') ? this.onerror?.() : this.onload?.()));
  }
}

const canvas = () => screen.getByRole('img', { name: 'Evidence image editor' }) as HTMLCanvasElement;

/** Canvas is 1000x500 working px, shown at 500x250 CSS px, so client coords are half of working coords. */
const drag = (from: [number, number], to: [number, number], via: Array<[number, number]> = []) => {
  const c = canvas();
  const ev = (p: [number, number]) => ({ clientX: p[0], clientY: p[1], button: 0, pointerId: 1 });
  fireEvent.pointerDown(c, ev(from));
  via.forEach((p) => fireEvent.pointerMove(c, ev(p)));
  fireEvent.pointerMove(c, ev(to));
  fireEvent.pointerUp(c, ev(to));
};

const status = () => screen.getByRole('status').textContent ?? '';
const clickTool = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const redactionFills = () => calls.filter((c) => c.op === 'fillRect' && c.fillStyle === '#000000');

async function renderEditor(props: Partial<React.ComponentProps<typeof EvidenceAnnotationCanvas>> = {}) {
  const onExport = vi.fn();
  const view = render(
    <EvidenceAnnotationCanvas imageSrc="blob:shot" fileName="Login Screen.png" onExport={onExport} {...props} />
  );
  await screen.findByRole('img', { name: 'Evidence image editor' });
  return { onExport, ...view };
}

describe('EvidenceAnnotationCanvas', () => {
  beforeEach(() => {
    calls = [];
    blobResult = new Blob(['png'], { type: 'image/png' });
    imageSize = { w: 1000, h: 500 };
    vi.stubGlobal('Image', FakeImage);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      (() => makeCtx()) as unknown as HTMLCanvasElement['getContext']
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb: BlobCallback) => cb(blobResult));
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 500, bottom: 250, width: 500, height: 250, x: 0, y: 0, toJSON: () => ({}),
    });
    vi.mocked(toast.error).mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads the screenshot into a canvas at its natural size and paints it', async () => {
    await renderEditor();
    expect(canvas()).toHaveAttribute('width', '1000');
    expect(canvas()).toHaveAttribute('height', '500');
    await waitFor(() => expect(calls.some((c) => c.op === 'drawImage')).toBe(true));
    expect(status()).toContain('0 marks');
  });

  it('downscales very large screenshots to keep evidence files small', async () => {
    imageSize = { w: 4000, h: 2000 };
    await renderEditor();
    expect(canvas()).toHaveAttribute('width', '2000');
    expect(canvas()).toHaveAttribute('height', '1000');
  });

  it('redacts with an opaque black bar, in image coordinates', async () => {
    await renderEditor();
    drag([50, 25], [150, 75]); // client px -> working px x2

    expect(status()).toContain('1 mark, 1 redaction');
    await waitFor(() => expect(redactionFills().length).toBeGreaterThan(0));
    const fill = redactionFills().at(-1)!;
    expect(fill.args).toEqual([100, 50, 200, 100]);
    expect(fill.globalAlpha).toBe(1);
  });

  it('draws highlight boxes, arrows and freehand strokes', async () => {
    await renderEditor();

    clickTool('Highlight box');
    drag([10, 10], [60, 60]);
    clickTool('Arrow');
    drag([100, 100], [200, 150]);
    clickTool('Pen');
    drag([20, 200], [60, 220], [[30, 205], [45, 215]]);

    expect(status()).toContain('3 marks');
    expect(status()).not.toContain('redaction');
    await waitFor(() => expect(calls.some((c) => c.op === 'strokeRect')).toBe(true)); // highlight outline
    expect(calls.some((c) => c.op === 'fill')).toBe(true); // arrow head
    expect(calls.filter((c) => c.op === 'lineTo').length).toBeGreaterThan(3); // pen path + arrow
  });

  it('ignores accidental clicks and right-clicks', async () => {
    await renderEditor();
    drag([50, 50], [51, 51]); // below the minimum size
    expect(status()).toContain('0 marks');

    const c = canvas();
    fireEvent.pointerDown(c, { clientX: 10, clientY: 10, button: 2, pointerId: 1 });
    fireEvent.pointerMove(c, { clientX: 200, clientY: 200, button: 2, pointerId: 1 });
    fireEvent.pointerUp(c, { clientX: 200, clientY: 200, button: 2, pointerId: 1 });
    expect(status()).toContain('0 marks');
  });

  it('clamps drags that leave the canvas to its edges', async () => {
    await renderEditor();
    drag([50, 50], [-400, 900]); // far outside to the lower left
    await waitFor(() => expect(redactionFills().length).toBeGreaterThan(0));
    expect(redactionFills().at(-1)!.args).toEqual([0, 100, 100, 400]); // x:0..100, y:100..500
  });

  it('supports undo, redo and clear (clear is undoable)', async () => {
    await renderEditor();
    const undoBtn = screen.getByRole('button', { name: 'Undo' });
    const redoBtn = screen.getByRole('button', { name: 'Redo' });
    const clearBtn = screen.getByRole('button', { name: 'Clear' });
    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeDisabled();
    expect(clearBtn).toBeDisabled();

    drag([10, 10], [60, 60]);
    drag([100, 100], [160, 160]);
    expect(status()).toContain('2 marks');
    expect(undoBtn).toBeEnabled();

    fireEvent.click(undoBtn);
    expect(status()).toContain('1 mark,');
    expect(redoBtn).toBeEnabled();
    fireEvent.click(redoBtn);
    expect(status()).toContain('2 marks');

    fireEvent.click(clearBtn);
    expect(status()).toContain('0 marks');
    expect(clearBtn).toBeDisabled();
    fireEvent.click(undoBtn);
    expect(status()).toContain('2 marks');
  });

  it('a new mark after undo drops the redo branch', async () => {
    await renderEditor();
    drag([10, 10], [60, 60]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled();
    drag([100, 100], [160, 160]);
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });

  it('supports Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y inside the editor', async () => {
    await renderEditor();
    drag([10, 10], [60, 60]);
    drag([100, 100], [160, 160]);

    fireEvent.keyDown(canvas(), { key: 'z', ctrlKey: true });
    expect(status()).toContain('1 mark,');
    fireEvent.keyDown(canvas(), { key: 'z', ctrlKey: true, shiftKey: true });
    expect(status()).toContain('2 marks');
    fireEvent.keyDown(canvas(), { key: 'z', metaKey: true });
    fireEvent.keyDown(canvas(), { key: 'y', ctrlKey: true });
    expect(status()).toContain('2 marks');
    fireEvent.keyDown(canvas(), { key: 'z' }); // plain z does nothing
    expect(status()).toContain('2 marks');
  });

  it('does not hijack undo shortcuts pressed outside the editor', async () => {
    const { container } = await renderEditor();
    drag([10, 10], [60, 60]);
    const outside = document.createElement('textarea');
    document.body.appendChild(outside);
    fireEvent.keyDown(outside, { key: 'z', ctrlKey: true });
    expect(container.textContent).toContain('1 mark');
    outside.remove();
  });

  it('exports a flattened PNG named after the source, with redactions painted last and opaque', async () => {
    const { onExport } = await renderEditor();
    clickTool('Redact');
    drag([50, 25], [150, 75]);
    clickTool('Highlight box');
    drag([40, 20], [160, 80]); // drawn over the redaction afterwards
    calls = [];

    fireEvent.click(screen.getByRole('button', { name: 'Export PNG' }));

    await waitFor(() => expect(onExport).toHaveBeenCalledTimes(1));
    const result = onExport.mock.calls[0][0];
    expect(result.blob).toBe(blobResult);
    expect(result.filename).toBe('evidence-login-screen-annotated.png');

    // Export paints white base, the image, then marks; the redaction is the final operation.
    expect(calls[0]).toMatchObject({ op: 'fillRect', args: [0, 0, 1000, 500], fillStyle: '#ffffff' });
    expect(calls.some((c) => c.op === 'drawImage')).toBe(true);
    expect(calls.at(-1)).toMatchObject({ op: 'fillRect', args: [100, 50, 200, 100], fillStyle: '#000000', globalAlpha: 1 });
  });

  it('exports an unannotated image too, and shows a clear error if encoding fails', async () => {
    const { onExport } = await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Export PNG' }));
    await waitFor(() => expect(onExport).toHaveBeenCalledTimes(1));

    blobResult = null;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Export PNG' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Export PNG' })).toBeEnabled();
  });

  it('tells the user redactions are permanent in the saved file', async () => {
    await renderEditor();
    expect(status()).toContain('cannot be removed from the saved file');
  });

  it('shows an error and a Close action when the image cannot be loaded', async () => {
    const onCancel = vi.fn();
    render(<EvidenceAnnotationCanvas imageSrc="blob:broken" onExport={() => {}} onCancel={onCancel} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    expect(screen.queryByRole('img', { name: 'Evidence image editor' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('offers Cancel only when a handler is provided', async () => {
    const onCancel = vi.fn();
    const { unmount } = await renderEditor({ onCancel });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();

    await renderEditor();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });
});
