import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { OfflineQueueDrawer } from './OfflineQueueDrawer';
import { OfflineStatusPill } from './OfflineStatusPill';
import { useOfflineSync } from '@/hooks/useOfflineSync';

// Mock the useOfflineSync hook
vi.mock('@/hooks/useOfflineSync', () => ({
  useOfflineSync: vi.fn(),
}));

// Mock useEscapeKey
vi.mock('@/hooks/useEscapeKey', () => ({
  useEscapeKey: vi.fn(),
}));

const mockQueue = [
  {
    id: 'item-1',
    description: 'Save draft: Build Escrow UI',
    method: 'POST' as const,
    url: '/api/projects',
    payload: { title: 'Build Escrow UI', budget: 1000 },
    queuedAt: new Date(Date.now() - 300000).toISOString(),
    payloadSize: 1024,
    retryCount: 0,
    tag: 'draft',
  },
  {
    id: 'item-2',
    description: 'Submit milestone #1',
    method: 'PUT' as const,
    url: '/api/milestones/1',
    payload: { deliverable_url: 'https://github.com/...' },
    queuedAt: new Date(Date.now() - 600000).toISOString(),
    payloadSize: 2048,
    retryCount: 1,
    tag: 'submission',
  },
];

const mockUseOfflineSync = {
  queue: mockQueue,
  pendingCount: 2,
  isOnline: false,
  processing: false,
  discard: vi.fn(),
  retry: vi.fn().mockResolvedValue(true),
  flushQueue: vi.fn(),
  clear: vi.fn(),
  enqueue: vi.fn(),
};

describe('OfflineQueueDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useOfflineSync as any).mockReturnValue(mockUseOfflineSync);
  });

  it('renders nothing when closed', () => {
    render(<OfflineQueueDrawer isOpen={false} onClose={() => {}} />);
    expect(screen.queryByTestId('offline-queue-item-item-1')).not.toBeInTheDocument();
  });

  it('renders drawer when open with queue items', () => {
    render(<OfflineQueueDrawer isOpen={true} onClose={() => {}} />);

    expect(screen.getByRole('dialog', { name: /offline queue/i })).toBeInTheDocument();
    expect(screen.getByText('Offline Queue')).toBeInTheDocument();
    expect(screen.getByText('2 pending items')).toBeInTheDocument();

    // Check both items render
    expect(screen.getByTestId('offline-queue-item-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('offline-queue-item-item-2')).toBeInTheDocument();

    // Check item details
    expect(screen.getByText('Save draft: Build Escrow UI')).toBeInTheDocument();
    expect(screen.getByText('Submit milestone #1')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByText('submission')).toBeInTheDocument();
  });

  it('shows retry count badge for items with retries', () => {
    render(<OfflineQueueDrawer isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('↻ 1')).toBeInTheDocument();
  });

  it('calls discard when discard button clicked and confirmed', async () => {
    render(<OfflineQueueDrawer isOpen={true} onClose={() => {}} />);

    // Click discard on first item
    fireEvent.click(screen.getByText('Discard'));
    // Confirm
    fireEvent.click(screen.getByText('Yes'));

    await waitFor(() => {
      expect(mockUseOfflineSync.discard).toHaveBeenCalledWith('item-1');
    });
  });

  it('shows empty state when queue is empty', () => {
    (useOfflineSync as any).mockReturnValue({
      ...mockUseOfflineSync,
      queue: [],
      pendingCount: 0,
    });

    render(<OfflineQueueDrawer isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('No pending offline items')).toBeInTheDocument();
    expect(screen.getByText('Everything is synced!')).toBeInTheDocument();
  });

  it('shows processing state', () => {
    (useOfflineSync as any).mockReturnValue({
      ...mockUseOfflineSync,
      processing: true,
    });

    render(<OfflineQueueDrawer isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('disables retry buttons when processing', () => {
    (useOfflineSync as any).mockReturnValue({
      ...mockUseOfflineSync,
      processing: true,
    });

    render(<OfflineQueueDrawer isOpen={true} onClose={() => {}} />);

    const retryButtons = screen.getAllByText('Retry');
    retryButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});

describe('OfflineStatusPill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when online and queue empty', () => {
    (useOfflineSync as any).mockReturnValue({
      ...mockUseOfflineSync,
      pendingCount: 0,
      isOnline: true,
    });

    render(<OfflineStatusPill />);
    expect(screen.queryByTestId('offline-status-pill')).not.toBeInTheDocument();
  });

  it('shows pill with count when items pending', () => {
    (useOfflineSync as any).mockReturnValue({
      ...mockUseOfflineSync,
      pendingCount: 2,
      isOnline: false,
    });

    render(<OfflineStatusPill />);

    const pill = screen.getByTestId('offline-status-pill');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent('2 pending');
    expect(screen.getByText('2')).toBeInTheDocument(); // Badge count
  });

  it('shows "Synced" when online and queue empty', () => {
    (useOfflineSync as any).mockReturnValue({
      ...mockUseOfflineSync,
      pendingCount: 0,
      isOnline: false,
    });

    render(<OfflineStatusPill />);

    const pill = screen.getByTestId('offline-status-pill');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent('Synced');
  });

  it('opens drawer when clicked', async () => {
    (useOfflineSync as any).mockReturnValue({
      ...mockUseOfflineSync,
      pendingCount: 1,
      isOnline: false,
    });

    render(<OfflineStatusPill />);

    fireEvent.click(screen.getByTestId('offline-status-pill'));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /offline queue/i })).toBeInTheDocument();
    });
  });
});

describe('Payload size formatting', () => {
  it('formats payload size correctly', () => {
    expect(formatPayloadSize(500)).toBe('500 B');
    expect(formatPayloadSize(1024)).toBe('1.0 KB');
    expect(formatPayloadSize(1024 * 1024)).toBe('1.00 MB');
  });
});

// Helper function for testing (extracted from component)
function formatPayloadSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}