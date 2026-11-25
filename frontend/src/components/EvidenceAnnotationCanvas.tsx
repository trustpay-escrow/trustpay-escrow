'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AnnotationTool,
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
  History,
  Point,
  redo,
  Shape,
  shapeFromDrag,
  undo,
} from '@/lib/annotation';

export interface AnnotatedEvidence {
  blob: Blob;
  filename: string;
}

export interface EvidenceAnnotationCanvasProps {
  /** Object URL, data URL or same-origin/CORS-enabled URL of the screenshot. */
  imageSrc: string;
  /** Original file name, used to name the exported PNG. */
  fileName?: string;
  onExport: (result: AnnotatedEvidence) => void;
  onCancel?: () => void;
}

const TOOLS: Array<{ id: AnnotationTool; label: string; hint: string }> = [
  { id: 'highlight', label: 'Highlight box', hint: 'Drag a red box around a defect' },
  { id: 'arrow', label: 'Arrow', hint: 'Drag from the tail to the point of interest' },
  { id: 'pen', label: 'Pen', hint: 'Draw freehand in red' },
  { id: 'redact', label: 'Redact', hint: 'Drag a solid black bar over sensitive text' },
];

interface Loaded {
  image: HTMLImageElement;
  size: { width: number; height: number };
}

interface DragSession {
  tool: AnnotationTool;
  start: Point;
  path: Point[];
}

const btn =
  'px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#333338] bg-[#232326] text-white hover:bg-[#2c2c30] disabled:opacity-40 disabled:cursor-not-allowed';

export function EvidenceAnnotationCanvas({ imageSrc, fileName = 'screenshot.png', onExport, onCancel }: EvidenceAnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragSession | null>(null);

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [history, setHistory] = useState<History>(emptyHistory);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [tool, setTool] = useState<AnnotationTool>('redact');
  const [exporting, setExporting] = useState(false);

  // Load the screenshot. State is only set from the async callbacks.
  useEffect(() => {
    const image = new Image();
    if (!/^(data|blob):/.test(imageSrc)) image.crossOrigin = 'anonymous';
    image.onload = () => {
      setLoadError(null);
      setHistory(emptyHistory());
      setLoaded({ image, size: fitSize(image.naturalWidth, image.naturalHeight) });
    };
    image.onerror = () => {
      setLoaded(null);
      setLoadError('This image could not be loaded. Try a PNG or JPEG screenshot.');
    };
    image.src = imageSrc;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [imageSrc]);

  // Repaint: the base image, every committed mark, then the in-progress one.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, loaded.size.width, loaded.size.height);
    ctx.drawImage(loaded.image, 0, 0, loaded.size.width, loaded.size.height);
    drawShapes(ctx, draft ? [...history.present, draft] : history.present, loaded.size.width);
  }, [loaded, history.present, draft]);

  const toWorking = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width ? canvas.width / rect.width : 1;
    const sy = rect.height ? canvas.height / rect.height : 1;
    return clampPoint({ x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy }, canvas.width, canvas.height);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!loaded || e.button > 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const start = toWorking(e);
    dragRef.current = { tool, start, path: [start] };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = toWorking(e);
    if (drag.tool === 'pen') drag.path.push(p);
    setDraft(shapeFromDrag(drag.tool, drag.start, p, drag.path));
  };

  const finishDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    const shape = shapeFromDrag(drag.tool, drag.start, toWorking(e), drag.path);
    setDraft(null);
    if (shape) setHistory((h) => commit(h, shape));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      setHistory(undo);
    } else if ((key === 'z' && e.shiftKey) || key === 'y') {
      e.preventDefault();
      setHistory(redo);
    }
  };

  const handleExport = async () => {
    if (!loaded) return;
    setExporting(true);
    try {
      const blob = await exportAnnotatedPng(loaded.image, history.present, loaded.size);
      onExport({ blob, filename: buildEvidenceFilename(fileName) });
    } catch (err) {
      console.error('Evidence export failed', err);
      toast.error('Could not export the annotated image. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const redactions = history.present.filter((s) => s.kind === 'redact').length;
  const activeTool = TOOLS.find((t) => t.id === tool)!;

  if (loadError) {
    return (
      <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        {loadError}
        {onCancel && (
          <button type="button" onClick={onCancel} className={`${btn} ml-3`}>
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3" onKeyDown={onKeyDown}>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Annotation tools" className="inline-flex rounded-lg border border-[#333338] overflow-hidden">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tool === t.id}
              title={t.hint}
              onClick={() => setTool(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold ${
                tool === t.id
                  ? t.id === 'redact'
                    ? 'bg-black text-white ring-1 ring-inset ring-white/40'
                    : 'bg-red-600 text-white'
                  : 'bg-[#18181b] text-[#a1a1aa] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className={btn} onClick={() => setHistory(undo)} disabled={!canUndo(history)} title="Undo (Ctrl/Cmd+Z)">
          Undo
        </button>
        <button type="button" className={btn} onClick={() => setHistory(redo)} disabled={!canRedo(history)} title="Redo (Ctrl/Cmd+Shift+Z)">
          Redo
        </button>
        <button type="button" className={btn} onClick={() => setHistory(clearAll)} disabled={history.present.length === 0}>
          Clear
        </button>
        <div className="ml-auto flex items-center gap-2">
          {onCancel && (
            <button type="button" className={btn} onClick={onCancel}>
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={!loaded || exporting}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold"
          >
            {exporting ? 'Exporting…' : 'Export PNG'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[#27272a] bg-[#0f0f11] p-2 overflow-auto max-h-[65vh]">
        {loaded ? (
          <canvas
            ref={canvasRef}
            width={loaded.size.width}
            height={loaded.size.height}
            tabIndex={0}
            role="img"
            aria-label="Evidence image editor"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            className="block mx-auto max-w-full h-auto cursor-crosshair touch-none select-none"
          />
        ) : (
          <p className="p-6 text-center text-sm text-[#a1a1aa]">Loading image…</p>
        )}
      </div>

      <p className="text-xs text-[#71717a]" role="status">
        {activeTool.hint}. {history.present.length} mark{history.present.length === 1 ? '' : 's'}
        {redactions > 0 ? `, ${redactions} redaction${redactions === 1 ? '' : 's'}` : ''}.
        {' '}Redactions are burned into the exported image and cannot be removed from the saved file.
      </p>
    </div>
  );
}
