'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useWalletStore } from '@/store/walletStore';
import { authFetch } from '@/lib/api';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useA11yAnnouncer } from './A11yLiveAnnouncer';
import { submitMilestoneOnChain, type TxStage } from '@/lib/soroban';
import {
  deliverableSubmissionSchema,
  parseGitHubPullRequestUrl,
  isGitHubPullRequestUrl,
  verifyGitHubPullRequest,
  type GitHubPrVerification,
} from '@/lib/validators';
import type { Milestone, Project } from '@/types';
import { ImageLightboxModal } from './ImageLightboxModal';
import { MarkdownDeliverableEditor } from './MarkdownDeliverableEditor';
import { DeliverableDiffViewer } from './DeliverableDiffViewer';
import { DeliverableFolderTree } from './DeliverableFolderTree';

const MAX_FILES = 20;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  previewUrl?: string;
  bytes?: ArrayBuffer;
  /** SHA-256 of the file, computed in the browser before upload (#254). */
  sha256?: string;
  error?: string;
}

type LinkVerification = GitHubPrVerification & { checking?: boolean };

export interface MilestoneSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  milestone: Milestone;
  onSubmitted?: (result: { txHash: string; deliverableHash: string }) => void;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildDeliverableHash(notes: string, githubPrUrls: string[], files: AttachedFile[]): Promise<string> {
  const fileDigests = await Promise.all(
    files.map(async (file) => {
      if (file.sha256) return file.sha256;
      if (!file.bytes || !hasSubtleCrypto()) return 'unavailable';
      return sha256Hex(file.bytes);
    })
  );
  const payload = JSON.stringify({
    notes: notes.trim(),
    githubPrUrls,
    files: files.map((file, index) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      sha256: fileDigests[index],
    })),
  });

  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    return toHex(await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)));
  }
  return `sha256-${Date.now().toString(16)}`;
}

