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

  it('preserves nested folder paths and offers downloads for non-image files', async () => {
    const createUrl = vi.fn(() => 'blob:deliverable');
    const revokeUrl = vi.fn();
    const NativeUrl = URL;
    vi.stubGlobal('URL', class extends NativeUrl {
      static createObjectURL = createUrl;
      static revokeObjectURL = revokeUrl;
    });
    const file = new File(['hello'], 'main.ts', { type: 'text/plain' });
    Object.defineProperty(file, 'webkitRelativePath', { value: 'deliverable/src/main.ts' });

    const { unmount } = render(<MilestoneSubmitModal isOpen onClose={vi.fn()} project={project} milestone={milestone} />);
    fireEvent.change(screen.getByLabelText('Browse Folder'), { target: { files: [file] } });
    expect(screen.getByTestId('folder-toggle-deliverable/src')).toHaveAttribute('aria-expanded', 'true');
    const download = screen.getByTestId('download-button-deliverable/src/main.ts');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe('blob:deliverable');
      expect(this.download).toBe('main.ts');
    });
    fireEvent.click(download);
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
    await screen.findByText('Ready');
    unmount();
    expect(revokeUrl).toHaveBeenCalledWith('blob:deliverable');
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

  it('disables submit button by default until notes meet schema requirement and shows real-time error', () => {
    render(<MilestoneSubmitModal isOpen onClose={vi.fn()} project={project} milestone={milestone} />);
    const submitBtn = screen.getByTestId('submit-deliverable');
    expect(submitBtn).toBeDisabled();

    // Type invalid short notes into markdown editor textarea
    const textarea = screen.getByTestId('markdown-editor');
    fireEvent.change(textarea, { target: { value: 'Short text' } });

    expect(screen.getByTestId('notes-validation-error')).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();

    // Type notes with >= 20 characters
    fireEvent.change(textarea, {
      target: { value: 'This is a comprehensive summary of milestone deliverables.' },
    });
    expect(screen.queryByTestId('notes-validation-error')).not.toBeInTheDocument();
    expect(submitBtn).not.toBeDisabled();
  });

  it('displays real-time inline validation error for invalid PR URL', () => {
    render(<MilestoneSubmitModal isOpen onClose={vi.fn()} project={project} milestone={milestone} />);
    const input = screen.getByTestId('pr-url-input');

    fireEvent.change(input, { target: { value: 'not-a-valid-pr-link' } });
    expect(screen.getByTestId('pr-url-error')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'https://github.com/owner/repo/pull/42' } });
    expect(screen.queryByTestId('pr-url-error')).not.toBeInTheDocument();
  });
});
