'use client';

import React, { useMemo, useState } from 'react';

export interface FileChange {
  name: string;
  status: 'added' | 'modified' | 'removed';
}

interface DiffLine {
  type: 'context' | 'add' | 'remove';
  oldNo?: number;
  newNo?: number;
  text: string;
}

/** Minimal LCS-based line diff (no external dependency). */
function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  const n = a.length;
  const m = b.length;

  // LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: { type: 'context' | 'add' | 'remove'; a?: number; b?: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'context', a: i, b: j });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'remove', a: i });
      i++;
    } else {
      ops.push({ type: 'add', b: j });
      j++;
    }
  }
  while (i < n) ops.push({ type: 'remove', a: i++ });
  while (j < m) ops.push({ type: 'add', b: j++ });

  return ops.map((op) => ({
    type: op.type,
    oldNo: op.a !== undefined ? op.a + 1 : undefined,
    newNo: op.b !== undefined ? op.b + 1 : undefined,
    text: op.type === 'remove' ? a[op.a!] : op.type === 'add' ? b[op.b!] : a[op.a!],
  }));
}

export interface DeliverableDiffViewerProps {
  previousText?: string;
  currentText: string;
  previousLabel?: string;
  currentLabel?: string;
  fileChanges?: FileChange[];
}

const STATUS_STYLES: Record<FileChange['status'], string> = {
  added: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  modified: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  removed: 'bg-red-500/10 text-red-400 border-red-500/30',
};

export function DeliverableDiffViewer({
  previousText = '',
  currentText,
  previousLabel = 'Previous revision',
  currentLabel = 'Latest revision',
  fileChanges = [],
}: DeliverableDiffViewerProps) {
  const [view, setView] = useState<'split' | 'unified'>('split');
  const lines = useMemo(() => computeLineDiff(previousText, currentText), [previousText, currentText]);

  const rowClass = (type: DiffLine['type']) =>
    type === 'add'
      ? 'bg-emerald-500/10'
      : type === 'remove'
        ? 'bg-red-500/10'
        : 'bg-transparent';
  const marker = (type: DiffLine['type']) => (type === 'add' ? '+' : type === 'remove' ? '−' : ' ');
  const markerClass = (type: DiffLine['type']) =>
    type === 'add' ? 'text-emerald-400' : type === 'remove' ? 'text-red-400' : 'text-[#52525b]';

  return (
    <div className="rounded-xl border border-[#27272a] bg-[#141417] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#27272a] bg-[#1c1c20]">
        <div className="flex items-center gap-2 text-[11px] font-bold text-[#e4e4e7]">
          <span className="text-emerald-400">{currentLabel}</span>
          <span className="text-[#52525b]">vs</span>
          <span className="text-[#a1a1aa]">{previousLabel}</span>
        </div>
        <div className="flex rounded-lg border border-[#333338] overflow-hidden">
          {(['split', 'unified'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-2.5 py-1 text-[10px] font-bold capitalize transition-colors ${
                view === v ? 'bg-indigo-600 text-white' : 'bg-[#232326] text-[#a1a1aa] hover:text-white'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {fileChanges.length > 0 && (
        <div className="px-3 py-2 border-b border-[#27272a] flex flex-wrap gap-1.5">
          {fileChanges.map((file) => (
            <span
              key={file.name}
              className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${STATUS_STYLES[file.status]}`}
              title={`${file.status}: ${file.name}`}
            >
              {file.status === 'added' ? '+' : file.status === 'removed' ? '−' : '~'} {file.name}
            </span>
          ))}
        </div>
      )}

      {previousText === currentText ? (
        <p className="px-4 py-6 text-center text-xs text-[#71717a]">No textual changes between revisions.</p>
      ) : view === 'unified' ? (
        <pre className="overflow-x-auto text-[11px] leading-5 font-mono">
          {lines.map((line, idx) => (
            <div key={idx} className={`flex ${rowClass(line.type)}`}>
              <span className="w-10 shrink-0 text-right pr-2 text-[#52525b] select-none">
                {line.oldNo ?? line.newNo ?? ''}
              </span>
              <span className={`w-4 shrink-0 select-none ${markerClass(line.type)}`}>{marker(line.type)}</span>
              <span className="whitespace-pre text-[#d4d4d8]">{line.text || ' '}</span>
            </div>
          ))}
        </pre>
      ) : (
        <div className="overflow-x-auto text-[11px] leading-5 font-mono">
          {lines.map((line, idx) =>
            line.type === 'context' ? (
              <div key={idx} className="flex">
                <div className="flex-1 flex bg-transparent">
                  <span className="w-10 shrink-0 text-right pr-2 text-[#52525b] select-none">{line.oldNo}</span>
                  <span className="w-4 shrink-0 select-none text-[#52525b]"> </span>
                  <span className="whitespace-pre text-[#d4d4d8]">{line.text || ' '}</span>
                </div>
                <div className="flex-1 flex bg-transparent border-l border-[#27272a]">
                  <span className="w-10 shrink-0 text-right pr-2 text-[#52525b] select-none">{line.newNo}</span>
                  <span className="w-4 shrink-0 select-none text-[#52525b]"> </span>
                  <span className="whitespace-pre text-[#d4d4d8]">{line.text || ' '}</span>
                </div>
              </div>
            ) : line.type === 'remove' ? (
              <div key={idx} className="flex">
                <div className={`flex-1 flex ${rowClass('remove')}`}>
                  <span className="w-10 shrink-0 text-right pr-2 text-[#52525b] select-none">{line.oldNo}</span>
                  <span className={`w-4 shrink-0 select-none ${markerClass('remove')}`}>−</span>
                  <span className="whitespace-pre text-[#fca5a5]">{line.text || ' '}</span>
                </div>
                <div className="flex-1 bg-[#141417] border-l border-[#27272a]" />
              </div>
            ) : (
              <div key={idx} className="flex">
                <div className="flex-1 bg-[#141417]" />
                <div className={`flex-1 flex ${rowClass('add')} border-l border-[#27272a]`}>
                  <span className="w-10 shrink-0 text-right pr-2 text-[#52525b] select-none">{line.newNo}</span>
                  <span className={`w-4 shrink-0 select-none ${markerClass('add')}`}>+</span>
                  <span className="whitespace-pre text-[#86efac]">{line.text || ' '}</span>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
