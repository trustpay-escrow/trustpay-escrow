import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import {
  showSuccessToast,
  showErrorToast,
  showInfoToast,
  showLoadingToast,
  showTransactionToast,
  dismissToast,
  clearErrorDeduplicationCache,
} from './toast';

// Mock sonner module
vi.mock('sonner', () => {
  return {
    toast: {
      success: vi.fn().mockImplementation((msg, opts) => `success-${msg}`),
      error: vi.fn().mockImplementation((msg, opts) => `error-${msg}`),
      info: vi.fn().mockImplementation((msg, opts) => `info-${msg}`),
      loading: vi.fn().mockImplementation((msg, opts) => `loading-${msg}`),
      dismiss: vi.fn(),
    },
  };
});

describe('Toast Queue Manager Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearErrorDeduplicationCache();
  });

  it('triggers toast.success with standardized options', () => {
    showSuccessToast('Project created', 'Your escrow has been initialized.');
    expect(toast.success).toHaveBeenCalledWith(
      'Project created',
      expect.objectContaining({
        description: 'Your escrow has been initialized.',
        duration: 4000,
      })
    );
  });

  it('triggers toast.info and toast.loading properly', () => {
    showInfoToast('New Notification', 'You have received a milestone update.');
    expect(toast.info).toHaveBeenCalledWith(
      'New Notification',
      expect.objectContaining({
        description: 'You have received a milestone update.',
      })
    );

    showLoadingToast('Deploying contract...');
    expect(toast.loading).toHaveBeenCalledWith('Deploying contract...', expect.any(Object));
  });

  it('triggers toast.error and deduplicates identical errors within 3 seconds', () => {
    const res1 = showErrorToast('Network timeout', 'Could not reach RPC server.');
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(res1).toBe('error-Network timeout');

    // Immediate duplicate should be suppressed
    const res2 = showErrorToast('Network timeout', 'Could not reach RPC server.');
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(res2).toBeNull();

    // Different error is allowed immediately
    const res3 = showErrorToast('Insufficient balance');
    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(res3).toBe('error-Insufficient balance');
  });

  it('creates transaction toast with direct Stellar Expert explorer link and action button', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const txHash = 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0';

    showTransactionToast(txHash, 'testnet', 'Milestone completed');

    expect(toast.success).toHaveBeenCalledWith(
      'Milestone completed',
      expect.objectContaining({
        description: expect.stringContaining('Tx: a1b2c3d4...'),
        action: expect.objectContaining({
          label: 'View on Explorer',
          onClick: expect.any(Function),
        }),
      })
    );

    // Call the action button callback
    const calls = vi.mocked(toast.success).mock.calls;
    const actionCallback = (calls[0][1] as any)?.action?.onClick;
    expect(actionCallback).toBeDefined();

    actionCallback();
    expect(openSpy).toHaveBeenCalledWith(
      `https://stellar.expert/explorer/testnet/tx/${txHash}`,
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('calls toast.dismiss on dismissToast', () => {
    dismissToast('test-id-123');
    expect(toast.dismiss).toHaveBeenCalledWith('test-id-123');
  });
});
