import { describe, it, expect } from 'vitest';
import { parseGitUrl, getSimulatedPrMetadata } from './gitParser';

describe('gitParser URL validation and metadata parsing', () => {
  it('parses GitHub pull request URLs accurately', () => {
    const parsed = parseGitUrl('https://github.com/stellar/soroban-example/pull/42');
    expect(parsed.isValid).toBe(true);
    expect(parsed.provider).toBe('github');
    expect(parsed.owner).toBe('stellar');
    expect(parsed.repo).toBe('soroban-example');
    expect(parsed.prNumber).toBe(42);
    expect(parsed.normalizedRepoUrl).toBe('https://github.com/stellar/soroban-example');
  });

  it('parses GitLab merge request URLs accurately', () => {
    const parsed = parseGitUrl('https://gitlab.com/gitlab-org/gitlab/-/merge_requests/9912');
    expect(parsed.isValid).toBe(true);
    expect(parsed.provider).toBe('gitlab');
    expect(parsed.owner).toBe('gitlab-org');
    expect(parsed.repo).toBe('gitlab');
    expect(parsed.prNumber).toBe(9912);
  });

  it('parses GitHub standard repository URLs and SSH remotes', () => {
    const https = parseGitUrl('https://github.com/trustpay-escrow/trustpay-escrow.git');
    expect(https.isValid).toBe(true);
    expect(https.provider).toBe('github');
    expect(https.owner).toBe('trustpay-escrow');
    expect(https.repo).toBe('trustpay-escrow');

    const ssh = parseGitUrl('git@github.com:trustpay-escrow/trustpay-escrow.git');
    expect(ssh.isValid).toBe(true);
    expect(ssh.owner).toBe('trustpay-escrow');
    expect(ssh.repo).toBe('trustpay-escrow');
  });

  it('parses GitLab nested subgroup repository URLs', () => {
    const gitlab = parseGitUrl('https://gitlab.com/group/subgroup/project.git');
    expect(gitlab.isValid).toBe(true);
    expect(gitlab.provider).toBe('gitlab');
    expect(gitlab.owner).toBe('group/subgroup');
    expect(gitlab.repo).toBe('project');
  });

  it('parses GitHub commit URLs', () => {
    const commit = parseGitUrl('https://github.com/facebook/react/commit/8b8e0b96b4bf22485603e5c9a7593c7263b6bb83');
    expect(commit.isValid).toBe(true);
    expect(commit.owner).toBe('facebook');
    expect(commit.repo).toBe('react');
    expect(commit.commitHash).toBe('8b8e0b96b4bf22485603e5c9a7593c7263b6bb83');
  });

  it('rejects invalid or non-git URLs gracefully', () => {
    expect(parseGitUrl('').isValid).toBe(false);
    expect(parseGitUrl('not a url').isValid).toBe(false);
    expect(parseGitUrl('https://example.com/some/random/article').isValid).toBe(false);
  });

  it('generates simulated PR metadata with CI status and diff statistics', () => {
    const parsed = parseGitUrl('https://github.com/trustpay/smart-contracts/pull/104');
    const meta = getSimulatedPrMetadata(parsed);

    expect(meta.prNumber).toBe(104);
    expect(meta.repoFullName).toBe('trustpay/smart-contracts');
    expect(['passing', 'failing', 'pending']).toContain(meta.ciStatus);
    expect(meta.latestCommitHash.length).toBeGreaterThanOrEqual(7);
    expect(meta.filesChanged).toBeGreaterThan(0);
    expect(meta.additions).toBeGreaterThan(0);
  });
});
