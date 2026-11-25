import { describe, it, expect } from 'vitest';
import { Address, scValToNative, StrKey, xdr } from '@stellar/stellar-sdk';
import type { DaoProposalInput } from '@/types';
import { SUPPORTED_TOKENS } from '@/config/tokens';
import {
  AMOUNT_SCALE,
  buildCreateProjectArgs,
  CREATE_PROJECT_ARG_NAMES,
  DEFAULT_ARBITER_ADDRESS,
  DEFAULT_ESCROW_CONTRACT_ID,
  encodeCreateProjectInvocation,
} from './soroban';
import {
  buildDaoCalldataJson,
  buildDaoInvocation,
  buildDaoProposalMarkdown,
  escapeMarkdownCell,
  isValidStellarAddress,
  totalAmount,
  validateDaoProposalInput,
} from './dao-proposal';

// Deterministic, valid account strkeys. Keypair.random() needs real crypto
// primitives that jsdom's Uint8Array realm breaks, and fixtures need no secrets.
const account = (byte: number) => StrKey.encodeEd25519PublicKey(Buffer.alloc(32, byte));
const TREASURY = account(1);
const FREELANCER = account(2);
const ARBITER = account(3);
const USDC = SUPPORTED_TOKENS.USDC.issuerOrContractAddress;

const input = (over: Partial<DaoProposalInput> = {}): DaoProposalInput => ({
  proposalTitle: 'Fund escrow: Landing page redesign',
  projectTitle: 'Landing page redesign',
  description: 'Redesign the marketing site.',
  category: 'Design',
  token: 'USDC',
  tokenAddress: USDC,
  treasuryAddress: TREASURY,
  freelancerAddress: FREELANCER,
  arbiterAddress: ARBITER,
  milestones: [
    { title: 'Wireframes', amount: 400, due_date: '2026-12-01' },
    { title: 'Final design', amount: 850.5 },
  ],
  yieldEnabled: false,
  deadline: '2026-12-31',
  votingPeriodDays: 7,
  ...over,
});

describe('buildCreateProjectArgs', () => {
  it('produces the six create_project arguments in contract order', () => {
    const args = buildCreateProjectArgs({
      clientAddress: TREASURY,
      freelancerAddress: FREELANCER,
      arbiterAddress: ARBITER,
      tokenAddress: USDC,
      milestoneAmounts: [400, 850.5],
      yieldEnabled: true,
    });
    expect(args).toHaveLength(CREATE_PROJECT_ARG_NAMES.length);
    expect(Address.fromScVal(args[0]).toString()).toBe(TREASURY);
    expect(Address.fromScVal(args[1]).toString()).toBe(FREELANCER);
    expect(Address.fromScVal(args[2]).toString()).toBe(ARBITER);
    expect(Address.fromScVal(args[3]).toString()).toBe(USDC);
    expect(scValToNative(args[5])).toBe(true);
  });

  it('scales milestone amounts to 7-decimal i128 stroops', () => {
    const [, , , , milestones] = buildCreateProjectArgs({
      clientAddress: TREASURY,
      milestoneAmounts: [400, 850.5, 0.0000001],
    });
    expect(scValToNative(milestones)).toEqual([BigInt(4_000_000_000), BigInt(8_505_000_000), BigInt(1)]);
    expect(AMOUNT_SCALE).toBe(10_000_000);
  });

  it('encodes a missing freelancer as void (Option::None) and applies arbiter/token defaults', () => {
    const args = buildCreateProjectArgs({ clientAddress: TREASURY, milestoneAmounts: [1] });
    expect(args[1].switch().name).toBe('scvVoid');
    expect(Address.fromScVal(args[2]).toString()).toBe(DEFAULT_ARBITER_ADDRESS);
    expect(Address.fromScVal(args[3]).toString()).toBe(USDC);
    expect(scValToNative(args[5])).toBe(false);
  });
});

