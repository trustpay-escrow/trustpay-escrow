import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MilestoneSubmitModal } from './MilestoneSubmitModal';
import type { Milestone, Project } from '@/types';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from 'sonner';

const project: Project = {
  id: 'project-1',
  title: 'Soroban Escrow Frontend',
  description: 'Build milestone escrow UI',
  category: 'Development',
  budget: 2500,
  status: 'in_progress',
  token: 'USDC',
  project_id_onchain: 7,
};

const milestone: Milestone = {
  id: 'milestone-1',
  project_id: 'project-1',
  milestone_index: 0,
  title: 'Interactive Globe',
  amount: 1000,
  status: 'pending',
};

describe('MilestoneSubmitModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the markdown editor and a drag-and-drop attachment area', () => {
    render(<MilestoneSubmitModal isOpen onClose={vi.fn()} project={project} milestone={milestone} />);

    expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
    expect(screen.getByTestId('deliverable-dropzone')).toBeInTheDocument();
    expect(screen.getByTestId('submit-deliverable')).toBeInTheDocument();
  });

  it('calls onClose once when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<MilestoneSubmitModal isOpen onClose={onClose} project={project} milestone={milestone} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid GitHub PR links before adding them', async () => {
    render(<MilestoneSubmitModal isOpen onClose={vi.fn()} project={project} milestone={milestone} />);
    const input = screen.getByTestId('pr-url-input');

    fireEvent.change(input, { target: { value: 'https://github.com/owner/repo/issues/12' } });
    fireEvent.click(screen.getByTestId('add-pr-link'));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByTestId('pr-link-list')).not.toBeInTheDocument();
  });

  it('adds a valid PR link and reports its GitHub accessibility status', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ number: 130, state: 'open', title: 'Add globe visualizer' }),
    } as Response);

    render(<MilestoneSubmitModal isOpen onClose={vi.fn()} project={project} milestone={milestone} />);
    fireEvent.change(screen.getByTestId('pr-url-input'), {
      target: { value: 'https://github.com/owner/repo/pull/130' },
    });
    fireEvent.click(screen.getByTestId('add-pr-link'));

    expect(await screen.findByText('Verified')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/pulls/130',
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });
});
