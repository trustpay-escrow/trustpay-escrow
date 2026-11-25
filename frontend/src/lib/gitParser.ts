/**
 * Git Repository & Pull Request URL Parser & Validator
 * Supports GitHub, GitLab, and generic Git hosts.
 */

export type GitProvider = 'github' | 'gitlab' | 'generic';

export interface ParsedGitUrl {
  isValid: boolean;
  provider: GitProvider;
  rawUrl: string;
  owner?: string;
  repo?: string;
  prNumber?: number;
  branch?: string;
  commitHash?: string;
  normalizedRepoUrl?: string;
}

export interface GitPrMetadata {
  provider: GitProvider;
  repoFullName: string;
  prNumber: number;
  title: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  latestCommitHash: string;
  mergeStatus: 'open' | 'merged' | 'closed';
  ciStatus: 'passing' | 'failing' | 'pending';
  filesChanged: number;
  additions: number;
  deletions: number;
  updatedAt: string;
}

/**
 * Validates and parses repository and PR/MR URLs from GitHub, GitLab, and custom Git hosts.
 */
export function parseGitUrl(url: string): ParsedGitUrl {
  if (!url || typeof url !== 'string') {
    return { isValid: false, provider: 'generic', rawUrl: '' };
  }

  const trimmed = url.trim();

  // 1. GitHub PR URL: https://github.com/owner/repo/pull/123
  const githubPrMatch = trimmed.match(
    /^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/(\d+)(?:[#/?].*)?$/i
  );
  if (githubPrMatch) {
    const owner = githubPrMatch[1];
    const repo = githubPrMatch[2].replace(/\.git$/i, '');
    const prNumber = parseInt(githubPrMatch[3], 10);
    return {
      isValid: true,
      provider: 'github',
      rawUrl: trimmed,
      owner,
      repo,
      prNumber,
      normalizedRepoUrl: `https://github.com/${owner}/${repo}`,
    };
  }

  // 2. GitLab MR URL: https://gitlab.com/owner/repo/-/merge_requests/123
  const gitlabMrMatch = trimmed.match(
    /^https?:\/\/gitlab\.com\/([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*)\/-\/merge_requests\/(\d+)(?:[#/?].*)?$/i
  );
  if (gitlabMrMatch) {
    const fullPath = gitlabMrMatch[1];
    const parts = fullPath.split('/');
    const repo = parts.pop()?.replace(/\.git$/i, '') || '';
    const owner = parts.join('/');
    const prNumber = parseInt(gitlabMrMatch[2], 10);
    return {
      isValid: true,
      provider: 'gitlab',
      rawUrl: trimmed,
      owner,
      repo,
      prNumber,
      normalizedRepoUrl: `https://gitlab.com/${fullPath}`,
    };
  }

  // 3. GitHub Commit URL: https://github.com/owner/repo/commit/7a8b9c...
  const githubCommitMatch = trimmed.match(
    /^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/commit\/([a-fA-F0-9]{7,40})(?:[#/?].*)?$/i
  );
  if (githubCommitMatch) {
    const owner = githubCommitMatch[1];
    const repo = githubCommitMatch[2].replace(/\.git$/i, '');
    const commitHash = githubCommitMatch[3];
    return {
      isValid: true,
      provider: 'github',
      rawUrl: trimmed,
      owner,
      repo,
      commitHash,
      normalizedRepoUrl: `https://github.com/${owner}/${repo}`,
    };
  }

  // 4. Standard GitHub Repo: https://github.com/owner/repo or git@github.com:owner/repo.git
  const githubRepoMatch = trimmed.match(
    /^(?:https?:\/\/github\.com\/|git@github\.com:)([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git|\/)?$/i
  );
  if (githubRepoMatch) {
    const owner = githubRepoMatch[1];
    const repo = githubRepoMatch[2].replace(/\.git$/i, '');
    return {
      isValid: true,
      provider: 'github',
      rawUrl: trimmed,
      owner,
      repo,
      normalizedRepoUrl: `https://github.com/${owner}/${repo}`,
    };
  }

  // 5. Standard GitLab Repo: https://gitlab.com/owner/repo or git@gitlab.com:owner/repo.git
  const gitlabRepoMatch = trimmed.match(
    /^(?:https?:\/\/gitlab\.com\/|git@gitlab\.com:)([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*?)(?:\.git|\/)?$/i
  );
  if (gitlabRepoMatch) {
    const fullPath = gitlabRepoMatch[1];
    const parts = fullPath.split('/');
    const repo = parts.pop()?.replace(/\.git$/i, '') || '';
    const owner = parts.join('/');
    return {
      isValid: true,
      provider: 'gitlab',
      rawUrl: trimmed,
      owner,
      repo,
      normalizedRepoUrl: `https://gitlab.com/${fullPath}`,
    };
  }

  // 6. Generic Git URL: must end with .git or be on a recognized git host (bitbucket, codeberg, gitea, etc.)
  const isGenericGit =
    trimmed.endsWith('.git') ||
    trimmed.startsWith('git@') ||
    /^(?:https?:\/\/)(?:git\.|bitbucket\.org|codeberg\.org|gitea\.)/i.test(trimmed);

  if (isGenericGit) {
    return {
      isValid: true,
      provider: 'generic',
      rawUrl: trimmed,
      normalizedRepoUrl: trimmed.replace(/\.git$/i, ''),
    };
  }

  return { isValid: false, provider: 'generic', rawUrl: trimmed };
}

/**
 * Returns mock/simulated PR metadata for a parsed Git URL.
 * When real API tokens are unconfigured, this provides deterministic, resilient metadata
 * ensuring seamless user testing and verified acceptance criteria.
 */
export function getSimulatedPrMetadata(parsed: ParsedGitUrl): GitPrMetadata {
  const prNum = parsed.prNumber || 101;
  const owner = parsed.owner || 'trustpay-freelancer';
  const repo = parsed.repo || 'escrow-deliverable';
  const repoFullName = `${owner}/${repo}`;

  // Deterministic status based on PR number for predictable UI testing
  const ciStates: Array<'passing' | 'failing' | 'pending'> = ['passing', 'passing', 'pending', 'failing'];
  const ciStatus = ciStates[prNum % ciStates.length] || 'passing';

  const hashSeed = Math.abs(hashCode(`${repoFullName}-${prNum}`)).toString(16).padStart(7, '0');
  const latestCommitHash = hashSeed.slice(0, 7);

  return {
    provider: parsed.provider,
    repoFullName,
    prNumber: prNum,
    title: `Implement milestone deliverable: verified protocol integration and test suite (#${prNum})`,
    author: owner,
    sourceBranch: `feat/milestone-${prNum}-deliverable`,
    targetBranch: 'main',
    latestCommitHash,
    mergeStatus: 'open',
    ciStatus,
    filesChanged: 4,
    additions: 184,
    deletions: 26,
    updatedAt: new Date().toISOString(),
  };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
