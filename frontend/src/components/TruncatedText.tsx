'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface TruncatedTextProps {
  text: string;
  lines?: number;
  className?: string;
  moreText?: string;
  lessText?: string;
}

export function TruncatedText({
  text,
  lines = 3,
  className = '',
  moreText = 'Read More',
  lessText = 'Show Less',
}: TruncatedTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [canOverflow, setCanOverflow] = useState(false);
  const textRef = useRef<HTMLDivElement | null>(null);

  // Determine whether text likely overflows based on length/newlines or DOM dimensions
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;

    // Check DOM overflow if available (browser)
    const domOverflow = el.scrollHeight > el.clientHeight;
    // Fallback heuristic for SSR / JSDOM where scrollHeight may equal clientHeight
    const lineCount = (text || '').split('\n').length;
    const charEstimate = (text || '').length > lines * 60;
    const heuristicOverflow = lineCount > lines || charEstimate;

    setCanOverflow(domOverflow || heuristicOverflow);
  }, [text, lines]);

  const lineClampClass = lines === 2 ? 'line-clamp-2' : lines === 4 ? 'line-clamp-4' : 'line-clamp-3';

  return (
    <div className={`text-zinc-300 ${className}`}>
      <div
        ref={textRef}
        data-testid="truncated-text-content"
        className={`whitespace-pre-line transition-all duration-200 ${
          !isExpanded ? `${lineClampClass} overflow-hidden` : ''
        }`}
      >
        {text}
      </div>
      {canOverflow && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="mt-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 focus:outline-none transition-colors"
          data-testid="truncate-toggle-btn"
          aria-expanded={isExpanded}
        >
          {isExpanded ? lessText : moreText}
        </button>
      )}
    </div>
  );
}
