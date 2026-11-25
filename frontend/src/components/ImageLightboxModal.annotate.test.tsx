import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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
      <button onClick={() => onExport({ blob: new Blob(['png']), filename: 'evidence-a-annotated.png' })}>mock export</button>
      <button onClick={onCancel}>mock cancel</button>
    </div>
  ),
}));

import { ImageLightboxModal } from './ImageLightboxModal';

const URL_ = 'https://example.com/shot.png';

describe('ImageLightboxModal annotate mode', () => {
  it('does not offer annotation unless the caller opts in', () => {
    render(<ImageLightboxModal imageUrl={URL_} onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: /Annotate/ })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Evidence Document Attachment' })).toBeInTheDocument();
  });

  it('swaps the image for the editor, seeded with the image and its name', () => {
    render(<ImageLightboxModal imageUrl={URL_} imageAlt="login.png" onClose={() => {}} onAnnotatedExport={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Annotate & Redact/ }));

    const editor = screen.getByTestId('editor');
    expect(editor).toHaveAttribute('data-src', URL_);
    expect(editor).toHaveAttribute('data-name', 'login.png');
    expect(screen.queryByRole('img', { name: 'login.png' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Annotate & Redact/ })).not.toBeInTheDocument(); // no nested editors
  });

  it('hands the sanitized export to the caller and returns to the image view', () => {
    const onAnnotatedExport = vi.fn();
    render(<ImageLightboxModal imageUrl={URL_} imageAlt="login.png" onClose={() => {}} onAnnotatedExport={onAnnotatedExport} />);
    fireEvent.click(screen.getByRole('button', { name: /Annotate & Redact/ }));
    fireEvent.click(screen.getByRole('button', { name: 'mock export' }));

    expect(onAnnotatedExport).toHaveBeenCalledTimes(1);
    expect(onAnnotatedExport.mock.calls[0][0].filename).toBe('evidence-a-annotated.png');
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'login.png' })).toBeInTheDocument();
  });

  it('cancelling the editor leaves the lightbox open and exports nothing', () => {
    const onAnnotatedExport = vi.fn();
    const onClose = vi.fn();
    render(<ImageLightboxModal imageUrl={URL_} onClose={onClose} onAnnotatedExport={onAnnotatedExport} />);
    fireEvent.click(screen.getByRole('button', { name: /Annotate & Redact/ }));
    fireEvent.click(screen.getByRole('button', { name: 'mock cancel' }));

    expect(onAnnotatedExport).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: 'Evidence Document Attachment' })).toBeInTheDocument();
  });

  it('keeps the existing close behaviour', () => {
    const onClose = vi.fn();
    render(<ImageLightboxModal imageUrl={URL_} onClose={onClose} onAnnotatedExport={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Close/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
