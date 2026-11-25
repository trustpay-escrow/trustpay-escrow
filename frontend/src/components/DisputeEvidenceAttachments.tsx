'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { downloadBlob } from '@/lib/share-card';
import { AnnotatedEvidence, EvidenceAnnotationCanvas } from './EvidenceAnnotationCanvas';

export const MAX_EVIDENCE_FILES = 5;
export const MAX_EVIDENCE_SOURCE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export interface PreparedEvidence {
  id: string;
  filename: string;
  blob: Blob;
  previewUrl: string;
}

export interface DisputeEvidenceAttachmentsProps {
  /** Called whenever the set of sanitized images changes (e.g. to upload them). */
  onChange?: (items: PreparedEvidence[]) => void;
}

const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/**
 * Pick a screenshot, mark up defects and black out secrets in the in-browser
 * editor, and keep only the flattened, sanitized PNG. The original file is
 * never stored or sent anywhere by this component.
 */
export function DisputeEvidenceAttachments({ onChange }: DisputeEvidenceAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<PreparedEvidence[]>([]);
  const [items, setItems] = useState<PreparedEvidence[]>([]);
  const [editing, setEditing] = useState<{ file: File; url: string } | null>(null);

  const update = useCallback(
    (next: PreparedEvidence[]) => {
      itemsRef.current = next;
      setItems(next);
      onChange?.(next);
    },
    [onChange]
  );

  const closeEditor = useCallback(() => {
    setEditing((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  // Release every object URL when the component goes away.
  useEffect(
    () => () => {
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    },
    []
  );

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEditor();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, closeEditor]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (itemsRef.current.length >= MAX_EVIDENCE_FILES) {
      toast.error(`You can attach up to ${MAX_EVIDENCE_FILES} evidence images.`);
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Evidence must be a PNG, JPEG or WebP screenshot.');
      return;
    }
    if (file.size > MAX_EVIDENCE_SOURCE_BYTES) {
      toast.error(`That image is larger than ${MAX_EVIDENCE_SOURCE_BYTES / 1024 / 1024} MB.`);
      return;
    }
    setEditing({ file, url: URL.createObjectURL(file) });
  };

  const handleExport = ({ blob, filename }: AnnotatedEvidence) => {
    const item: PreparedEvidence = {
      id: `${Date.now()}-${itemsRef.current.length}`,
      filename,
      blob,
      previewUrl: URL.createObjectURL(blob),
    };
    update([...itemsRef.current, item]);
    closeEditor();
    toast.success('Sanitized evidence image added');
  };

  const remove = (id: string) => {
    const target = itemsRef.current.find((i) => i.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    update(itemsRef.current.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-slate-300 font-semibold">Evidence screenshots</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Highlight defects and black out passwords or API keys before you share anything.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold"
        >
          Add screenshot
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFile}
          aria-label="Choose evidence screenshot"
          className="hidden"
        />
      </div>

      {items.length > 0 && (
        <ul className="space-y-2" aria-label="Prepared evidence">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.previewUrl} alt={item.filename} className="h-12 w-16 rounded object-cover border border-slate-800" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-slate-200">{item.filename}</p>
                <p className="text-[11px] text-slate-500">{formatSize(item.blob.size)} · sanitized PNG</p>
              </div>
              <button
                type="button"
                onClick={() => downloadBlob(item.blob, item.filename)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Download
              </button>
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label={`Remove ${item.filename}`}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-slate-500">
        Sanitized copies are prepared on this device only. Automatic upload to the arbiter is not connected yet, so
        download them to share.
      </p>

      {editing && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md"
          onClick={closeEditor}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Annotate evidence"
            className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 sm:p-5 w-full max-w-5xl max-h-[95vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white mb-3">Annotate &amp; redact evidence</h3>
            <EvidenceAnnotationCanvas
              imageSrc={editing.url}
              fileName={editing.file.name}
              onExport={handleExport}
              onCancel={closeEditor}
            />
          </div>
        </div>
      )}
    </div>
  );
}
