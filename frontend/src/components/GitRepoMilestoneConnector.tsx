'use client';

import React, { useState, useEffect } from 'react';
import { parseGitUrl, getSimulatedPrMetadata, ParsedGitUrl, GitPrMetadata } from '@/lib/gitParser';

export interface GitRepoMilestoneConnectorProps {
  initialUrl?: string;
  onConnectorChange?: (data: {
    url: string;
    parsed: ParsedGitUrl;
    metadata: GitPrMetadata | null;
    isValid: boolean;
  }) => void;
  disabled?: boolean;
}

export function GitRepoMilestoneConnector({
  initialUrl = '',
  onConnectorChange,
  disabled = false,
}: GitRepoMilestoneConnectorProps) {
  const [url, setUrl] = useState(initialUrl);
  const [parsed, setParsed] = useState<ParsedGitUrl>(() => parseGitUrl(initialUrl));
  const [metadata, setMetadata] = useState<GitPrMetadata | null>(() =>
    parsed.isValid ? getSimulatedPrMetadata(parsed) : null
  );
  const [showDiffDetails, setShowDiffDetails] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    const result = parseGitUrl(url);
    setParsed(result);

    if (result.isValid) {
      const meta = getSimulatedPrMetadata(result);
      setMetadata(meta);
      onConnectorChange?.({
        url,
        parsed: result,
        metadata: meta,
        isValid: true,
      });
    } else {
      setMetadata(null);
      onConnectorChange?.({
        url,
        parsed: result,
        metadata: null,
        isValid: false,
      });
    }
  }, [url, onConnectorChange]);

  const handleCopyHash = (hash: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(hash).catch(() => {});
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-base" role="img" aria-label="git">
            🌿
          </span>
          <span className="text-sm font-semibold text-white">Git Deliverable Integration</span>
        </div>
        {parsed.isValid && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 capitalize">
            {parsed.provider} verified
          </span>
        )}
      </div>

      {/* Input Field */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">
          Pull Request or Repository Deliverable URL
        </label>
        <div className="relative">
          <input
            type="text"
            value={url}
            disabled={disabled}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="e.g. https://github.com/stellar/soroban-example/pull/42"
            className="w-full bg-[#121214] border border-[#333338] rounded-lg px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500/80 transition-colors"
          />
          {url && (
            <button
              type="button"
              onClick={() => setUrl('')}
              disabled={disabled}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>
        {url && !parsed.isValid && (
          <p className="text-[11px] text-amber-400/90 mt-1 flex items-center gap-1">
            <span>⚠️</span> Enter a valid GitHub/GitLab PR, MR, commit, or repository URL.
          </p>
        )}
      </div>

      {/* Metadata & Status Card */}
      {metadata && (
        <div className="bg-[#121214] border border-[#27272a] rounded-lg p-3 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white line-clamp-1">{metadata.title}</span>
                <span className="text-[11px] font-mono text-neutral-400">#{metadata.prNumber}</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                by <span className="text-neutral-200">@{metadata.author}</span> into{' '}
                <span className="font-mono text-neutral-300 bg-neutral-800 px-1 py-0.5 rounded text-[10px]">
                  {metadata.targetBranch}
                </span>{' '}
                from{' '}
                <span className="font-mono text-neutral-300 bg-neutral-800 px-1 py-0.5 rounded text-[10px]">
                  {metadata.sourceBranch}
                </span>
              </p>
            </div>

            {/* CI Status Badge */}
            <div className="shrink-0">
              <CiStatusBadge status={metadata.ciStatus} />
            </div>
          </div>

          {/* Commit & Diff Summary Row */}
          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-[#27272a]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleCopyHash(metadata.latestCommitHash)}
                title="Click to copy commit SHA"
                className="inline-flex items-center gap-1 font-mono text-neutral-400 hover:text-white bg-[#1e1e22] px-2 py-0.5 rounded border border-[#333338] transition-colors"
              >
                <span>Commit:</span>
                <span className="text-neutral-200">{metadata.latestCommitHash}</span>
                <span className="text-[10px]">{copiedHash ? '✓' : '📋'}</span>
              </button>

              <span className="text-neutral-400">
                <span className="text-emerald-400 font-semibold">+{metadata.additions}</span> /{' '}
                <span className="text-rose-400 font-semibold">-{metadata.deletions}</span> across{' '}
                <span className="text-neutral-300">{metadata.filesChanged} files</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowDiffDetails((prev) => !prev)}
              className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              {showDiffDetails ? 'Hide Diff' : 'View Diff'}
            </button>
          </div>

          {/* Expandable Diff Summary */}
          {showDiffDetails && (
            <div className="mt-2 pt-2 border-t border-neutral-800/80 text-[11px] space-y-1 font-mono text-neutral-300">
              <div className="flex justify-between items-center py-0.5 px-2 bg-neutral-900/60 rounded">
                <span>frontend/src/contracts/escrow.rs</span>
                <span className="text-emerald-400">+82 / -12</span>
              </div>
              <div className="flex justify-between items-center py-0.5 px-2 bg-neutral-900/60 rounded">
                <span>frontend/src/tests/integration.rs</span>
                <span className="text-emerald-400">+64 / -0</span>
              </div>
              <div className="flex justify-between items-center py-0.5 px-2 bg-neutral-900/60 rounded">
                <span>README.md</span>
                <span className="text-neutral-400">+38 / -14</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * CI/CD Status Badge rendering Passing, Failing, or Pending checkmarks.
 */
export function CiStatusBadge({ status }: { status: 'passing' | 'failing' | 'pending' }) {
  if (status === 'passing') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
        <span>✓</span> CI Passing
      </span>
    );
  }

  if (status === 'failing') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
        <span>✕</span> CI Failing
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" /> CI Pending
    </span>
  );
}

/**
 * Compact deliverable badge for displaying Git metadata inside milestone cards.
 */
export function GitDeliverableBadge({
  url,
  ciStatus = 'passing',
  commitHash,
}: {
  url: string;
  ciStatus?: 'passing' | 'failing' | 'pending';
  commitHash?: string;
}) {
  const parsed = parseGitUrl(url);
  if (!parsed.isValid) return null;

  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#18181b] border border-[#27272a] rounded-lg text-xs">
      <span role="img" aria-label="git">
        🌿
      </span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
      >
        <span>
          {parsed.provider === 'github' ? 'GitHub' : parsed.provider === 'gitlab' ? 'GitLab' : 'Git'}
          {parsed.prNumber ? ` PR #${parsed.prNumber}` : ' Repo'}
        </span>
        <span className="text-[10px]">↗</span>
      </a>
      {commitHash && <span className="font-mono text-neutral-400 text-[10px]">({commitHash.slice(0, 7)})</span>}
      <CiStatusBadge status={ciStatus} />
    </div>
  );
}
