import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface UseUnsavedChangesWarningOptions {
  isDirty: boolean;
  message?: string;
  onDiscard?: () => void;
}

export function useUnsavedChangesWarning({
  isDirty,
  message = 'You have unsaved changes. Are you sure you want to discard them and leave this page?',
  onDiscard,
}: UseUnsavedChangesWarningOptions) {
  const router = useRouter();
  const [showPrompt, setShowPrompt] = useState(false);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);

  // 1. Browser tab close / reload protection via beforeunload
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, message]);

  // 2. Intercept internal link clicks when form is dirty
  useEffect(() => {
    if (!isDirty) return;

    const handleAnchorClick = (e: MouseEvent) => {
      // Find closest anchor tag
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      // Ignore anchors with hash only, external target, or mailto/tel
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        anchor.target === '_blank'
      ) {
        return;
      }

      // Check if it is an internal route
      const isInternal =
        href.startsWith('/') ||
        (anchor.origin && anchor.origin === window.location.origin);

      if (isInternal) {
        e.preventDefault();
        e.stopPropagation();
        setTargetUrl(href);
        setShowPrompt(true);
      }
    };

    document.addEventListener('click', handleAnchorClick, true);
    return () => {
      document.removeEventListener('click', handleAnchorClick, true);
    };
  }, [isDirty]);

  const confirmNavigation = useCallback(() => {
    setShowPrompt(false);
    if (onDiscard) {
      onDiscard();
    }
    if (targetUrl) {
      router.push(targetUrl);
    }
  }, [onDiscard, targetUrl, router]);

  const cancelNavigation = useCallback(() => {
    setShowPrompt(false);
    setTargetUrl(null);
  }, []);

  return {
    showPrompt,
    targetUrl,
    confirmNavigation,
    cancelNavigation,
  };
}
