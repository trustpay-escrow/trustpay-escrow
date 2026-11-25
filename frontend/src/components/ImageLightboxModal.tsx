'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { AnnotatedEvidence, EvidenceAnnotationCanvas } from './EvidenceAnnotationCanvas';

export interface ImageLightboxModalProps {
  imageUrl: string | null;
  imageAlt?: string;
  isPdf?: boolean;
  onClose: () => void;
  /**
   * When provided, an "Annotate & Redact" action appears. The sanitized,
   * flattened PNG is handed to this callback; the original is never modified.
   */
  onAnnotatedExport?: (result: AnnotatedEvidence) => void;
}

export function ImageLightboxModal({
  imageUrl,
  imageAlt = 'Evidence Document Attachment',
  isPdf = false,
  onClose,
  onAnnotatedExport,
}: ImageLightboxModalProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [annotating, setAnnotating] = useState(false);

  useEscapeKey(onClose, Boolean(imageUrl));

  if (!imageUrl) return null;

  const isPdfFile = isPdf || imageUrl.toLowerCase().endsWith('.pdf');

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  const modalJsx = (
    <div className="fixed inset-0 z-[9999] bg-black/92 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 animate-fadeIn">
      {/* Top Toolbar */}
      <div className="w-full max-w-5xl flex items-center justify-between z-10 pb-2 border-b border-[#27272a]">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-white bg-[#232326] px-3 py-1 rounded-lg border border-[#333338]">
            {isPdfFile ? '📄 PDF Evidence' : '📷 Image Proof'}: {imageAlt}
          </span>
          <span className="text-xs text-[#a1a1aa] font-mono">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>

        {/* Zoom Controls & Close */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2 bg-[#232326] hover:bg-[#27272a] text-white rounded-xl border border-[#333338] text-xs font-bold transition-all"
            title="Zoom Out (-)"
          >
            🔎 -
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-3 py-2 bg-[#232326] hover:bg-[#27272a] text-white rounded-xl border border-[#333338] text-xs font-bold transition-all"
            title="Reset Zoom"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2 bg-[#232326] hover:bg-[#27272a] text-white rounded-xl border border-[#333338] text-xs font-bold transition-all"
            title="Zoom In (+)"
          >
            🔍 +
          </button>
          {onAnnotatedExport && !annotating && !isPdfFile && (
            <button
              type="button"
              onClick={() => setAnnotating(true)}
              className="px-3 py-2 bg-[#232326] hover:bg-[#27272a] text-white rounded-xl border border-[#333338] text-xs font-bold transition-all"
              title="Highlight defects or black out sensitive details"
            >
              ✏️ Annotate &amp; Redact
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all ml-2"
            title="Close Lightbox"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Main Zoomable Media Stage */}
      <div className="flex-1 w-full flex items-center justify-center overflow-auto p-4 relative my-auto">
        {annotating && onAnnotatedExport && !isPdfFile ? (
          <div className="w-full max-w-5xl">
            <EvidenceAnnotationCanvas
              imageSrc={imageUrl}
              fileName={imageAlt}
              onExport={(result) => {
                onAnnotatedExport(result);
                setAnnotating(false);
              }}
              onCancel={() => setAnnotating(false)}
            />
          </div>
        ) : isPdfFile ? (
          <div
            style={{ transform: `scale(${zoomLevel})` }}
            className="w-full max-w-4xl h-[75vh] bg-[#18181b] rounded-2xl border border-[#333338] shadow-2xl overflow-hidden transition-transform duration-200"
          >
            <iframe
              src={imageUrl}
              title={imageAlt}
              className="w-full h-full border-0"
            />
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={imageAlt}
            style={{ transform: `scale(${zoomLevel})` }}
            className="max-h-[78vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl transition-transform duration-200 ease-out border border-[#333338] select-none"
          />
        )}
      </div>

      {/* Footer Helper Text */}
      <div className="z-10 pt-2 text-center text-xs text-[#71717a]">
        Use controls above to inspect, zoom in/out, or close the document preview.
      </div>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(modalJsx, document.body) : null;
}

export default ImageLightboxModal;
