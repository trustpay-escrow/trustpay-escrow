'use client';

import React from 'react';

export interface UnsavedChangesModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
}

export function UnsavedChangesModal({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Unsaved Changes',
  message = 'You have unsaved changes in your form. If you leave now, your changes will be discarded.',
}: UnsavedChangesModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-modal-title"
      data-testid="unsaved-changes-dialog"
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-[#18181b] border border-[#3f3f46] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 text-xl font-bold">
            ⚠️
          </div>
          <div className="space-y-1">
            <h3 id="unsaved-modal-title" className="text-lg font-bold text-white">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-[#27272a]">
          <button
            type="button"
            onClick={onCancel}
            data-testid="unsaved-modal-cancel"
            className="flex-1 py-2.5 px-4 bg-[#27272a] hover:bg-[#3f3f46] text-white font-semibold text-xs rounded-xl border border-[#3f3f46] transition-all cursor-pointer"
          >
            Stay on Page
          </button>
          <button
            type="button"
            onClick={onConfirm}
            data-testid="unsaved-modal-confirm"
            className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-red-600/20 transition-all cursor-pointer"
          >
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default UnsavedChangesModal;
