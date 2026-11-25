import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./EvidenceAnnotationCanvas', () => ({
  EvidenceAnnotationCanvas: ({
    imageSrc,
    fileName,
    onExport,
    onCancel,
  }: {
    imageSrc: string;
    fileName: string;
    onExport: (r: { blob: Blob; filename: string }) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="editor" data-src={imageSrc} data-name={fileName}>
      <button onClick={() => onExport({ blob: new Blob(['x'.repeat(2048)], { type: 'image/png' }), filename: 'evidence-shot-annotated.png' })}>
        mock export
      </button>
      <button onClick={onCancel}>mock cancel</button>
    </div>
  ),
}));

import { toast } from 'sonner';
import { DisputeEvidenceAttachments, MAX_EVIDENCE_FILES, MAX_EVIDENCE_SOURCE_BYTES } from './DisputeEvidenceAttachments';

const file = (name = 'shot.png', type = 'image/png', size = 1024) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

const choose = (f: File) =>
  fireEvent.change(screen.getByLabelText('Choose evidence screenshot'), { target: { files: [f] } });

describe('DisputeEvidenceAttachments', () => {
  let created: string[];
  let revoked: string[];

  beforeEach(() => {
    created = [];
    revoked = [];
    let n = 0;
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn(() => {
          const u = `blob:mock-${++n}`;
          created.push(u);
          return u;
        }),
        revokeObjectURL: vi.fn((u: string) => revoked.push(u)),
      })
    );
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts empty and is upfront that upload is not connected', () => {
    render(<DisputeEvidenceAttachments />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText(/Automatic upload to the arbiter is not connected yet/)).toBeInTheDocument();
  });

  it('rejects non-image files and oversized images before opening the editor', () => {
    render(<DisputeEvidenceAttachments />);

    choose(file('notes.pdf', 'application/pdf'));
    expect(toast.error).toHaveBeenLastCalledWith(expect.stringContaining('PNG, JPEG or WebP'));

    choose(file('huge.png', 'image/png', MAX_EVIDENCE_SOURCE_BYTES + 1));
    expect(toast.error).toHaveBeenLastCalledWith(expect.stringContaining('10 MB'));

    expect(screen.queryByTestId('editor')).not.toBeInTheDocument();
    expect(created).toHaveLength(0);
  });

  it('opens the editor on the chosen screenshot', () => {
    render(<DisputeEvidenceAttachments />);
    choose(file('Login Screen.png'));

    const editor = screen.getByTestId('editor');
    expect(editor).toHaveAttribute('data-src', created[0]);
    expect(editor).toHaveAttribute('data-name', 'Login Screen.png');
    expect(screen.getByRole('dialog', { name: 'Annotate evidence' })).toBeInTheDocument();
  });

  it('adds the sanitized export to the list and frees the original image', () => {
    const onChange = vi.fn();
    render(<DisputeEvidenceAttachments onChange={onChange} />);
    choose(file());
    const sourceUrl = created[0];

    fireEvent.click(screen.getByRole('button', { name: 'mock export' }));

    const list = screen.getByRole('list', { name: 'Prepared evidence' });
    expect(within(list).getByText('evidence-shot-annotated.png')).toBeInTheDocument();
    expect(within(list).getByText('2 KB · sanitized PNG')).toBeInTheDocument();
    expect(within(list).getByRole('img', { name: 'evidence-shot-annotated.png' })).toHaveAttribute('src', created[1]);
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument();
    expect(revoked).toContain(sourceUrl); // the unredacted original is released
    expect(revoked).not.toContain(created[1]); // the sanitized preview stays alive
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ filename: 'evidence-shot-annotated.png' })]);
    expect(toast.success).toHaveBeenCalled();
  });

  it('removes an item, releasing its preview and notifying the parent', () => {
    const onChange = vi.fn();
    render(<DisputeEvidenceAttachments onChange={onChange} />);
    choose(file());
    fireEvent.click(screen.getByRole('button', { name: 'mock export' }));

    fireEvent.click(screen.getByRole('button', { name: 'Remove evidence-shot-annotated.png' }));

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(revoked).toContain(created[1]);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('downloads the sanitized PNG under its own name', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<DisputeEvidenceAttachments />);
    choose(file());
    fireEvent.click(screen.getByRole('button', { name: 'mock export' }));

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(click).toHaveBeenCalledTimes(1);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('evidence-shot-annotated.png');
  });

  it('caps the number of attached images', () => {
    render(<DisputeEvidenceAttachments />);
    for (let i = 0; i < MAX_EVIDENCE_FILES; i++) {
      choose(file(`s${i}.png`));
      fireEvent.click(screen.getByRole('button', { name: 'mock export' }));
    }
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(MAX_EVIDENCE_FILES);

    choose(file('one-too-many.png'));
    expect(toast.error).toHaveBeenLastCalledWith(expect.stringContaining(`up to ${MAX_EVIDENCE_FILES}`));
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument();
  });

  it('closing the editor (Cancel, Escape or backdrop) discards the original without adding anything', () => {
    render(<DisputeEvidenceAttachments />);

    choose(file());
    fireEvent.click(screen.getByRole('button', { name: 'mock cancel' }));
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument();
    expect(revoked).toContain(created[0]);

    choose(file());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument();
    expect(revoked).toContain(created[1]);

    choose(file());
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument();
    expect(revoked).toContain(created[2]);

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('does not close when clicking inside the editor dialog', () => {
    render(<DisputeEvidenceAttachments />);
    choose(file());
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.getByTestId('editor')).toBeInTheDocument();
  });

  it('releases every preview URL on unmount', () => {
    const { unmount } = render(<DisputeEvidenceAttachments />);
    choose(file());
    fireEvent.click(screen.getByRole('button', { name: 'mock export' }));
    const preview = created[1];
    expect(revoked).not.toContain(preview);

    unmount();
    expect(revoked).toContain(preview);
  });
});
