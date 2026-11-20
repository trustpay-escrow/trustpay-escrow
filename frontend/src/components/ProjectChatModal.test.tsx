import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectChatModal } from './ProjectChatModal';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api', () => ({
  authFetch: vi.fn(async () => ({ ok: true, json: async () => ({ messages: [] }) })),
}));

class FakeEventSource {
  addEventListener = vi.fn();
  close = vi.fn();
  onerror: (() => void) | null = null;
}

const baseProps = {
  projectId: 'project-1',
  projectTitle: 'Soroban Escrow Frontend',
  senderAddress: 'GSENDERADDRESS000000000000000000000000000000000000000000',
  receiverAddress: 'GRECEIVERADDRESS0000000000000000000000000000000000000000',
};

describe('ProjectChatModal Escape key', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', FakeEventSource);
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls onClose once when Escape is pressed', async () => {
    const onClose = vi.fn();
    render(<ProjectChatModal isOpen onClose={onClose} {...baseProps} />);
    await waitFor(() => expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the chat open when Escape is pressed inside the message box', async () => {
    const onClose = vi.fn();
    render(<ProjectChatModal isOpen onClose={onClose} {...baseProps} />);
    const input = await screen.findByPlaceholderText('Type a message...');
    input.focus();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores Escape while closed', () => {
    const onClose = vi.fn();
    render(<ProjectChatModal isOpen={false} onClose={onClose} {...baseProps} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
