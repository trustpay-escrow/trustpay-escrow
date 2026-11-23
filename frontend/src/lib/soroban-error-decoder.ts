/**
 * Soroban Contract Error Decoder & Diagnostic Engine
 * Maps raw Soroban RPC error codes, host errors, and Freighter wallet panics into user-friendly diagnostic guidance.
 */

export enum ContractErrorCode {
  Unauthorized = 1,
  MilestoneNotPending = 2,
  MilestoneNotSubmitted = 3,
  ProjectNotActive = 4,
  InvalidProjectState = 5,
  ProjectNotDisputed = 6,
  YieldNotEnabled = 7,
  InsufficientBalance = 8,
  InvalidMilestone = 9,
  ArbiterUnauthorized = 10,
}

export interface ErrorDefinition {
  code: number | string;
  name: string;
  title: string;
  message: string;
  suggestedFix: string;
  category: 'auth' | 'milestone' | 'state' | 'balance' | 'wallet' | 'rpc' | 'unknown';
}

export interface DecodedSorobanError {
  rawError: string;
  code: number | string;
  name: string;
  title: string;
  message: string;
  suggestedFix: string;
  category: 'auth' | 'milestone' | 'state' | 'balance' | 'wallet' | 'rpc' | 'unknown';
  technicalDetails?: string;
  timestamp: string;
}

export const KNOWN_CONTRACT_ERRORS: Record<number, ErrorDefinition> = {
  [ContractErrorCode.Unauthorized]: {
    code: 1,
    name: 'Unauthorized',
    title: 'Authorization Failed',
    message: 'The caller is not authorized to execute this escrow contract action.',
    suggestedFix: 'Switch your Freighter wallet to the authorized client, freelancer, or arbiter account for this project.',
    category: 'auth',
  },
  [ContractErrorCode.MilestoneNotPending]: {
    code: 2,
    name: 'MilestoneNotPending',
    title: 'Milestone Not Pending',
    message: 'This milestone cannot be submitted because it is already submitted, under review, or already approved.',
    suggestedFix: 'Review the current milestone status in your dashboard. If already submitted, await client review.',
    category: 'milestone',
  },
  [ContractErrorCode.MilestoneNotSubmitted]: {
    code: 3,
    name: 'MilestoneNotCompleted',
    title: 'Milestone Not Submitted',
    message: 'Milestone is already approved or has not been submitted by the freelancer yet.',
    suggestedFix: 'The freelancer must submit their deliverable proofs before the client can release funds for this milestone.',
    category: 'milestone',
  },
  [ContractErrorCode.ProjectNotActive]: {
    code: 4,
    name: 'InvalidState',
    title: 'Project Inactive',
    message: 'The escrow contract is not currently active (it may be completed, disputed, or cancelled).',
    suggestedFix: 'Refresh your dashboard to inspect the current on-chain status of this project.',
    category: 'state',
  },
  [ContractErrorCode.InvalidProjectState]: {
    code: 5,
    name: 'InvalidProjectState',
    title: 'Invalid Escrow State',
    message: 'The project state does not permit this operation. Project must be active or disputed.',
    suggestedFix: 'Verify the current project phase before initiating payouts or yield accruals.',
    category: 'state',
  },
  [ContractErrorCode.ProjectNotDisputed]: {
    code: 6,
    name: 'ProjectNotDisputed',
    title: 'Project Not in Dispute',
    message: 'Arbiter resolution can only be executed on escrows that are in an active dispute state.',
    suggestedFix: 'If consensus cannot be reached, the client or freelancer must first raise a dispute.',
    category: 'state',
  },
  [ContractErrorCode.YieldNotEnabled]: {
    code: 7,
    name: 'YieldNotEnabled',
    title: 'Blend Yield Strategy Disabled',
    message: 'Blend Protocol yield generation is not enabled for this project.',
    suggestedFix: 'Yield can only be accrued and split for escrows configured with the 70/30 yield strategy during creation.',
    category: 'state',
  },
  [ContractErrorCode.InsufficientBalance]: {
    code: 8,
    name: 'InsufficientBalance',
    title: 'Insufficient Token Balance',
    message: 'Your wallet has insufficient token balance or trustline limit to complete this escrow operation.',
    suggestedFix: 'Ensure your Stellar wallet has enough tokens (USDC/EURC/PYUSD/XLM) and minimum reserve balance to cover network fees.',
    category: 'balance',
  },
  [ContractErrorCode.InvalidMilestone]: {
    code: 9,
    name: 'InvalidMilestone',
    title: 'Invalid Milestone Index',
    message: 'The specified milestone index does not exist in this project.',
    suggestedFix: 'Select a valid milestone from the project details page.',
    category: 'milestone',
  },
  [ContractErrorCode.ArbiterUnauthorized]: {
    code: 10,
    name: 'ArbiterUnauthorized',
    title: 'Arbiter Signature Required',
    message: 'Only the assigned neutral arbiter can resolve escrow disputes.',
    suggestedFix: 'Connect with the arbiter Stellar address designated at project creation.',
    category: 'auth',
  },
};