describe('encodeCreateProjectInvocation', () => {
  const params = {
    clientAddress: TREASURY,
    freelancerAddress: FREELANCER,
    arbiterAddress: ARBITER,
    tokenAddress: USDC,
    milestoneAmounts: [400, 850.5],
    yieldEnabled: false,
  };

  it('round-trips: the host function XDR decodes to the same contract, function and args', () => {
    const payload = encodeCreateProjectInvocation(params);
    const host = xdr.HostFunction.fromXDR(payload.hostFunctionXdr, 'base64');
    expect(host.switch().name).toBe('hostFunctionTypeInvokeContract');

    const call = host.invokeContract();
    expect(Address.fromScAddress(call.contractAddress()).toString()).toBe(DEFAULT_ESCROW_CONTRACT_ID);
    expect(call.functionName().toString()).toBe('create_project');
    expect(call.args().map((a) => a.toXDR('base64'))).toEqual(
      buildCreateProjectArgs(params).map((a) => a.toXDR('base64'))
    );
  });

  it('labels every argument with the contract parameter name and its own XDR', () => {
    const payload = encodeCreateProjectInvocation(params);
    expect(payload.args.map((a) => a.name)).toEqual([...CREATE_PROJECT_ARG_NAMES]);
    payload.args.forEach((a) => {
      expect(() => xdr.ScVal.fromXDR(a.xdr, 'base64')).not.toThrow();
    });
    expect(payload.args[0].value).toBe(TREASURY);
    expect(payload.args[1].value).toBe(FREELANCER);
    expect(payload.args[4].value).toBe('[400, 850.5]');
  });

  it('targets a custom contract and shows None for an unassigned freelancer', () => {
    const other = Address.contract(Buffer.alloc(32, 7)).toString();
    const payload = encodeCreateProjectInvocation({ ...params, freelancerAddress: undefined, contractAddress: other });
    expect(payload.contractId).toBe(other);
    expect(payload.args[1].value).toBe('None');
  });
});

describe('validateDaoProposalInput', () => {
  it('accepts a complete proposal, including a contract-account treasury', () => {
    expect(validateDaoProposalInput(input())).toEqual({});
    expect(validateDaoProposalInput(input({ treasuryAddress: USDC }))).toEqual({});
  });

  it('flags missing and malformed addresses', () => {
    const e = validateDaoProposalInput(
      input({ treasuryAddress: '', freelancerAddress: 'nope', arbiterAddress: 'GBAD', tokenAddress: 'x' })
    );
    expect(e.treasuryAddress).toMatch(/required/);
    expect(e.freelancerAddress).toMatch(/valid Stellar address/);
    expect(e.arbiterAddress).toMatch(/valid Stellar address/);
    expect(e.tokenAddress).toBeDefined();
    expect(validateDaoProposalInput(input({ treasuryAddress: 'GNOTREAL' })).treasuryAddress).toMatch(/valid/);
  });

  it('treats freelancer and arbiter as optional', () => {
    expect(validateDaoProposalInput(input({ freelancerAddress: '', arbiterAddress: undefined }))).toEqual({});
  });

  it('rejects empty, zero, negative, NaN and sub-stroop milestone amounts', () => {
    expect(validateDaoProposalInput(input({ milestones: [] })).milestones).toMatch(/at least one/);
    for (const bad of [0, -5, NaN, Infinity]) {
      expect(validateDaoProposalInput(input({ milestones: [{ title: 'x', amount: bad }] })).milestones).toBeDefined();
    }
    expect(validateDaoProposalInput(input({ milestones: [{ title: 'x', amount: 1e-9 }] })).milestones).toMatch(
      /7 decimal/
    );
  });

  it('bounds the voting period to whole days between 1 and 90', () => {
    for (const bad of [0, 91, 1.5, NaN]) {
      expect(validateDaoProposalInput(input({ votingPeriodDays: bad })).votingPeriodDays).toBeDefined();
    }
    expect(validateDaoProposalInput(input({ votingPeriodDays: 1 }))).toEqual({});
    expect(validateDaoProposalInput(input({ votingPeriodDays: 90 }))).toEqual({});
  });

  it('requires titles', () => {
    const e = validateDaoProposalInput(input({ proposalTitle: '  ', projectTitle: '' }));
    expect(e.proposalTitle).toBeDefined();
    expect(e.projectTitle).toBeDefined();
  });

  it('isValidStellarAddress accepts G and C strkeys only', () => {
    expect(isValidStellarAddress(TREASURY)).toBe(true);
    expect(isValidStellarAddress(USDC)).toBe(true);
    expect(isValidStellarAddress('')).toBe(false);
    expect(isValidStellarAddress(TREASURY.slice(0, -1) + 'A')).toBe(false); // bad checksum
  });
});

