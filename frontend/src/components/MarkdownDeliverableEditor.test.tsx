import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MarkdownDeliverableEditor } from './MarkdownDeliverableEditor';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('MarkdownDeliverableEditor', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnChange.mockClear();
  });

  it('renders editor with toolbar and tabs', () => {
    render(<MarkdownDeliverableEditor value="" onChange={mockOnChange} />);

    expect(screen.getByTestId('markdown-bold')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-list')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-code')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-image')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-tab-write')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-tab-preview')).toBeInTheDocument();
  });

  it('shows write tab by default', () => {
    render(<MarkdownDeliverableEditor value="" onChange={mockOnChange} />);

    expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-tab-write')).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to preview tab when clicked', () => {
    render(<MarkdownDeliverableEditor value="# Hello World" onChange={mockOnChange} />);

    fireEvent.click(screen.getByTestId('markdown-tab-preview'));

    expect(screen.getByTestId('markdown-tab-preview')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('markdown-preview')).toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('applies bold formatting', () => {
    render(<MarkdownDeliverableEditor value="hello world" onChange={mockOnChange} />);

    // Focus and select "world"
    const textarea = screen.getByTestId('markdown-editor') as HTMLTextAreaElement;
    fireEvent.click(textarea);
    fireEvent.change(textarea, { target: { value: 'hello world', selectionStart: 6, selectionEnd: 11 } });
    textarea.setSelectionRange(6, 11);

    fireEvent.click(screen.getByTestId('markdown-bold'));

    expect(mockOnChange).toHaveBeenCalledWith('hello **world**');
  });

  it('applies bullet list formatting', () => {
    render(<MarkdownDeliverableEditor value={'item 1\nitem 2'} onChange={mockOnChange} />);

    fireEvent.click(screen.getByTestId('markdown-list'));

    expect(mockOnChange).toHaveBeenCalledWith('- item 1\n- item 2');
  });

  it('applies code block formatting', () => {
    render(<MarkdownDeliverableEditor value="const x = 1" onChange={mockOnChange} />);

    fireEvent.click(screen.getByTestId('markdown-code'));

    expect(mockOnChange).toHaveBeenCalledWith('\n```\nconst x = 1\n```\n');
  });

  it('opens file input when image button clicked', () => {
    render(<MarkdownDeliverableEditor value="" onChange={mockOnChange} />);

    fireEvent.click(screen.getByTestId('markdown-image'));

    const fileInput = screen.getByTestId('markdown-image-input');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp,image/gif');
  });

  it('handles file selection and inserts base64 markdown', async () => {
    render(<MarkdownDeliverableEditor value="" onChange={mockOnChange} />);

    // Create a mock file
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
    Object.defineProperty(mockFile, 'size', { value: 1024 });

    // Mock FileReader
    const originalFileReader = global.FileReader;
    class MockFileReader {
      result = 'data:image/png;base64,TEST_BASE64';
      onload: ((ev: any) => void) | null = null;
      readAsDataURL() {
        setTimeout(() => {
          this.onload?.({ target: { result: this.result } });
        }, 0);
      }
    }
    global.FileReader = MockFileReader as any;

    const fileInput = screen.getByTestId('markdown-image-input');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(expect.stringContaining('![test](data:image/png;base64,TEST_BASE64)'));
    });

    global.FileReader = originalFileReader;
  });

  it('rejects invalid file types', async () => {
    render(<MarkdownDeliverableEditor value="" onChange={mockOnChange} />);

    const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    Object.defineProperty(mockFile, 'size', { value: 1024 });

    const fileInput = screen.getByTestId('markdown-image-input');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByText('Only PNG, JPEG, WebP, and GIF images are allowed.')).toBeInTheDocument();
    });

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('rejects files exceeding max size', async () => {
    render(<MarkdownDeliverableEditor value="" onChange={mockOnChange} maxFileSize={100} />);

    const mockFile = new File(['x'.repeat(200)], 'test.png', { type: 'image/png' });
    Object.defineProperty(mockFile, 'size', { value: 200 });

    const fileInput = screen.getByTestId('markdown-image-input');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByText(/exceeds.*limit/)).toBeInTheDocument();
    });

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('shows drag-over overlay when dragging valid image', () => {
    render(<MarkdownDeliverableEditor value="" onChange={mockOnChange} />);

    const dropZone = screen.getByTestId('markdown-drop-zone');
    
    fireEvent.dragOver(dropZone, {
      dataTransfer: { types: ['Files'], files: [new File([''], 'test.png', { type: 'image/png' })] },
    });

    expect(screen.getByText('Drop images here or paste (Ctrl+V)')).toBeInTheDocument();
  });

  it('shows uploaded images in preview tab', async () => {
    render(<MarkdownDeliverableEditor value="![test](data:image/png;base64,TEST)" onChange={mockOnChange} />);

    fireEvent.click(screen.getByTestId('markdown-tab-preview'));

    // Should show the image in preview
    expect(screen.getByAltText('test')).toBeInTheDocument();
  });

  it('formats file size correctly', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1.00 MB');
    expect(formatFileSize(1024 * 1024 * 5)).toBe('5.00 MB');
  });

  it('validates image files correctly', () => {
    const validPng = new File([''], 'test.png', { type: 'image/png' });
    Object.defineProperty(validPng, 'size', { value: 1024 });
    expect(validateImageFile(validPng)).toEqual({ valid: true });

    const validJpeg = new File([''], 'test.jpg', { type: 'image/jpeg' });
    Object.defineProperty(validJpeg, 'size', { value: 1024 });
    expect(validateImageFile(validJpeg)).toEqual({ valid: true });

    const invalidType = new File([''], 'test.txt', { type: 'text/plain' });
    Object.defineProperty(invalidType, 'size', { value: 1024 });
    expect(validateImageFile(invalidType)).toEqual({ valid: false, error: 'Only PNG, JPEG, WebP, and GIF images are allowed.' });

    const tooLarge = new File([''], 'test.png', { type: 'image/png' });
    Object.defineProperty(tooLarge, 'size', { value: 20 * 1024 * 1024 });
    expect(validateImageFile(tooLarge)).toEqual({ valid: false, error: 'File size exceeds 10.00 MB limit.' });
  });
});

// Export helper functions for testing
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function validateImageFile(file: File): { valid: boolean; error?: string } {
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only PNG, JPEG, WebP, and GIF images are allowed.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds ${formatFileSize(MAX_FILE_SIZE)} limit.` };
  }
  return { valid: true };
}