/**
 * Escrow lifecycle model (#303).
 *
 * The Soroban escrow contract moves a project through a fixed set of states.
 * This module is the single source of truth for the graph labels, the
 * transition metadata shown in tooltips, and the derivation of the active
 * state from a project payload.
 */

export type EscrowLifecycleState =
  | 'draft'
  | 'funded'
  | 'in_progress'
  | 'in_review'
  | 'released'
  | 'disputed'
  | 'refunded';

export type LifecycleSigner = 'client' | 'freelancer' | 'arbiter';

export interface EscrowLifecycleNode {
  id: EscrowLifecycleState;
  label: string;
  /** Short summary rendered inside the node. */
  summary: string;
  /** Event that moves the escrow into this state. */
  trigger: string;
  /** Wallets that must authorise the transition. */
  signers: LifecycleSigner[];
  /** On-chain or state condition that must hold before transitioning. */
  conditions: string[];
  /** Terminal states have no outgoing transitions. */
  terminal?: boolean;
  position: { x: number; y: number };
}

export interface EscrowLifecycleEdge {
  from: EscrowLifecycleState;
  to: EscrowLifecycleState;
  label: string;
}

export const LIFECYCLE_NODE_WIDTH = 164;
export const LIFECYCLE_NODE_HEIGHT = 74;
export const LIFECYCLE_VIEWBOX = { width: 1050, height: 340 };

export const LIFECYCLE_COLORS: Record<EscrowLifecycleState, string> = {
  draft: '#94a3b8',
  funded: '#38bdf8',
  in_progress: '#818cf8',
  in_review: '#fbbf24',
  released: '#34d399',
  disputed: '#f87171',
  refunded: '#c084fc',
};

export const ESCROW_LIFECYCLE_NODES: EscrowLifecycleNode[] = [
  {
    id: 'draft',
    label: 'Draft',
    summary: 'Scope & milestones',
    trigger: 'Client creates the escrow project and defines deliverable milestones.',
    signers: ['client'],
    conditions: ['Project status is draft', 'No funds locked on-chain'],
    position: { x: 30, y: 60 },
  },
  {
    id: 'funded',
    label: 'Funded',
    summary: 'Budget locked',
    trigger: 'Client deposits and locks the total budget in the Soroban escrow contract.',
    signers: ['client'],
    conditions: ['Escrow balance equals the project budget', 'Contract invocation succeeded'],
    position: { x: 250, y: 60 },
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    summary: 'Work underway',
    trigger: 'Client assigns the winning freelancer and work begins.',
    signers: ['client'],
    conditions: ['Freelancer wallet bound on-chain', 'Milestones pending or in revision'],
    position: { x: 470, y: 60 },
  },
  {
    id: 'in_review',
    label: 'In Review',
    summary: 'Deliverable submitted',
    trigger: 'Freelancer submits a deliverable for the current milestone.',
    signers: ['freelancer'],
    conditions: ['At least one milestone has status submitted', 'Deliverable hash recorded'],
    position: { x: 690, y: 60 },
  },
  {
    id: 'released',
    label: 'Released',
    summary: 'Escrow settled',
    trigger: 'Client approves the final milestone, or auto-release fires after the review window.',
    signers: ['client', 'freelancer'],
    conditions: ['All milestones approved', 'Remaining escrow balance released'],
    terminal: true,
    position: { x: 900, y: 60 },
  },
  {
    id: 'disputed',
    label: 'Disputed',
    summary: 'Funds frozen',
    trigger: 'Either party raises a dispute, or a revision escalation is opened.',
    signers: ['client', 'freelancer'],
    conditions: ['Escrow balance is frozen', 'Arbiter quorum required to settle'],
    position: { x: 580, y: 235 },
  },
  {
    id: 'refunded',
    label: 'Refunded',
    summary: 'Funds returned',
    trigger: 'Mutual cancellation, arbiter split, or the 14-day timeout refund executes.',
    signers: ['client', 'freelancer', 'arbiter'],
    conditions: ['Settlement split signed', 'Remaining balance returned to the client'],
    terminal: true,
    position: { x: 810, y: 235 },
  },
];

export const ESCROW_LIFECYCLE_EDGES: EscrowLifecycleEdge[] = [
  { from: 'draft', to: 'funded', label: 'Deposit & lock' },
  { from: 'funded', to: 'in_progress', label: 'Assign freelancer' },
  { from: 'in_progress', to: 'in_review', label: 'Submit milestone' },
  { from: 'in_review', to: 'released', label: 'Approve all' },
  { from: 'in_review', to: 'disputed', label: 'Escalate' },
  { from: 'in_progress', to: 'disputed', label: 'Raise dispute' },
  { from: 'disputed', to: 'released', label: 'Arbiter rules' },
  { from: 'disputed', to: 'refunded', label: 'Refund / split' },
  { from: 'funded', to: 'refunded', label: 'Cancel before assignment' },
];