describe('totalAmount', () => {
  it('sums in scaled integers so float drift never reaches the proposal', () => {
    expect(totalAmount({ milestones: [{ title: 'a', amount: 0.1 }, { title: 'b', amount: 0.2 }] })).toBe(0.3);
    expect(totalAmount(input())).toBe(1250.5);
  });
});

describe('buildDaoProposalMarkdown', () => {
  it('lays out summary, terms table, parties, voting and the executable payload', () => {
    const md = buildDaoProposalMarkdown(input());
    expect(md).toContain('# Fund escrow: Landing page redesign');
    expect(md).toContain('**1,250.5 USDC**');
    expect(md).toContain('| 1 | Wireframes | 400 USDC | 2026-12-01 |');
    expect(md).toContain('| 2 | Final design | 850.5 USDC | n/a |');
    expect(md).toContain('| | **Total** | **1,250.5 USDC** | |');
    expect(md).toContain(`\`${TREASURY}\``);
    expect(md).toContain(`\`${FREELANCER}\``);
    expect(md).toContain(`\`${ARBITER}\``);
    expect(md).toContain('**Voting period:** 7 days');
    expect(md).toContain(`contract \`${DEFAULT_ESCROW_CONTRACT_ID}\``);
    expect(md).toContain('`create_project`');
    expect(md).toContain('| `milestone_amounts` | `[400, 850.5]` |');
    expect(md).toContain(buildDaoInvocation(input()).hostFunctionXdr);
  });

  it('describes an unassigned freelancer, default arbiter and singular voting period', () => {
    const md = buildDaoProposalMarkdown(input({ freelancerAddress: '', arbiterAddress: '', votingPeriodDays: 1 }));
    expect(md).toContain('Unassigned (bound after the proposal executes)');
    expect(md).toContain(`\`${DEFAULT_ARBITER_ADDRESS}\``);
    expect(md).toContain('**Voting period:** 1 day\n');
  });

  it('reflects the yield setting', () => {
    expect(buildDaoProposalMarkdown(input({ yieldEnabled: true }))).toContain('**Yield on idle funds:** Enabled');
    expect(buildDaoProposalMarkdown(input())).toContain('**Yield on idle funds:** Disabled');
  });

  it('keeps user-supplied text from breaking the table or injecting markup', () => {
    const md = buildDaoProposalMarkdown(
      input({
        milestones: [{ title: 'Evil | row\nnew line', amount: 10 }],
        description: '# Fake heading\n<script>alert(1)</script>',
      })
    );
    expect(md).toContain('| 1 | Evil \\| row new line | 10 USDC | n/a |');
    expect(md).toContain('> # Fake heading');
    expect(md).toContain('> &lt;script>alert(1)&lt;/script>');
    expect(md).not.toContain('<script>');
    expect(md.split('\n').filter((l) => l.startsWith('# '))).toHaveLength(1); // only the real H1
  });

  it('notes a missing description instead of an empty section', () => {
    expect(buildDaoProposalMarkdown(input({ description: '   ' }))).toContain('_No description provided._');
  });

  it('escapeMarkdownCell escapes pipes and backslashes and flattens newlines', () => {
    expect(escapeMarkdownCell('a|b\\c\r\nd')).toBe('a\\|b\\\\c d');
  });
});

describe('buildDaoCalldataJson', () => {
  it('emits parseable calldata that matches the invocation', () => {
    const json = JSON.parse(buildDaoCalldataJson(input()));
    const invocation = buildDaoInvocation(input());
    expect(json).toMatchObject({
      network: 'stellar',
      contractId: DEFAULT_ESCROW_CONTRACT_ID,
      function: 'create_project',
      hostFunctionXdr: invocation.hostFunctionXdr,
      amountScale: 10_000_000,
      totalAmount: 1250.5,
      token: { symbol: 'USDC', address: USDC },
    });
    expect(json.args).toEqual(invocation.args);
    expect(json.args).toHaveLength(6);
  });

  it('is deterministic for identical terms', () => {
    expect(buildDaoCalldataJson(input())).toBe(buildDaoCalldataJson(input()));
  });
});
