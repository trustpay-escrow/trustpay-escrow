import { StrKey } from '@stellar/stellar-sdk';
import type { DaoProposalInput } from '@/types';
import {
  AMOUNT_SCALE,
  DEFAULT_ARBITER_ADDRESS,
  encodeCreateProjectInvocation,
  SorobanInvocationPayload,
} from '@/lib/soroban';

export const MIN_VOTING_DAYS = 1;
export const MAX_VOTING_DAYS = 90;

export type DaoProposalErrors = Partial<Record<keyof DaoProposalInput | 'milestones', string>>;

/** G... (account) or C... (contract) address: DAO treasuries are often contract accounts. */
export function isValidStellarAddress(value: string): boolean {
  return StrKey.isValidEd25519PublicKey(value) || StrKey.isValidContract(value);
}

export function validateDaoProposalInput(input: DaoProposalInput): DaoProposalErrors {
  const errors: DaoProposalErrors = {};
  if (!input.proposalTitle.trim()) errors.proposalTitle = 'Proposal title is required';
  if (!input.projectTitle.trim()) errors.projectTitle = 'Project title is required';
  if (!input.treasuryAddress.trim()) {
    errors.treasuryAddress = 'DAO treasury address is required';
  } else if (!isValidStellarAddress(input.treasuryAddress.trim())) {
    errors.treasuryAddress = 'Enter a valid Stellar address (G… or C…)';
  }
  if (input.freelancerAddress?.trim() && !isValidStellarAddress(input.freelancerAddress.trim())) {
    errors.freelancerAddress = 'Enter a valid Stellar address (G… or C…)';
  }
  if (input.arbiterAddress?.trim() && !isValidStellarAddress(input.arbiterAddress.trim())) {
    errors.arbiterAddress = 'Enter a valid Stellar address (G… or C…)';
  }
  if (!isValidStellarAddress(input.tokenAddress)) {
    errors.tokenAddress = 'Token contract address is invalid';
  }
  if (input.milestones.length === 0) {
    errors.milestones = 'Add at least one milestone';
  } else if (input.milestones.some((m) => !Number.isFinite(m.amount) || m.amount <= 0)) {
    errors.milestones = 'Every milestone amount must be greater than zero';
  } else if (input.milestones.some((m) => Math.round(m.amount * AMOUNT_SCALE) < 1)) {
    errors.milestones = 'Milestone amounts support at most 7 decimal places';
  }
  if (
    !Number.isInteger(input.votingPeriodDays) ||
    input.votingPeriodDays < MIN_VOTING_DAYS ||
    input.votingPeriodDays > MAX_VOTING_DAYS
  ) {
    errors.votingPeriodDays = `Voting period must be a whole number of days between ${MIN_VOTING_DAYS} and ${MAX_VOTING_DAYS}`;
  }
  return errors;
}

/** Make untrusted text safe inside a single markdown table cell. */
export function escapeMarkdownCell(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n+/g, ' ').trim();
}

/** Neutralise markdown headings/HTML in free-form text that is quoted as a block. */
function quoteBlock(text: string): string {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => `> ${line.replace(/</g, '&lt;')}`)
    .join('\n');
}

export function totalAmount(input: Pick<DaoProposalInput, 'milestones'>): number {
  // Sum in scaled integers so 0.1 + 0.2 style float drift never reaches the proposal.
  const scaled = input.milestones.reduce((sum, m) => sum + Math.round(m.amount * AMOUNT_SCALE), 0);
  return scaled / AMOUNT_SCALE;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 7 });

export function buildDaoInvocation(input: DaoProposalInput, contractAddress?: string): SorobanInvocationPayload {
  return encodeCreateProjectInvocation({
    clientAddress: input.treasuryAddress.trim(),
    freelancerAddress: input.freelancerAddress?.trim() || undefined,
    arbiterAddress: input.arbiterAddress?.trim() || undefined,
    tokenAddress: input.tokenAddress,
    milestoneAmounts: input.milestones.map((m) => m.amount),
    yieldEnabled: input.yieldEnabled,
    contractAddress,
  });
}