/**
 * Extracts a numeric Soroban contract error code from various string patterns.
 * e.g., "HostError: Error(Contract, #2)", "Error(Contract, #3)", "ContractError(1)"
 */
export function extractContractErrorCode(errorStr: string): number | null {
  if (!errorStr) return null;

  // Pattern 1: Error(Contract, #X) or Error(Contract, #123)
  const contractHashMatch = errorStr.match(/Error\(Contract,\s*#(\d+)\)/i);
  if (contractHashMatch && contractHashMatch[1]) {
    return parseInt(contractHashMatch[1], 10);
  }

  // Pattern 2: Error(Contract, X)
  const contractMatch = errorStr.match(/Error\(Contract,\s*(\d+)\)/i);
  if (contractMatch && contractMatch[1]) {
    return parseInt(contractMatch[1], 10);
  }

  // Pattern 3: ContractError(X) or contract_error: X
  const contractErrorMatch = errorStr.match(/contract[_\s]?error[^\d]*(\d+)/i);
  if (contractErrorMatch && contractErrorMatch[1]) {
    return parseInt(contractErrorMatch[1], 10);
  }

  // Pattern 4: Contract panic with code '#X'
  const hashNumberMatch = errorStr.match(/#(\d+)\b/);
  if (hashNumberMatch && hashNumberMatch[1]) {
    return parseInt(hashNumberMatch[1], 10);
  }

  return null;
}

/**
 * Parses and decodes any Soroban RPC, Freighter, or contract error into a structured diagnostic object.
 */
export function decodeSorobanError(raw: any): DecodedSorobanError {
  const timestamp = new Date().toISOString();
  const rawString =
    typeof raw === 'string'
      ? raw
      : raw?.message || raw?.error || JSON.stringify(raw) || 'Unknown error occurred';

  // 1. Check for specific contract code pattern (#1..#10)
  const numericCode = extractContractErrorCode(rawString);
  if (numericCode !== null && KNOWN_CONTRACT_ERRORS[numericCode]) {
    const known = KNOWN_CONTRACT_ERRORS[numericCode];
    return {
      rawError: rawString,
      code: known.code,
      name: known.name,
      title: known.title,
      message: known.message,
      suggestedFix: known.suggestedFix,
      category: known.category,
      technicalDetails: `Contract Panic Code #${numericCode} [${known.name}]`,
      timestamp,
    };
  }

  // 2. Check for string assertion messages in Soroban smart contracts
  const lower = rawString.toLowerCase();

  if (lower.includes('milestone not submitted') || lower.includes('already approved')) {
    const err = KNOWN_CONTRACT_ERRORS[ContractErrorCode.MilestoneNotSubmitted];
    return {
      rawError: rawString,
      code: err.code,
      name: err.name,
      title: err.title,
      message: err.message,
      suggestedFix: err.suggestedFix,
      category: err.category,
      technicalDetails: rawString,
      timestamp,
    };
  }

  if (lower.includes('milestone not pending') || lower.includes('already submitted')) {
    const err = KNOWN_CONTRACT_ERRORS[ContractErrorCode.MilestoneNotPending];
    return {
      rawError: rawString,
      code: err.code,
      name: err.name,
      title: err.title,
      message: err.message,
      suggestedFix: err.suggestedFix,
      category: err.category,
      technicalDetails: rawString,
      timestamp,
    };
  }

  if (lower.includes('project is not active') || lower.includes('project not active')) {
    const err = KNOWN_CONTRACT_ERRORS[ContractErrorCode.ProjectNotActive];
    return {
      rawError: rawString,
      code: err.code,
      name: err.name,
      title: err.title,
      message: err.message,
      suggestedFix: err.suggestedFix,
      category: err.category,
      technicalDetails: rawString,
      timestamp,
    };
  }

  if (lower.includes('project is not disputed')) {
    const err = KNOWN_CONTRACT_ERRORS[ContractErrorCode.ProjectNotDisputed];
    return {
      rawError: rawString,
      code: err.code,
      name: err.name,
      title: err.title,
      message: err.message,
      suggestedFix: err.suggestedFix,
      category: err.category,
      technicalDetails: rawString,
      timestamp,
    };
  }

  if (lower.includes('not authorized') || lower.includes('require_auth')) {
    const err = KNOWN_CONTRACT_ERRORS[ContractErrorCode.Unauthorized];
    return {
      rawError: rawString,
      code: err.code,
      name: err.name,
      title: err.title,
      message: err.message,
      suggestedFix: err.suggestedFix,
      category: err.category,
      technicalDetails: rawString,
      timestamp,
    };
  }

  if (lower.includes('insufficient balance') || lower.includes('underfunded') || lower.includes('balance too low')) {
    const err = KNOWN_CONTRACT_ERRORS[ContractErrorCode.InsufficientBalance];
    return {
      rawError: rawString,
      code: err.code,
      name: err.name,
      title: err.title,
      message: err.message,
      suggestedFix: err.suggestedFix,
      category: err.category,
      technicalDetails: rawString,
      timestamp,
    };
  }

  // 3. User Rejected in Freighter Wallet
  if (
    lower.includes('user declined') ||
    lower.includes('declined to sign') ||
    lower.includes('rejected by user') ||
    lower.includes('user cancelled')
  ) {
    return {
      rawError: rawString,
      code: 'USER_REJECTED',
      name: 'UserRejected',
      title: 'Transaction Cancelled',
      message: 'You declined the transaction signature request in Freighter.',
      suggestedFix: 'Re-trigger the action and click "Sign" or "Approve" in the Freighter popup window.',
      category: 'wallet',
      technicalDetails: rawString,
      timestamp,
    };
  }

  // 4. Freighter Not Connected / Missing
  if (lower.includes('freighter') && (lower.includes('not installed') || lower.includes('not connected'))) {
    return {
      rawError: rawString,
      code: 'WALLET_DISCONNECTED',
      name: 'FreighterNotInstalled',
      title: 'Freighter Extension Required',
      message: 'Freighter wallet extension was not detected or is not connected to this dApp.',
      suggestedFix: 'Install Freighter from https://www.freighter.app and ensure your wallet is unlocked.',
      category: 'wallet',
      technicalDetails: rawString,
      timestamp,
    };
  }

  // 5. Host Error (WasmVm / Budget / Storage)
  if (lower.includes('hosterror') || lower.includes('wasmi') || lower.includes('wasmvmpanic')) {
    return {
      rawError: rawString,
      code: 'HOST_VM_ERROR',
      name: 'SorobanHostError',
      title: 'Soroban VM Execution Error',
      message: 'The Stellar Soroban host environment encountered a VM or resource limit error.',
      suggestedFix: 'Check that invocation parameters and token addresses are valid Soroban contracts.',
      category: 'rpc',
      technicalDetails: rawString,
      timestamp,
    };
  }

  // 6. Generic Network / RPC Failure
  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('timeout')) {
    return {
      rawError: rawString,
      code: 'NETWORK_ERROR',
      name: 'StellarRpcError',
      title: 'Stellar RPC Network Timeout',
      message: 'Unable to reach the Stellar Soroban RPC node to simulate or submit the transaction.',
      suggestedFix: 'Verify your internet connection and check if the Stellar Testnet is currently undergoing maintenance.',
      category: 'rpc',
      technicalDetails: rawString,
      timestamp,
    };
  }

  // 7. Generic Fallback
  return {
    rawError: rawString,
    code: 'UNKNOWN_ERROR',
    name: 'UnknownContractError',
    title: 'Transaction Reverted',
    message: rawString.length > 120 ? `${rawString.slice(0, 117)}...` : rawString,
    suggestedFix: 'Click "View Details" and copy the diagnostic report to send to TrustPay support.',
    category: 'unknown',
    technicalDetails: rawString,
    timestamp,
  };
}

/**
 * Formats a decoded error report into formatted JSON for copying to clipboard or bug reports.
 */
export function formatDiagnosticsJson(decoded: DecodedSorobanError): string {
  return JSON.stringify(
    {
      app: 'TrustPay Escrow',
      type: 'SOROBAN_TRANSACTION_DIAGNOSTICS',
      timestamp: decoded.timestamp,
      errorCode: decoded.code,
      errorName: decoded.name,
      title: decoded.title,
      friendlyExplanation: decoded.message,
      suggestedRemediation: decoded.suggestedFix,
      category: decoded.category,
      rawError: decoded.rawError,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/SSR',
    },
    null,
    2
  );
}

/**
 * Copies diagnostic error payload to user clipboard.
 */
export async function copyDiagnosticsToClipboard(decoded: DecodedSorobanError): Promise<boolean> {
  const payload = formatDiagnosticsJson(decoded);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(payload);
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

