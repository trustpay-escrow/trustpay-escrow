'use client';

import React, { useRef, type RefObject } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export interface AccessibleModalProps {
  isOpen: boolean;
  onClose?: () => void;
  role?: 'dialog' | 'alertdialog';
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  closeOnBackdropClick?: boolean;
  backdropClassName?: string;
  dialogClassName?: string;
  children: React.ReactNode;
}

/**
 * Shared WCAG 2.1 AA modal dialog shell providing `role="dialog"`, `aria-modal="true"`,
 * Tab/Shift+Tab focus trapping, LIFO Escape handling, pointer-origin backdrop dismissal,
 * and automatic focus restoration to the triggering element on close.
 */
export function AccessibleModal({
  isOpen,
  onClose,
  role = 'dialog',
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  initialFocusRef,
  returnFocusRef,
  closeOnBackdropClick = true,
  backdropClassName = 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4',
  dialogClassName = '',
  children,
}: AccessibleModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const pointerStartedInsideRef = useRef(false);

  useFocusTrap(dialogRef, {
    isOpen,
    onClose,
    initialFocusRef,
    returnFocusRef,
  });

  if (!isOpen) return null;

  return (
    <div
      className={backdropClassName}
      onMouseDown={(event) => {
        pointerStartedInsideRef.current = event.target !== event.currentTarget;
      }}
      onClick={(event) => {
        if (
          closeOnBackdropClick &&
          !pointerStartedInsideRef.current &&
          event.target === event.currentTarget
        ) {
          onClose?.();
        }
        pointerStartedInsideRef.current = false;
      }}
    >
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        className={`focus:outline-none ${dialogClassName}`.trim()}
      >
        {children}
      </div>
    </div>
  );
}