/** Governance-forum markdown for the proposal, including the executable payload. */
export function buildDaoProposalMarkdown(
  input: DaoProposalInput,
  invocation: SorobanInvocationPayload = buildDaoInvocation(input)
): string {
  const total = totalAmount(input);
  const arbiter = input.arbiterAddress?.trim() || DEFAULT_ARBITER_ADDRESS;
  const rows = input.milestones.map(
    (m, i) =>
      `| ${i + 1} | ${escapeMarkdownCell(m.title || `Milestone ${i + 1}`)} | ${fmt(m.amount)} ${input.token} | ${
        m.due_date ? escapeMarkdownCell(m.due_date) : 'n/a'
      } |`
  );

  const lines: string[] = [
    `# ${escapeMarkdownCell(input.proposalTitle)}`,
    '',
    '## Summary',
    `Request the DAO to fund a milestone escrow of **${fmt(total)} ${input.token}** for **${escapeMarkdownCell(
      input.projectTitle
    )}**${input.category ? ` (${escapeMarkdownCell(input.category)})` : ''}, held in the TrustPay Escrow contract on Stellar and released only as each milestone is approved.`,
    '',
    '## Motivation',
    input.description.trim() ? quoteBlock(input.description) : '_No description provided._',
    '',
    '## Escrow terms',
    '| # | Milestone | Amount | Due |',
    '|---|-----------|--------|-----|',
    ...rows,
    `| | **Total** | **${fmt(total)} ${input.token}** | |`,
    '',
    `- **Token:** ${input.token} (\`${input.tokenAddress}\`)`,
    `- **Funding account (DAO treasury):** \`${input.treasuryAddress.trim()}\``,
    `- **Freelancer:** ${input.freelancerAddress?.trim() ? `\`${input.freelancerAddress.trim()}\`` : 'Unassigned (bound after the proposal executes)'}`,
    `- **Arbiter:** \`${arbiter}\``,
    `- **Yield on idle funds:** ${input.yieldEnabled ? 'Enabled' : 'Disabled'}`,
    ...(input.deadline ? [`- **Project deadline:** ${escapeMarkdownCell(input.deadline)}`] : []),
    '',
    '## Voting',
    `- **Voting period:** ${input.votingPeriodDays} day${input.votingPeriodDays === 1 ? '' : 's'}`,
    '- **On approval:** the treasury executes the call below, which locks the funds in escrow.',
    '- **On rejection or expiry:** no funds move.',
    '',
    '## Executable payload',
    `Invoke \`${invocation.functionName}\` on contract \`${invocation.contractId}\`. The caller (\`client\`) must authorise the call.`,
    '',
    '| Argument | Value |',
    '|----------|-------|',
    ...invocation.args.map((a) => `| \`${a.name}\` | \`${escapeMarkdownCell(a.value)}\` |`),
    '',
    'Amounts are encoded as `i128` scaled by 10^7 (stroops). Encoded arguments and the full host function are in the calldata JSON.',
    '',
    '### Host function (base64 XDR)',
    '```',
    invocation.hostFunctionXdr,
    '```',
    '',
    '## Verification',
    `1. Decode the host function XDR and confirm the contract is \`${invocation.contractId}\` and the function is \`${invocation.functionName}\`.`,
    `2. Confirm the milestone amounts sum to ${fmt(total)} ${input.token}.`,
    '3. Simulate the transaction before voting.',
  ];
  return lines.join('\n');
}

/** Machine-readable calldata for a governance executor. */
export function buildDaoCalldataJson(
  input: DaoProposalInput,
  invocation: SorobanInvocationPayload = buildDaoInvocation(input)
): string {
  return JSON.stringify(
    {
      network: 'stellar',
      contractId: invocation.contractId,
      function: invocation.functionName,
      args: invocation.args,
      hostFunctionXdr: invocation.hostFunctionXdr,
      amountScale: AMOUNT_SCALE,
      totalAmount: totalAmount(input),
      token: { symbol: input.token, address: input.tokenAddress },
    },
    null,
    2
  );
}