export function MilestoneSubmitModal({
  isOpen,
  onClose,
  project,
  milestone,
  onSubmitted,
}: MilestoneSubmitModalProps) {
  const { address } = useWalletStore();
  const [notes, setNotes] = useState('');
  const [prInput, setPrInput] = useState('');
  const [prLinks, setPrLinks] = useState<string[]>([]);
  const [verifications, setVerifications] = useState<Record<string, LinkVerification>>({});
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [txStatus, setTxStatus] = useState<{ stage: TxStage | 'validating'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const { announce } = useA11yAnnouncer();
  const dialogRef = useFocusTrap<HTMLDivElement>({
    active: isOpen,
    onEscape: () => {
      if (!submitting) onClose();
    },
  });

  useEffect(() => {
    if (txStatus?.message) {
      announce(
        `${txStatus.stage === 'error' ? 'Submission failed' : 'Milestone submission'} ${txStatus.stage}: ${txStatus.message}`,
        txStatus.stage === 'error' ? 'assertive' : 'polite'
      );
    }
  }, [txStatus, announce]);

  if (!isOpen) return null;

  const addFiles = (incoming: FileList | File[]) => {
    const candidates = Array.from(incoming).filter((file) => file.size <= MAX_FILE_BYTES);
    const rejected = Array.from(incoming).length - candidates.length;
    if (rejected > 0) toast.error(`${rejected} file(s) exceeded the 25 MB limit.`);

    const slots = MAX_FILES - files.length;
    if (slots <= 0) {
      toast.error(`You can attach at most ${MAX_FILES} files.`);
      return;
    }
    const accepted = candidates.slice(0, slots);
    if (candidates.length > slots) toast.error(`Only the first ${slots} file(s) were attached.`);

    const entries: AttachedFile[] = accepted.map((file, index) => {
      let previewUrl: string | undefined;
      if (file.type.startsWith('image/') && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        previewUrl = URL.createObjectURL(file);
        objectUrlsRef.current.push(previewUrl);
      }
      return {
        id: `${Date.now()}-${index}-${file.name}`,
        name: file.name,
        size: file.size,
        type: file.type,
        progress: 0,
        previewUrl,
      };
    });
    setFiles((previous) => [...previous, ...entries]);

    entries.forEach((entry, index) => {
      const reader = new FileReader();
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setFiles((previous) => previous.map((item) => item.id === entry.id ? { ...item, progress } : item));
        }
      };
      reader.onload = () => {
        const bytes = reader.result as ArrayBuffer;
        setFiles((previous) => previous.map((item) => item.id === entry.id
          ? { ...item, progress: 100, bytes }
          : item));
        // Hash client-side so the checksum is recorded with the submission (#254).
        if (hasSubtleCrypto()) {
          sha256Hex(bytes)
            .then((sha256) => setFiles((previous) => previous.map((item) => item.id === entry.id ? { ...item, sha256 } : item)))
            .catch(() => undefined);
        }
      };
      reader.onerror = () => {
        setFiles((previous) => previous.map((item) => item.id === entry.id
          ? { ...item, error: 'Could not read file', progress: 0 }
          : item));
      };
      reader.readAsArrayBuffer(accepted[index]);
    });
  };

  const removeFile = (id: string) => {
    setFiles((previous) => {
      const target = previous.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return previous.filter((item) => item.id !== id);
    });
  };

  const runVerification = async (url: string) => {
    setVerifications((previous) => ({ ...previous, [url]: { verified: false, checking: true, unverifiable: true } }));
    const result = await verifyGitHubPullRequest(url);
    setVerifications((previous) => ({ ...previous, [url]: result }));
  };

  const addPrLink = async () => {
    const ref = parseGitHubPullRequestUrl(prInput);
    if (!ref) {
      toast.error('Enter a valid GitHub PR URL, e.g. https://github.com/owner/repo/pull/123');
      return;
    }
    if (prLinks.includes(ref.url)) {
      toast.error('That pull request is already attached.');
      return;
    }
    setPrLinks((previous) => [...previous, ref.url]);
    setPrInput('');
    await runVerification(ref.url);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTxStatus({ stage: 'validating', message: 'Validating deliverable payload...' });

    const validation = deliverableSubmissionSchema.safeParse({
      notes,
      githubPrUrls: prLinks,
      files: files.map(({ name, size, type }) => ({ name, size, type })),
    });
    if (!validation.success) {
      setTxStatus(null);
      toast.error(validation.error.issues[0]?.message || 'Invalid deliverable.');
      return;
    }
    if (files.some((file) => file.progress < 100 || file.error || !file.bytes)) {
      setTxStatus(null);
      toast.error('Wait for all attachments to finish processing.');
      return;
    }
    if (prLinks.some((url) => verifications[url]?.checking)) {
      setTxStatus(null);
      toast.error('Still verifying GitHub pull request links.');
      return;
    }
    const inaccessible = prLinks.find((url) => {
      const verification = verifications[url];
      return verification && !verification.verified && !verification.unverifiable;
    });
    if (inaccessible) {
      setTxStatus(null);
      toast.error(`Pull request is not accessible: ${inaccessible}`);
      return;
    }
    if (!address) {
      setTxStatus(null);
      toast.error('Connect your freelancer wallet before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const deliverableHash = await buildDeliverableHash(notes, prLinks, files);
      setTxStatus({
        stage: 'preparing',
        message: `Signing submit_milestone for milestone #${milestone.milestone_index + 1} (hash ${deliverableHash.slice(0, 12)}...)`,
      });

      const result = await submitMilestoneOnChain({
        freelancerAddress: address,
        projectIdOnChain: project.project_id_onchain ?? project.id ?? 1,
        milestoneIndex: milestone.milestone_index,
        deliverableHash,
        onStatusUpdate: (stage, message) => setTxStatus({ stage, message }),
      });

      const attachments = [
        ...prLinks.map((url) => `- Pull Request: ${url}`),
        ...files.map((file) => formatAttachmentLine(file.name, formatBytes(file.size), file.sha256)),
      ];
      const deliverableNotes = `${notes.trim()}\n\n### Links & Attachments\n${attachments.length > 0 ? attachments.join('\n') : '_None provided_'}`;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await authFetch(`${apiUrl}/api/milestones/${encodeURIComponent(milestone.id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'submitted',
          actor_address: address,
          deliverable_hash: deliverableHash,
          deliverable_url: prLinks[0] || '',
          deliverable_notes: deliverableNotes,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Could not save the deliverable metadata.');
      }

      toast.success('Deliverable submitted on-chain. Client review timelock started.');
      onSubmitted?.({ txHash: result.txHash, deliverableHash });
      setNotes('');
      setPrLinks([]);
      setVerifications({});
      setFiles([]);
      setTxStatus(null);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTxStatus({ stage: 'error', message });
      toast.error(`Milestone submission failed: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="milestone-submit-title"
        tabIndex={-1}
        className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto custom-scrollbar shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#27272a] bg-[#18181b]/95 px-5 py-4">
          <div>
            <h2 id="milestone-submit-title" className="text-lg sm:text-xl font-bold text-white">Submit Milestone Deliverable</h2>
            <p className="text-[11px] sm:text-xs text-[#a1a1aa] mt-0.5">
              {milestone.title} &middot; {project.title} &middot; {milestone.amount} {project.token || 'USDC'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close submission modal"
            className="text-[#a1a1aa] hover:text-white text-lg disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          <section className="space-y-2">
            <label className="block text-xs font-bold text-[#e4e4e7] uppercase tracking-wide">
              Work Summary <span className="text-red-400">*</span>
            </label>
            <MarkdownDeliverableEditor value={notes} onChange={setNotes} />
            {notes.trim().length > 0 && notes.trim().length < 20 && (
              <p className="text-xs text-red-400 mt-1" data-testid="notes-validation-error">
                Work summary must be at least 20 characters ({notes.trim().length}/20)
              </p>
            )}
          </section>

          <section className="space-y-2">
            <label htmlFor="pr-url-input" className="block text-xs font-bold text-[#e4e4e7] uppercase tracking-wide">
              GitHub Pull Requests
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="pr-url-input"
                data-testid="pr-url-input"
                type="url"
                value={prInput}
                onChange={(event) => setPrInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void addPrLink();
                  }
                }}
                placeholder="https://github.com/owner/repo/pull/123"
                className="flex-1 px-3 py-2 bg-[#232326] border border-[#333338] rounded-xl text-sm text-white placeholder-[#71717a] focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => void addPrLink()}
                data-testid="add-pr-link"
                className="px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs font-bold rounded-xl border border-[#3f3f46] transition-colors"
              >
                Add & Verify
              </button>
            </div>
            {prInput.trim().length > 0 && !isGitHubPullRequestUrl(prInput) && (
              <p className="text-xs text-red-400 mt-1" data-testid="pr-url-error">
                Enter a valid GitHub pull request URL (https://github.com/owner/repo/pull/123)
              </p>
            )}

            {prLinks.length > 0 && (
              <ul className="space-y-2 pt-1" data-testid="pr-link-list">
                {prLinks.map((url) => {
                  const verification = verifications[url];
                  const statusLabel = verification?.checking
                    ? 'Checking…'
                    : verification?.verified
                      ? 'Verified'
                      : verification?.unverifiable
                        ? 'Unverified'
                        : 'Not found';
                  const statusClass = verification?.checking
                    ? 'bg-[#27272a] text-[#a1a1aa]'
                    : verification?.verified
                      ? 'bg-[#052e16] text-[#22c55e] border border-[#14532d]'
                      : verification?.unverifiable
                        ? 'bg-[#451a03] text-[#f97316] border border-[#78350f]'
                        : 'bg-[#450a0a] text-[#f87171] border border-[#7f1d1d]';
                  return (
                    <li key={url} className="flex items-center justify-between gap-2 bg-[#1c1c20] border border-[#27272a] rounded-xl px-3 py-2">
                      <div className="min-w-0 space-y-0.5">
                        <a href={url} target="_blank" rel="noreferrer" className="block truncate text-xs text-indigo-400 hover:underline">
                          {url}
                        </a>
                        {verification?.reason && <p className="text-[10px] text-[#71717a]">{verification.reason}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => void runVerification(url)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${statusClass}`}
                          title="Re-check repository accessibility"
                        >
                          {statusLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrLinks((previous) => previous.filter((item) => item !== url))}
                          aria-label={`Remove ${url}`}
                          className="text-[#71717a] hover:text-red-400 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <label className="block text-xs font-bold text-[#e4e4e7] uppercase tracking-wide">Attachments</label>
            <div
              data-testid="deliverable-dropzone"
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                addFiles(event.dataTransfer.files);
              }}
              className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-[#333338] bg-[#141417]'
              }`}
            >
              <p className="text-xs text-[#a1a1aa]">Drag and drop files here, or</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 px-4 py-1.5 text-xs font-bold rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-white border border-[#3f3f46]"
              >
                Browse Files
              </button>
              <input
                ref={fileInputRef}
                data-testid="deliverable-file-input"
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  if (event.target.files) addFiles(event.target.files);
                  event.target.value = '';
                }}
              />
              <p className="mt-2 text-[10px] text-[#71717a]">Up to {MAX_FILES} files, 25 MB each</p>
            </div>

            {files.length > 0 && (
              <ul className="space-y-2" data-testid="attachment-list">
                {files.map((file) => (
                  <li key={file.id} className="flex items-center gap-3 bg-[#1c1c20] border border-[#27272a] rounded-xl p-2.5">
                    {file.previewUrl ? (
                      <button
                        type="button"
                        onClick={() => setLightbox({ url: file.previewUrl!, name: file.name })}
                        className="shrink-0"
                        title={`Preview ${file.name}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={file.previewUrl} alt={file.name} className="w-12 h-12 object-cover rounded-lg border border-[#333338]" />
                      </button>
                    ) : (
                      <span className="w-12 h-12 rounded-lg bg-[#27272a] flex items-center justify-center text-lg shrink-0">📄</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#e4e4e7] truncate">{file.name}</span>
                        <span className="text-[10px] text-[#71717a] shrink-0">{formatBytes(file.size)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#27272a] overflow-hidden">
                        <div
                          data-testid={`upload-progress-${file.id}`}
                          className={`h-full rounded-full transition-all ${file.error ? 'bg-red-500' : 'bg-indigo-500'}`}
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                      <p className={`mt-1 text-[10px] ${file.error ? 'text-red-400' : 'text-[#71717a]'}`}>
                        {file.error || (file.progress === 100 ? 'Ready' : `Processing ${file.progress}%`)}
                      </p>
                      {file.sha256 && (
                        <p
                          className="mt-0.5 font-mono text-[10px] text-emerald-400"
                          title={file.sha256}
                          data-testid={`attachment-hash-${file.id}`}
                        >
                          {truncateHash(file.sha256)}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      aria-label={`Remove ${file.name}`}
                      className="text-[#71717a] hover:text-red-400 text-xs shrink-0"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {files.length > 0 && (
              <div className="mt-3">
                <DeliverableFolderTree
                  files={files.map((f) => ({ path: f.name, size: f.size, url: f.previewUrl }))}
                  title="Deliverable Files Hierarchy"
                />
              </div>
            )}
          </section>

          {txStatus && (
            <div
              data-testid="submission-status"
              className={`rounded-xl border px-3 py-2 text-xs ${
                txStatus.stage === 'error'
                  ? 'bg-[#450a0a]/60 border-[#7f1d1d] text-red-300'
                  : txStatus.stage === 'success'
                    ? 'bg-[#052e16]/60 border-[#14532d] text-emerald-300'
                    : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
              }`}
            >
              <span className="font-bold uppercase tracking-wide mr-2">{txStatus.stage}</span>
              {txStatus.message}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#27272a] pt-4">
            <p className="text-[10px] text-[#71717a] max-w-xs leading-relaxed">
              Submitting signs a Soroban <code className="text-indigo-300">submit_milestone</code> transaction and starts the 7-day review timelock.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
            disabled={submitting}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-[#a1a1aa] hover:text-white disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="submit-deliverable"
                disabled={submitting || notes.trim().length < 20}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {submitting ? 'Signing & Submitting…' : 'Submit Deliverable ↗'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <ImageLightboxModal
        imageUrl={lightbox?.url || null}
        imageAlt={lightbox?.name}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}

export default MilestoneSubmitModal;