export interface LifecycleMilestoneSummary {
  total: number;
  approved: number;
  submitted: number;
  disputed: number;
  pending: number;
}

export interface EscrowLifecyclePosition {
  state: EscrowLifecycleState;
  /** ISO timestamp of the event that entered the current state, when known. */
  enteredAt?: string;
  /** Milliseconds spent in the current state, when `enteredAt` is known. */
  timeInStateMs?: number;
  nextStates: EscrowLifecycleState[];
  milestones: LifecycleMilestoneSummary;
}

type LifecycleProjectInput = {
  status?: string;
  created_at?: string;
  tx_hash?: string;
  contract_id?: string;
  project_id_onchain?: number | string | bigint;
  milestones?: Array<{
    status?: string;
    submitted_at?: string;
    auto_release_at?: string;
  }>;
};

function latestTimestamp(values: Array<string | undefined>): string | undefined {
  let latest: string | undefined;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed) || parsed <= latestMs) continue;
    latest = value;
    latestMs = parsed;
  }
  return latest;
}

export function summarizeMilestones(
  milestones: LifecycleProjectInput['milestones'] = []
): LifecycleMilestoneSummary {
  const summary: LifecycleMilestoneSummary = {
    total: milestones.length,
    approved: 0,
    submitted: 0,
    disputed: 0,
    pending: 0,
  };

  for (const milestone of milestones) {
    switch (milestone.status) {
      case 'approved':
      case 'completed':
        summary.approved += 1;
        break;
      case 'submitted':
      case 'pending_review':
        summary.submitted += 1;
        break;
      case 'disputed':
        summary.disputed += 1;
        break;
      default:
        summary.pending += 1;
    }
  }

  return summary;
}

/**
 * Resolves the escrow state visible on the project page. Projects do not store
 * every lifecycle state explicitly, so in-flight states are derived from the
 * milestone payload and the presence of an on-chain escrow.
 */
export function deriveEscrowLifecyclePosition(
  project: LifecycleProjectInput,
  now: number = Date.now()
): EscrowLifecyclePosition {
  const status = (project.status || 'draft').toLowerCase();
  const milestones = project.milestones || [];
  const summary = summarizeMilestones(milestones);
  const isFunded = Boolean(
    project.contract_id || project.tx_hash || project.project_id_onchain !== undefined
  );

  let state: EscrowLifecycleState;
  let enteredAt: string | undefined;

  switch (status) {
    case 'completed':
    case 'released':
      state = 'released';
      enteredAt = latestTimestamp(milestones.map((m) => m.auto_release_at)) || project.created_at;
      break;
    case 'disputed':
      state = 'disputed';
      enteredAt = project.created_at;
      break;
    case 'refunded':
    case 'cancelled':
    case 'canceled':
      state = 'refunded';
      enteredAt = project.created_at;
      break;
    case 'in_progress':
      state = summary.submitted > 0 ? 'in_review' : 'in_progress';
      enteredAt =
        state === 'in_review'
          ? latestTimestamp(milestones.map((m) => m.submitted_at)) || project.created_at
          : project.created_at;
      break;
    case 'open':
      state = isFunded ? 'funded' : 'draft';
      enteredAt = project.created_at;
      break;
    default:
      state = isFunded ? 'funded' : 'draft';
      enteredAt = project.created_at;
  }

  const parsedEnteredAt = enteredAt ? Date.parse(enteredAt) : Number.NaN;
  const timeInStateMs = Number.isNaN(parsedEnteredAt)
    ? undefined
    : Math.max(0, now - parsedEnteredAt);

  return {
    state,
    enteredAt,
    timeInStateMs,
    nextStates: ESCROW_LIFECYCLE_EDGES.filter((edge) => edge.from === state).map((edge) => edge.to),
    milestones: summary,
  };
}

/** Human-readable elapsed time, e.g. `2d 4h`, `3h 20m`, `just now`. */
export function formatLifecycleDuration(ms: number | undefined): string {
  if (ms === undefined || Number.isNaN(ms) || ms < 0) return '—';
  if (ms < 60_000) return 'just now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
}

export function getLifecycleNode(state: EscrowLifecycleState): EscrowLifecycleNode {
  return ESCROW_LIFECYCLE_NODES.find((node) => node.id === state) ?? ESCROW_LIFECYCLE_NODES[0];
}

/** Ordered steps used by the compact summary and progress counter. */
export const LIFECYCLE_HAPPY_PATH: EscrowLifecycleState[] = [
  'draft',
  'funded',
  'in_progress',
  'in_review',
  'released',
];
