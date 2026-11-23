import { toast } from 'sonner';

export type ToastNetwork = 'testnet' | 'public';

export interface ToastOptions {
  id?: string | number;
  duration?: number;
  action?: {
    label: string;
    onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  };
}

// Map tracking recent error messages and timestamps to deduplicate within 3 seconds
const recentErrors = new Map<string, number>();
const ERROR_DEDUP_WINDOW_MS = 3000;

export function clearErrorDeduplicationCache(): void {
  recentErrors.clear();
}

/**
 * Standardized Success Toast (Green)
 */
export function showSuccessToast(message: string, description?: string, options?: ToastOptions) {
  return toast.success(message, {
    description,
    duration: options?.duration ?? 4000,
    action: options?.action,
    id: options?.id,
  });
}

/**
 * Standardized Error Toast (Red) with 3-second deduplication
 */
export function showErrorToast(message: string, description?: string, options?: ToastOptions) {
  const now = Date.now();
  const dedupKey = `${message}::${description ?? ''}`;
  const lastShown = recentErrors.get(dedupKey);

  if (lastShown && now - lastShown < ERROR_DEDUP_WINDOW_MS) {
    // Suppress duplicate error toast within window
    return null;
  }

  recentErrors.set(dedupKey, now);

  return toast.error(message, {
    description,
    duration: options?.duration ?? 5000,
    action: options?.action,
    id: options?.id,
  });
}

/**
 * Standardized Info Toast (Blue)
 */
export function showInfoToast(message: string, description?: string, options?: ToastOptions) {
  return toast.info(message, {
    description,
    duration: options?.duration ?? 4000,
    action: options?.action,
    id: options?.id,
  });
}

/**
 * Standardized Loading Toast
 */
export function showLoadingToast(message: string, description?: string, options?: ToastOptions) {
  return toast.loading(message, {
    description,
    duration: options?.duration,
    action: options?.action,
    id: options?.id,
  });
}

/**
 * Stellar Expert Transaction Toast with Direct 'View on Explorer' Action Button
 */
export function showTransactionToast(
  txHash: string,
  network: ToastNetwork = 'testnet',
  message = 'Transaction submitted successfully'
) {
  const explorerUrl = `https://stellar.expert/explorer/${network}/tx/${txHash}`;
  const truncatedHash = `${txHash.slice(0, 8)}...${txHash.slice(-6)}`;

  return toast.success(message, {
    description: `Tx: ${truncatedHash}`,
    duration: 6000,
    action: {
      label: 'View on Explorer',
      onClick: () => {
        if (typeof window !== 'undefined') {
          window.open(explorerUrl, '_blank', 'noopener,noreferrer');
        }
      },
    },
  });
}

/**
 * Dismiss single toast or all active toasts
 */
export function dismissToast(id?: string | number) {
  toast.dismiss(id);
}

export const appToast = {
  success: showSuccessToast,
  error: showErrorToast,
  info: showInfoToast,
  loading: showLoadingToast,
  transaction: showTransactionToast,
  dismiss: dismissToast,
};
