'use client';

import React, { useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

interface MarkdownDeliverableEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  /** Optional API endpoint for uploading images (defaults to /api/upload/image) */
  uploadEndpoint?: string;
  /** Max file size in bytes (default 10MB) */
  maxFileSize?: number;
}

type EditorTab = 'write' | 'preview';
type FormatAction = 'bold' | 'list' | 'code';

interface UploadedImage {
  url: string;
  alt: string;
  markdown: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function validateImageFile(file: File, limitBytes: number = MAX_FILE_SIZE): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only PNG, JPEG, WebP, and GIF images are allowed.' };
  }
  if (file.size > limitBytes) {
    return { valid: false, error: `File size exceeds ${formatFileSize(limitBytes)} limit.` };
  }
  return { valid: true };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function MarkdownDeliverableEditor({
  value,
  onChange,
  placeholder = 'Describe the work completed, decisions made, and how to verify the deliverables...',
  rows = 10,
  uploadEndpoint = '/api/upload/image',
  maxFileSize = MAX_FILE_SIZE,
}: MarkdownDeliverableEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('write');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  const applyFormat = (action: FormatAction) => {
    const textarea = textareaRef.current;
    const rawStart = textarea?.selectionStart ?? value.length;
    const rawEnd = textarea?.selectionEnd ?? value.length;
    const formatWhole = action !== 'bold' && rawStart === 0 && rawEnd === 0 && value.length > 0;
    const start = rawStart;
    const end = formatWhole ? value.length : rawEnd;
    const selected = value.slice(start, end);

    let replacement = '';
    let selectionStart = start;
    let selectionEnd = start;

    if (action === 'bold') {
      const content = selected || 'bold text';
      replacement = `**${content}**`;
      selectionStart = start + 2;
      selectionEnd = selectionStart + content.length;
    } else if (action === 'list') {
      const content = selected || 'List item';
      replacement = content
        .split('\n')
        .map((line) => `- ${line.replace(/^[-*]\s*/, '')}`)
        .join('\n');
      selectionStart = start;
      selectionEnd = start + replacement.length;
    } else {
      const content = selected || 'const result = await verify();';
      replacement = `\n\`\`\`\n${content}\n\`\`\`\n`;
      selectionStart = start + replacement.indexOf(content);
      selectionEnd = selectionStart + content.length;
    }

    onChange(value.slice(0, start) + replacement + value.slice(end));
    setActiveTab('write');

    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
    }, 0);
  };

  const insertImageMarkdown = useCallback((markdown: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const newValue = value.slice(0, start) + markdown + value.slice(end);
    onChange(newValue);
    setActiveTab('write');

    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start + markdown.length, start + markdown.length);
    }, 0);
  }, [value, onChange]);

  const handleImageUpload = async (file: File) => {
    const validation = validateImageFile(file, maxFileSize);
    if (!validation.valid) {
      const msg = validation.error || 'Invalid image file';
      setUploadError(msg);
      toast.error(msg);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      // In a real implementation, this would upload to the API
      // For now, we'll convert to base64 data URL
      const base64 = await fileToBase64(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      const alt = file.name.replace(/\.[^/.]+$/, '');
      const markdown = `![${alt}](${base64})`;
      
      const newImage: UploadedImage = { url: base64, alt, markdown };
      setUploadedImages((prev) => [...prev, newImage]);
      insertImageMarkdown(markdown);

      toast.success(`Image "${file.name}" inserted`);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to process image');
      toast.error(`Upload failed: ${err.message || err}`);
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setDragActive(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((f) => ALLOWED_TYPES.includes(f.type));
    
    if (imageFiles.length === 0) {
      toast.error('No valid image files found. Please drop PNG, JPEG, WebP, or GIF images.');
      return;
    }

    for (const file of imageFiles) {
      await handleImageUpload(file);
    }
  }, [handleImageUpload]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter((item) => item.type.startsWith('image/'));
    
    if (imageItems.length === 0) return;

    e.preventDefault(); // Prevent default paste behavior

    for (const item of imageItems) {
      const file = item.getAsFile();
      if (file) {
        await handleImageUpload(file);
      }
    }
  }, [handleImageUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      handleImageUpload(file);
    }
    e.target.value = ''; // Reset so same file can be selected again
  }, [handleImageUpload]);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      // Let the native paste handler deal with it
      return;
    }
  }, []);

  return (
    <div className="rounded-xl border border-[#333338] bg-[#141417] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#27272a] bg-[#1c1c20] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="markdown-bold"
            title="Bold"
            aria-label="Bold"
            onClick={() => applyFormat('bold')}
            className="w-7 h-7 rounded-md font-bold text-sm text-[#d4d4d8] hover:bg-[#2a2a30] hover:text-white transition-colors"
          >
            B
          </button>
          <button
            type="button"
            data-testid="markdown-list"
            title="Bullet list"
            aria-label="Bullet list"
            onClick={() => applyFormat('list')}
            className="w-7 h-7 rounded-md text-sm font-bold text-[#d4d4d8] hover:bg-[#2a2a30] hover:text-white transition-colors"
          >
            ≡
          </button>
          <button
            type="button"
            data-testid="markdown-code"
            title="Code block"
            aria-label="Code block"
            onClick={() => applyFormat('code')}
            className="h-7 px-2 rounded-md font-mono text-xs text-[#d4d4d8] hover:bg-[#2a2a30] hover:text-white transition-colors"
          >
            {'</>'}
          </button>
          <button
            type="button"
            data-testid="markdown-image"
            title="Upload Image (Ctrl+V to paste)"
            aria-label="Upload Image"
            onClick={triggerFileInput}
            className="w-7 h-7 rounded-md text-sm text-[#d4d4d8] hover:bg-[#2a2a30] hover:text-white transition-colors flex items-center justify-center"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            aria-label="Upload image"
            data-testid="markdown-image-input"
          />
          <span className="ml-1 text-[10px] text-[#71717a] hidden sm:inline">Markdown supported</span>
        </div>

        <div role="tablist" aria-label="Deliverable summary editor" className="flex items-center gap-1 bg-[#111113] p-0.5 rounded-lg border border-[#27272a]">
          {(['write', 'preview'] as EditorTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              data-testid={`markdown-tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold capitalize transition-colors ${
                activeTab === tab ? 'bg-indigo-600 text-white' : 'text-[#a1a1aa] hover:text-white'
              }` }
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {uploadError && (
        <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="text-rose-400 hover:text-rose-300">✕</button>
        </div>
      )}

      {uploading && (
        <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/30">
          <div className="flex items-center justify-between text-xs text-blue-400 mb-1">
            <span>Uploading image...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {activeTab === 'write' ? (
        <div role="tabpanel">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            className="relative"
            data-testid="markdown-drop-zone"
          >
            <textarea
              ref={textareaRef}
              data-testid="markdown-editor"
              rows={rows}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
              className={`w-full px-3.5 py-3 bg-transparent text-sm text-[#e4e4e7] placeholder-[#71717a] focus:outline-none resize-y font-mono leading-relaxed ${
                dragActive ? 'ring-2 ring-indigo-500/50 bg-[#1a1a20]' : ''
              }`}
            />
            {dragActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-indigo-500/10 rounded-b-xl pointer-events-none animate-pulse">
                <div className="text-center p-4">
                  <div className="text-4xl mb-2">📷</div>
                  <p className="text-indigo-400 font-medium">Drop images here or paste (Ctrl+V)</p>
                  <p className="text-xs text-indigo-400/70 mt-1">PNG, JPEG, WebP, GIF · Max 10MB</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          role="tabpanel"
          data-testid="markdown-preview"
          className="min-h-[180px] px-4 py-3 text-sm text-[#d4d4d8] leading-relaxed overflow-y-auto max-h-[360px] [&_a]:text-indigo-400 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-[#3f3f46] [&_blockquote]:pl-3 [&_blockquote]:text-[#a1a1aa] [&_code]:bg-[#232326] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-white [&_li]:list_item [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:my-2 [&_pre]:bg-[#0b0b10] [&_pre]:border [&_pre]:border-[#27272a] [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_strong]:font-bold [&_strong]:text-white [&_ul]:list-disc [&_ul]:my-2"
        >
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ children, href }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            ) }}>
              {value}
            </ReactMarkdown>
          ) : (
            <span className="text-[#71717a] italic">Nothing to preview yet.</span>
          )}
        </div>
      )}

      {uploadedImages.length > 0 && activeTab === 'preview' && (
        <div className="border-t border-[#27272a] p-3 bg-[#1c1c20]">
          <p className="text-xs font-semibold text-slate-400 mb-2">Uploaded Images (click to zoom)</p>
          <div className="flex flex-wrap gap-2">
            {uploadedImages.map((img, idx) => (
              <div key={idx} className="relative group cursor-zoom-in">
                <img
                  src={img.url}
                  alt={img.alt}
                  className="max-w-[150px] max-h-[100px] rounded-lg border border-slate-700 object-contain transition-transform duration-200 group-hover:scale-105"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MarkdownDeliverableEditor;