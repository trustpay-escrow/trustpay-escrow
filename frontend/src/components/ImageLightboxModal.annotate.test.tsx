import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageLightboxModal } from './ImageLightboxModal';
import type { AnnotatedEvidence } from './EvidenceAnnotationCanvas';

// Mock the canvas editor so we don't need real <canvas> in happy-dom
vi.mock('./EvidenceAnnotationCanvas', () => ({
  EvidenceAnnotationCanvas: ({
    fileName,
    onExport,
    onCancel,
  }: {
    imageSrc: string;
    fileName: string;
    onExport: (res: AnnotatedEvidence) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="mock-annotation-canvas">
      <span>Editing: {fileName}</span>
      <button
        type="button"
        onClick={() =>
          onExport({
            blob: new Blob(['png'], { type: 'image/png' }),
            filename: fileName,
            dataUrl: 'data:image/png;base64,mock',
            annotationCount: 2,
            hasRedactions: true,
            originalName: fileName,
          })
        }
      >
        Trigger Export
      </button>
      <button type="button" onClick={onCancel}>
        Trigger Cancel
      </button>
    </div>
  ),
}));

const URL_ = 'https://example.com/mock.png';

describe('ImageLightboxModal annotate mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not offer annotation unless the caller opts in', () => {
    render(<ImageLightboxModal imageUrl={URL_} onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: /Annotate/ })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Evidence Document Attachment' })).toBeInTheDocument();
  });

  it('swaps the image for the editor, seeded with the image and its name', () => {
    render(
      <ImageLightboxModal
        imageUrl={URL_}
        imageAlt="login.png"
        onClose={() => {}}
        onAnnotatedExport={() => {}}
      />
    );

    const btn = screen.getByRole('button', { name: /Annotate/ });
    fireEvent.click(btn);

    expect(screen.getByTestId('mock-annotation-canvas')).toBeInTheDocument();
    expect(screen.getByText('Editing: login.png')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('hands exported evidence to the callback and returns to the normal view', () => {
    const onAnnotatedExport = vi.fn();
    render(
      <ImageLightboxModal
        imageUrl={URL_}
        imageAlt="login.png"
        onClose={() => {}}
        onAnnotatedExport={onAnnotatedExport}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Annotate/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Trigger Export' }));

    expect(onAnnotatedExport).toHaveBeenCalledTimes(1);
    expect(onAnnotatedExport).toHaveBeenCalledWith(
      expect.objectContaining({
        annotationCount: 2,
        hasRedactions: true,
        originalName: 'login.png',
      })
    );
    // Editor should be closed, back to image view
    expect(screen.queryByTestId('mock-annotation-canvas')).not.toBeInTheDocument();
  });

  it('exits edit mode without saving when cancel is clicked', () => {
    const onAnnotatedExport = vi.fn();
    const onClose = vi.fn();
    render(
      <ImageLightboxModal
        imageUrl={URL_}
        onClose={onClose}
        onAnnotatedExport={onAnnotatedExport}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Annotate/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Trigger Cancel' }));

    expect(onAnnotatedExport).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: 'Evidence Document Attachment' })).toBeInTheDocument();
  });

  it('keeps the existing close behaviour', () => {
    const onClose = vi.fn();
    render(
      <ImageLightboxModal
        imageUrl={URL_}
        onClose={onClose}
        onAnnotatedExport={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close lightbox' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
