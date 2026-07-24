'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface ImageLightboxModalProps {
  imageUrl: string | null;
  imageAlt?: string;
  onClose: () => void;
}

export function ImageLightboxModal({ imageUrl, imageAlt = 'Project File Attachment', onClose }: ImageLightboxModalProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  if (!imageUrl) return null;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  const modalJsx = (
    <div className="fixed inset-0 z-[9999] bg-black/92 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 animate-fadeIn">
      {/* Top Toolbar */}
      <div className="w-full max-w-5xl flex items-center justify-between z-10 pb-2 border-b border-[#27272a]">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-white bg-[#232326] px-3 py-1 rounded-lg border border-[#333338]">
            📷 {imageAlt}
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

      {/* Main Zoomable Image Stage */}
      <div className="flex-1 w-full flex items-center justify-center overflow-auto p-4 relative my-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={imageAlt}
          style={{ transform: `scale(${zoomLevel})` }}
          className="max-h-[78vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl transition-transform duration-200 ease-out border border-[#333338] select-none"
        />
      </div>

      {/* Footer Helper Text */}
      <div className="z-10 pt-2 text-center text-xs text-[#71717a]">
        Use controls above to zoom in, zoom out, or reset view.
      </div>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(modalJsx, document.body) : null;
}
