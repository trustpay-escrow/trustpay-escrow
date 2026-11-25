import {
  rpc,
  Account,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  Horizon,
  StrKey,
} from '@stellar/stellar-sdk';
import { signTransaction, isConnected } from '@stellar/freighter-api';
import { SUPPORTED_TOKENS } from '@/config/tokens';
import { parseFeeStats, type HorizonFeeStats, type NetworkFees } from '@/lib/fee-estimator';
import {
  isFeeBumpRequested,
  clearFeeBumpReplacements,
  getFeeBumpReplacements,
  type PendingSorobanTransaction,
} from '@/lib/transaction-speedup';

export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';

export const STELLAR_NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;

export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';

// Default Escrow contract address on Stellar Testnet
export const DEFAULT_ESCROW_CONTRACT_ID =
  process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

// Default designated Arbiter public key
export const DEFAULT_ARBITER_ADDRESS =
  process.env.NEXT_PUBLIC_DEFAULT_ARBITER_ADDRESS || 'GDFLMVB4TWEBF3EXD66IYLCZE2G75JWZ5ICPKBWPEW7EE5CCLJQGFHAX';

/**
 * Returns a configured instance of Soroban RPC Server
 */
export function getSorobanRpcServer(): rpc.Server {
  return new rpc.Server(SOROBAN_RPC_URL, {
    allowHttp: SOROBAN_RPC_URL.startsWith('http://'),
  });
}

export interface AmmPoolReserveSnapshot {
  reserveBase: number;
  reserveQuote: number;
}

function readReserveAmount(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

export function parseAmmReserves(value: unknown, reserveDecimals = 7): AmmPoolReserveSnapshot {
  const scale = 10 ** Math.max(0, Number.isFinite(reserveDecimals) ? reserveDecimals : 7);
  let rawBase: unknown;
  let rawQuote: unknown;

  if (Array.isArray(value)) {
    rawBase = value[0];
    rawQuote = value[1];
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    rawBase = record.reserveBase ?? record.reserve_base ?? record.reserveA ?? record.reserve_a ?? record.base ?? record[0];
    rawQuote = record.reserveQuote ?? record.reserve_quote ?? record.reserveB ?? record.reserve_b ?? record.quote ?? record[1];
  }

  const reserveBase = readReserveAmount(rawBase) / scale;
  const reserveQuote = readReserveAmount(rawQuote) / scale;
  if (reserveBase <= 0 || reserveQuote <= 0) {
    throw new Error('AMM pool returned invalid reserve values.');
  }
  return { reserveBase, reserveQuote };
}

/**
 * Simulates a read-only `get_reserves` call against a constant-product AMM pool contract.
 */
export async function fetchAmmPoolReserves(options: {
  contractAddress: string;
  sourceAccount?: string;
  reserveDecimals?: number;
  functionName?: string;
}): Promise<AmmPoolReserveSnapshot> {
  const {
    contractAddress,
    sourceAccount = DEFAULT_ARBITER_ADDRESS,
    reserveDecimals = 7,
    functionName = 'get_reserves',
  } = options;
  if (!contractAddress) {
    throw new Error('No AMM pool contract is configured for this token pair.');
  }

  const server = getSorobanRpcServer();
  const account = new Account(sourceAccount, '0');
  const transaction = new TransactionBuilder(account, {
    fee: '10000',
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractAddress,
        function: functionName,
        args: [],
      })
    )
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`AMM pool simulation failed: ${simulation.error}`);
  }
  const returnValue = simulation.result?.retval;
  if (!returnValue) {
    throw new Error('AMM pool simulation returned no reserve data.');
  }
  return parseAmmReserves(scValToNative(returnValue), reserveDecimals);
}

/**
 * Returns a Stellar.Expert explorer link for a transaction hash or contract address
 */
export function getStellarExplorerUrl(id: string, type: 'tx' | 'contract' | 'account' = 'tx'): string {
  const isTestnet = STELLAR_NETWORK_PASSPHRASE === Networks.TESTNET;
  const networkSegment = isTestnet ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${networkSegment}/${type}/${id}`;
}

/**
 * Verifies that the Stellar account exists on the network, requesting testnet Friendbot funding if needed.
 */
export async function ensureAccountExists(accountAddress: string): Promise<void> {
  const server = getSorobanRpcServer();
  try {
    await server.getAccount(accountAddress);
  } catch (err: any) {
    if (STELLAR_NETWORK_PASSPHRASE === Networks.TESTNET) {
      try {
        const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(accountAddress)}`);
        if (res.ok) {
          // Allow ledger to propagate Friendbot funding
          await new Promise((resolve) => setTimeout(resolve, 2500));
          return;
        }
      } catch {
        // Fallthrough to standard error
      }
      throw new Error(
        `Account ${accountAddress.slice(0, 6)}...${accountAddress.slice(-4)} is not funded on Stellar Testnet. Fund it with test XLM first.`
      );
    }
    throw new Error(`Account ${accountAddress} does not exist on the Stellar network.`);
  }
}

export type TxStage = 'preparing' | 'simulating' | 'signing' | 'submitting' | 'polling' | 'success' | 'error';
export type TxStatusCallback = (
  stage: TxStage,
  message: string,
  pendingTransaction?: PendingSorobanTransaction
) => void;

export interface SorobanTxResult {
  success: boolean;
  txHash: string;
  returnValue?: any;
  error?: string;
}

/** Inclusion fee used when no speed preset has been selected, in stroops. */
export const DEFAULT_SOROBAN_BASE_FEE = 100000;

let selectedBaseFee: number | null = null;

/**
 * Sets the inclusion fee (stroops) applied to every Soroban invocation envelope
 * built by `invokeSorobanMethod`. Pass `null` to go back to the default (#256).
 */
export function setSorobanBaseFee(stroops: number | null): void {
  selectedBaseFee = stroops !== null && Number.isFinite(stroops) && stroops >= 100 ? Math.ceil(stroops) : null;
}

export function getSorobanBaseFee(): number | null {
  return selectedBaseFee;
}

/** Fetches current fee statistics (last 5 ledgers) from Horizon (#256). */
export async function fetchHorizonFeeStats(horizonUrl: string = HORIZON_URL): Promise<NetworkFees> {
  const response = await fetch(`${horizonUrl.replace(/\/+$/, '')}/fee_stats`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Horizon fee_stats responded with ${response.status}`);
  return parseFeeStats((await response.json()) as HorizonFeeStats);
}

/**
 * Generalized Soroban smart contract invoker:
 * 1. Validates Freighter wallet extension
 * 2. Fetches on-chain account sequence number
 * 3. Builds invocation operation
 * 4. Simulates and prepares transaction via Soroban RPC
 * 5. Requests user signature through Freighter
 * 6. Broadcasts transaction and polls until ledger finality
 */
export async function invokeSorobanMethod(options: {
  callerAddress: string;
  contractAddress?: string;
  functionName: string;
  args: xdr.ScVal[];
  onStatusUpdate?: TxStatusCallback;
  /** Inclusion (base) fee in stroops. Defaults to the fee chosen in the gas estimator (#256). */
  baseFee?: number | string;
}): Promise<SorobanTxResult> {
  const { callerAddress, functionName, args, onStatusUpdate } = options;
  const inclusionFee = String(options.baseFee ?? getSorobanBaseFee() ?? DEFAULT_SOROBAN_BASE_FEE);
  const targetContract = options.contractAddress || DEFAULT_ESCROW_CONTRACT_ID;

  onStatusUpdate?.('preparing', 'Validating wallet connection and account status...');

  // 1. Verify Freighter is installed and ready
  if (!(await isConnected())) {
    throw new Error('Freighter wallet extension is not detected. Please install and unlock Freighter.');
  }

  // 2. Ensure account exists on ledger
  await ensureAccountExists(callerAddress);

  const server = getSorobanRpcServer();
  const sourceAccount = await server.getAccount(callerAddress);

  onStatusUpdate?.('simulating', `Simulating contract call '${functionName}'...`);

  // 3. Build un-simulated Soroban transaction
  const baseTx = new TransactionBuilder(sourceAccount, {
    fee: inclusionFee,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: targetContract,
        function: functionName,
        args,
      })
    )
    .setTimeout(180)
    .build();

  // 4. Simulate & assemble footprint, auth, and resource fees via RPC
  let preparedTx: any;
  try {
    preparedTx = await server.prepareTransaction(baseTx);
  } catch (simErr: any) {
    const errorMsg = simErr?.message || String(simErr);
    throw new Error(`Contract simulation failed for '${functionName}': ${errorMsg}`);
  }

  onStatusUpdate?.('signing', 'Awaiting authorization signature in Freighter wallet...');

  // 5. Sign prepared transaction XDR with Freighter
  let signResult: any;
  try {
    signResult = await signTransaction(preparedTx.toXDR(), {
      networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    });
  } catch (signErr: any) {
    throw new Error(`Wallet signing cancelled or rejected: ${signErr.message || signErr}`);
  }

  let signedXdr = '';
  if (typeof signResult === 'string') {
    signedXdr = signResult;
  } else if (signResult && typeof signResult === 'object') {
    if (signResult.error) {
      throw new Error(typeof signResult.error === 'string' ? signResult.error : (signResult.error.message || 'Freighter rejected signature'));
    }
    signedXdr = signResult.signedTxXdr || signResult.signedTransaction || '';
  }

  if (!signedXdr) {
    throw new Error('Transaction signing was rejected or returned empty XDR.');
  }

  onStatusUpdate?.('submitting', 'Broadcasting transaction to Stellar network...');

  // 6. Broadcast signed transaction to Soroban RPC
  const signedTx = TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE);
  const sendRes = await server.sendTransaction(signedTx);

  if (sendRes.status === 'ERROR') {
    const detail = sendRes.errorResult ? JSON.stringify(sendRes.errorResult) : sendRes.status;
    throw new Error(`Transaction rejected by Stellar RPC: ${detail}`);
  }

  const txHash = sendRes.hash;
  const pendingTransaction: PendingSorobanTransaction = {
    xdr: signedTx.toXDR(),
    hash: txHash,
    submittedAt: Date.now(),
  };
  onStatusUpdate?.(
    'polling',
    `Transaction submitted (tx: ${txHash.slice(0, 8)}...). Awaiting confirmation...`,
    pendingTransaction
  );

  // 7. Poll for ledger finality
  let attempts = 0;
  const normalMaxAttempts = 35; // 35 * 1.5s ~ 50 seconds
  const speedUpMaxAttempts = 80; // Keep tracking while a requested fee bump is submitted.
  while (
    attempts < normalMaxAttempts ||
    (isFeeBumpRequested(txHash) && attempts < speedUpMaxAttempts)
  ) {
    await new Promise((r) => setTimeout(r, 1500));
    const hashesToCheck = [txHash, ...getFeeBumpReplacements(txHash)];
    let originalTransactionFailed = false;
    for (const hash of hashesToCheck) {
      const txStatus = await server.getTransaction(hash);

      if (txStatus.status === 'SUCCESS') {
        let parsedReturn: any = null;
        if (txStatus.returnValue) {
          try {
            parsedReturn = scValToNative(txStatus.returnValue);
          } catch {
            parsedReturn = txStatus.returnValue;
          }
        }
        clearFeeBumpReplacements(txHash);
        onStatusUpdate?.('success', 'Transaction successfully confirmed on Stellar!');
        return {
          success: true,
          txHash: hash,
          returnValue: parsedReturn,
        };
      }

      if (hash === txHash && txStatus.status === 'FAILED') {
        originalTransactionFailed = true;
      }
    }
    if (originalTransactionFailed) {
      clearFeeBumpReplacements(txHash);
      throw new Error(`Soroban transaction failed during ledger execution (tx: ${txHash})`);
    }

    attempts++;
  }

  clearFeeBumpReplacements(txHash);
  throw new Error(`Transaction timed out while awaiting ledger inclusion (tx: ${txHash}). Please verify on Stellar.Expert.`);
}

export interface SorobanBatchCall {
  functionName: string;
  args: xdr.ScVal[];
  contractAddress?: string;
}

/**
 * invokeSorobanBatch (#308)
 *
 * Executes several contract invocations inside a single Stellar transaction so
 * enterprise clients approve/fund multiple milestones with one wallet prompt.
 * All operations share one signature and one network fee; Soroban atomicity
 * means either every milestone release lands or none of them do.
 */
export async function invokeSorobanBatch(options: {
  callerAddress: string;
  calls: SorobanBatchCall[];
  onStatusUpdate?: TxStatusCallback;
  baseFee?: number | string;
}): Promise<SorobanTxResult> {
  const { callerAddress, calls, onStatusUpdate } = options;

  if (!calls.length) {
    throw new Error('Batch invocation requires at least one contract call.');
  }
  if (!(await isConnected())) {
    throw new Error('Freighter wallet extension is not detected. Please install and unlock Freighter.');
  }

  const perOperationFee = BigInt(options.baseFee ?? getSorobanBaseFee() ?? DEFAULT_SOROBAN_BASE_FEE);

  onStatusUpdate?.('preparing', 'Validating wallet connection and account status...');
  await ensureAccountExists(callerAddress);

  const server = getSorobanRpcServer();
  const sourceAccount = await server.getAccount(callerAddress);

  const functionNames = Array.from(new Set(calls.map((call) => call.functionName)));
  onStatusUpdate?.(
    'simulating',
    calls.length === 1
      ? `Simulating contract call '${functionNames[0]}'...`
      : `Simulating ${calls.length} batched contract calls (${functionNames.join(', ')})...`
  );

  const builder = new TransactionBuilder(sourceAccount, {
    // TransactionBuilder multiplies this per-operation fee by the number of operations.
    fee: perOperationFee.toString(),
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  });

  calls.forEach((call) => {
    builder.addOperation(
      Operation.invokeContractFunction({
        contract: call.contractAddress || DEFAULT_ESCROW_CONTRACT_ID,
        function: call.functionName,
        args: call.args,
      })
    );
  });

  const baseTx = builder.setTimeout(180).build();

  let preparedTx: any;
  try {
    preparedTx = await server.prepareTransaction(baseTx);
  } catch (simErr: any) {
    const errorMsg = simErr?.message || String(simErr);
    throw new Error(`Contract simulation failed for batched call: ${errorMsg}`);
  }

  onStatusUpdate?.('signing', 'Awaiting authorization signature in Freighter wallet...');

  let signResult: any;
  try {
    signResult = await signTransaction(preparedTx.toXDR(), {
      networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    });
  } catch (signErr: any) {
    throw new Error(`Wallet signing cancelled or rejected: ${signErr.message || signErr}`);
  }

  let signedXdr = '';
  if (typeof signResult === 'string') {
    signedXdr = signResult;
  } else if (signResult && typeof signResult === 'object') {
    if (signResult.error) {
      throw new Error(
        typeof signResult.error === 'string'
          ? signResult.error
          : signResult.error.message || 'Freighter rejected signature'
      );
    }
    signedXdr = signResult.signedTxXdr || signResult.signedTransaction || '';
  }

  if (!signedXdr) {
    throw new Error('Transaction signing was rejected or returned empty XDR.');
  }

  onStatusUpdate?.('submitting', 'Broadcasting transaction to Stellar network...');

  const signedTx = TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE);
  const sendRes = await server.sendTransaction(signedTx);

  if (sendRes.status === 'ERROR') {
    const detail = sendRes.errorResult ? JSON.stringify(sendRes.errorResult) : sendRes.status;
    throw new Error(`Transaction rejected by Stellar RPC: ${detail}`);
  }

  const txHash = sendRes.hash;
  onStatusUpdate?.('polling', `Transaction submitted (tx: ${txHash.slice(0, 8)}...). Awaiting confirmation...`);

  let attempts = 0;
  const maxAttempts = 35;
  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const txStatus = await server.getTransaction(txHash);

    if (txStatus.status === 'SUCCESS') {
      let parsedReturn: any = null;
      if (txStatus.returnValue) {
        try {
          parsedReturn = scValToNative(txStatus.returnValue);
        } catch {
          parsedReturn = txStatus.returnValue;
        }
      }
      onStatusUpdate?.('success', 'Transaction successfully confirmed on Stellar!');
      return { success: true, txHash, returnValue: parsedReturn };
    }

    if (txStatus.status === 'FAILED') {
      throw new Error(`Soroban transaction failed during ledger execution (tx: ${txHash})`);
    }

    attempts++;
  }

  throw new Error(`Transaction timed out while awaiting ledger inclusion (tx: ${txHash}). Please verify on Stellar.Expert.`);
}

/**
 * Creates an on-chain escrow project and locks the milestone funds into the Soroban contract.
 */
export async function createProjectOnChain(params: {
  clientAddress: string;
  freelancerAddress?: string;
  arbiterAddress?: string;
  tokenAddress?: string;
  milestoneAmounts: number[];
  yieldEnabled?: boolean;
  contractAddress?: string;
  onStatusUpdate?: TxStatusCallback;
}): Promise<{ success: boolean; txHash: string; onChainProjectId: number | bigint }> {
  const {
    clientAddress,
    freelancerAddress,
    arbiterAddress = DEFAULT_ARBITER_ADDRESS,
    tokenAddress = SUPPORTED_TOKENS.USDC.issuerOrContractAddress,
    milestoneAmounts,
    yieldEnabled = false,
    contractAddress,
    onStatusUpdate,
  } = params;

  // Build Soroban ScVal vector of milestone amounts (scaled to 7 decimals / 10^7 stroops)
  const milestoneScVals = milestoneAmounts.map((amt) =>
    nativeToScVal(BigInt(Math.round(amt * 10_000_000)), { type: 'i128' })
  );

  const freelancerScVal = freelancerAddress
    ? Address.fromString(freelancerAddress).toScVal()
    : xdr.ScVal.scvVoid();

  const args: xdr.ScVal[] = [
    Address.fromString(clientAddress).toScVal(),
    freelancerScVal,
    Address.fromString(arbiterAddress).toScVal(),
    Address.fromString(tokenAddress).toScVal(),
    xdr.ScVal.scvVec(milestoneScVals),
    nativeToScVal(Boolean(yieldEnabled), { type: 'bool' }),
  ];

  const result = await invokeSorobanMethod({
    callerAddress: clientAddress,
    contractAddress,
    functionName: 'create_project',
    args,
    onStatusUpdate,
  });

  const onChainProjectId = result.returnValue !== undefined ? result.returnValue : 1;

  return {
    success: true,
    txHash: result.txHash,
    onChainProjectId,
  };
}

/**
 * Option A (Deposit on Award): Client locks milestone escrow and binds winning freelancer in one atomic transaction.
 */
export async function lockEscrowOnChain(params: {
  clientAddress: string;
  freelancerAddress: string;
  arbiterAddress?: string;
  tokenAddress?: string;
  milestoneAmounts: number[];
  yieldEnabled?: boolean;
  contractAddress?: string;
  onStatusUpdate?: TxStatusCallback;
}): Promise<{ success: boolean; txHash: string; onChainProjectId: number | bigint }> {
  return createProjectOnChain(params);
}

/**
 * Option B (Unassigned Escrow Contract): Binds a winning freelancer to an upfront-funded escrow project.
 */
export async function assignFreelancerOnChain(params: {
  clientAddress: string;
  projectIdOnChain: number | bigint | string;
  freelancerAddress: string;
  contractAddress?: string;
  onStatusUpdate?: TxStatusCallback;
}): Promise<SorobanTxResult> {
  const {
    clientAddress,
    projectIdOnChain,
    freelancerAddress,
    contractAddress,
    onStatusUpdate,
  } = params;

  const args: xdr.ScVal[] = [
    nativeToScVal(BigInt(projectIdOnChain), { type: 'u64' }),
    Address.fromString(freelancerAddress).toScVal(),
  ];

  return invokeSorobanMethod({
    callerAddress: clientAddress,
    contractAddress,
    functionName: 'assign_freelancer',
    args,
    onStatusUpdate,
  });
}

/**
 * Option B: Cancels an unassigned project and refunds 100% of deposited escrow funds to the client.
 */
export async function cancelUnassignedProjectOnChain(params: {
  clientAddress: string;
  projectIdOnChain: number | bigint | string;
  contractAddress?: string;
  onStatusUpdate?: TxStatusCallback;
}): Promise<SorobanTxResult> {
  const { clientAddress, projectIdOnChain, contractAddress, onStatusUpdate } = params;

  const args: xdr.ScVal[] = [
    nativeToScVal(BigInt(projectIdOnChain), { type: 'u64' }),
  ];

  return invokeSorobanMethod({
    callerAddress: clientAddress,
    contractAddress,
    functionName: 'cancel_unassigned_project',
    args,
    onStatusUpdate,
  });
}

/**
 * Submits deliverables for a milestone on-chain by the freelancer with an immutable IPFS/SHA-256 deliverable hash.
 */
export async function submitMilestoneOnChain(params: {
  freelancerAddress: string;
  projectIdOnChain: number | bigint | string;
  milestoneIndex: number;
  deliverableHash: string;
  contractAddress?: string;
  onStatusUpdate?: TxStatusCallback;
}): Promise<SorobanTxResult> {
  const { freelancerAddress, projectIdOnChain, milestoneIndex, deliverableHash, contractAddress, onStatusUpdate } = params;

  const args: xdr.ScVal[] = [
    nativeToScVal(BigInt(projectIdOnChain), { type: 'u64' }),
    nativeToScVal(Number(milestoneIndex), { type: 'u32' }),
    nativeToScVal(deliverableHash || 'ipfs://QmProofOfWorkHash', { type: 'string' }),
  ];

  return invokeSorobanMethod({
    callerAddress: freelancerAddress,
    contractAddress,
    functionName: 'submit_milestone',
    args,
    onStatusUpdate,
  });
}

/**
 * Requests milestone revision on-chain by the client, decrementing remaining revisions and resetting timelock.
 */
export async function requestRevisionOnChain(params: {
  clientAddress: string;
  projectIdOnChain: number | bigint | string;
  milestoneIndex: number;
  contractAddress?: string;
  onStatusUpdate?: TxStatusCallback;
}): Promise<SorobanTxResult> {
  const { clientAddress, projectIdOnChain, milestoneIndex, contractAddress, onStatusUpdate } = params;

  const args: xdr.ScVal[] = [
    nativeToScVal(BigInt(projectIdOnChain), { type: 'u64' }),
    nativeToScVal(Number(milestoneIndex), { type: 'u32' }),
  ];

  return invokeSorobanMethod({
    callerAddress: clientAddress,
    contractAddress,
    functionName: 'request_revision',
    args,
    onStatusUpdate,
  });
}

/**
 * Approves a milestone and triggers automatic on-chain fund transfer to the freelancer.
 */
export async function approveMilestoneOnChain(params: {
  clientAddress: string;
  projectIdOnChain: number | bigint | string;
  milestoneIndex: number;
  platformAddress?: string;
  contractAddress?: string;
  onStatusUpdate?: TxStatusCallback;
}): Promise<SorobanTxResult> {
  const { clientAddress, projectIdOnChain, milestoneIndex, platformAddress, contractAddress, onStatusUpdate } =
    params;

  const platformScVal = platformAddress
    ? Address.fromString(platformAddress).toScVal()
    : xdr.ScVal.scvVoid();

  const args: xdr.ScVal[] = [
    nativeToScVal(BigInt(projectIdOnChain), { type: 'u64' }),
    nativeToScVal(Number(milestoneIndex), { type: 'u32' }),
    platformScVal,
  ];

  return invokeSorobanMethod({
    callerAddress: clientAddress,
    contractAddress,
    functionName: 'approve_milestone',
    args,
    onStatusUpdate,
  });
}

/**
 * Transitions an escrow project into a disputed state, locking funds until arbiter ruling.
 */
export async function raiseDisputeOnChain(params: {
  callerAddress: string;
  projectIdOnChain: number | bigint | string;
  contractAddress?: string;
  onStatusUpdate?: TxStatusCallback;
}): Promise<SorobanTxResult> {
  const { callerAddress, projectIdOnChain, contractAddress, onStatusUpdate } = params;

  const args: xdr.ScVal[] = [
    Address.fromString(callerAddress).toScVal(),
    nativeToScVal(BigInt(projectIdOnChain), { type: 'u64' }),
  ];

  return invokeSorobanMethod({
    callerAddress,
    contractAddress,
    functionName: 'raise_dispute',
    args,
    onStatusUpdate,
  });
}

/**
 * Executed by the arbiter to resolve disputed funds according to verdict split.
 */
export async function resolveDisputeOnChain(params: {
  arbiterAddress: string;
  projectIdOnChain: number | bigint | string;
  clientAmount: number;
  freelancerAmount: number;
  platformAddress?: string;
  contractAddress?: string;
  onStatusUpdate?: TxStatusCallback;
}): Promise<SorobanTxResult> {
  const {
    arbiterAddress,
    projectIdOnChain,
    clientAmount,
    freelancerAmount,
    platformAddress,
    contractAddress,
    onStatusUpdate,
  } = params;

  const platformScVal = platformAddress
    ? Address.fromString(platformAddress).toScVal()
    : xdr.ScVal.scvVoid();

  const args: xdr.ScVal[] = [
    nativeToScVal(BigInt(projectIdOnChain), { type: 'u64' }),
    nativeToScVal(BigInt(Math.round(clientAmount * 10_000_000)), { type: 'i128' }),
    nativeToScVal(BigInt(Math.round(freelancerAmount * 10_000_000)), { type: 'i128' }),
    platformScVal,
  ];

  return invokeSorobanMethod({
    callerAddress: arbiterAddress,
    contractAddress,
    functionName: 'resolve_dispute',
    args,
    onStatusUpdate,
  });
}

/**
 * Executes a 2-of-N multi-signature dispute resolution on-chain with two distinct arbiter signatures.
 */
export async function resolveDisputeMultisigOnChain(params: {
  arbiter1Address: string;
  arbiter2Address: string;
  projectIdOnChain: number | bigint | string;
  clientAmount: number;
  freelancerAmount: number;
  platformAddress?: string;
  contractAddress?: string;
  onStatusUpdate?: TxStatusCallback;
}): Promise<SorobanTxResult> {
  const {
    arbiter1Address,
    arbiter2Address,
    projectIdOnChain,
    clientAmount,
    freelancerAmount,
    platformAddress,
    contractAddress,
    onStatusUpdate,
  } = params;

  const platformScVal = platformAddress
    ? Address.fromString(platformAddress).toScVal()
    : xdr.ScVal.scvVoid();

  const args: xdr.ScVal[] = [
    nativeToScVal(BigInt(projectIdOnChain), { type: 'u64' }),
    Address.fromString(arbiter1Address).toScVal(),
    Address.fromString(arbiter2Address).toScVal(),
    nativeToScVal(BigInt(Math.round(clientAmount * 10_000_000)), { type: 'i128' }),
    nativeToScVal(BigInt(Math.round(freelancerAmount * 10_000_000)), { type: 'i128' }),
    platformScVal,
  ];

  return invokeSorobanMethod({
    callerAddress: arbiter1Address,
    contractAddress,
    functionName: 'resolve_dispute_multisig',
    args,
    onStatusUpdate,
  });
}

/**
 * Submits an individual arbiter's ruling vote towards the 2-of-3 multisig threshold.
 */
export async function submitDisputeRulingOnChain(params: {
  arbiterAddress: string;
  projectIdOnChain: number | bigint | string;
  clientAmount: number;
  freelancerAmount: number;
  platformAddress?: string;
  contractAddress?: string;
  onStatusUpdate?: TxStatusCallback;
}): Promise<SorobanTxResult> {
  const {
    arbiterAddress,
    projectIdOnChain,
    clientAmount,
    freelancerAmount,
    platformAddress,
    contractAddress,
    onStatusUpdate,
  } = params;

  const platformScVal = platformAddress
    ? Address.fromString(platformAddress).toScVal()
    : xdr.ScVal.scvVoid();

  const args: xdr.ScVal[] = [
    Address.fromString(arbiterAddress).toScVal(),
    nativeToScVal(BigInt(projectIdOnChain), { type: 'u64' }),
    nativeToScVal(BigInt(Math.round(clientAmount * 10_000_000)), { type: 'i128' }),
    nativeToScVal(BigInt(Math.round(freelancerAmount * 10_000_000)), { type: 'i128' }),
    platformScVal,
  ];

  return invokeSorobanMethod({
    callerAddress: arbiterAddress,
    contractAddress,
    functionName: 'submit_dispute_ruling',
    args,
    onStatusUpdate,
  });
}

/**
 * Resolves a disputed escrow when arbiters have been inactive for > 14 days following raise_dispute.
 * Allows safe 50/50 refund split or default 100% client refund.
 */
export async function resolveDisputeTimeoutOnChain(params: {
  callerAddress: string;
  projectIdOnChain: number | bigint | string;
  split5050: boolean;
  platformAddress?: string;
  contractAddress?: string;
  onStatusUpdate?: TxStatusCallback;
}): Promise<SorobanTxResult> {
  const {
    callerAddress,
    projectIdOnChain,
    split5050,
    platformAddress,
    contractAddress,
    onStatusUpdate,
  } = params;

  const platformScVal = platformAddress
    ? Address.fromString(platformAddress).toScVal()
    : xdr.ScVal.scvVoid();

  const args: xdr.ScVal[] = [
    nativeToScVal(BigInt(projectIdOnChain), { type: 'u64' }),
    nativeToScVal(split5050, { type: 'bool' }),
    platformScVal,
  ];

  return invokeSorobanMethod({
    callerAddress,
    contractAddress,
    functionName: 'resolve_dispute_timeout',
    args,
    onStatusUpdate,
  });
}

/**
 * Executes the on-chain auto_release_milestone invocation once the 7-day review timelock has elapsed.
 * Can be called by the freelancer, a platform relayer, or any caller without requiring client authorization.
 */
export async function autoReleaseMilestoneOnChain(params: {
  callerAddress: string;
  projectIdOnChain: number | bigint | string;
  milestoneIndex: number;
  platformAddress?: string;
  contractAddress?: string;
  onStatusUpdate?: TxStatusCallback;
}): Promise<SorobanTxResult> {
  const {
    callerAddress,
    projectIdOnChain,
    milestoneIndex,
    platformAddress,
    contractAddress,
    onStatusUpdate,
  } = params;

  const platformScVal = platformAddress
    ? Address.fromString(platformAddress).toScVal()
    : xdr.ScVal.scvVoid();

  const args: xdr.ScVal[] = [
    nativeToScVal(BigInt(projectIdOnChain), { type: 'u64' }),
    nativeToScVal(milestoneIndex, { type: 'u32' }),
    platformScVal,
  ];

  return invokeSorobanMethod({
    callerAddress,
    contractAddress,
    functionName: 'auto_release_milestone',
    args,
    onStatusUpdate,
  });
}

/**
 * Executes a mutual (non-dispute) project cancellation once both client and
 * freelancer have agreed on a refund split. Broadcasts `mutual_cancel`.
 */
export async function mutualCancelOnChain(params: {
  callerAddress: string;
  projectIdOnChain: number | bigint | string;
  clientRefundAmount: number;
  freelancerCompensation: number;
  contractAddress?: string;
  onStatusUpdate?: TxStatusCallback;
}): Promise<SorobanTxResult> {
  const {
    callerAddress,
    projectIdOnChain,
    clientRefundAmount,
    freelancerCompensation,
    contractAddress,
    onStatusUpdate,
  } = params;

  const args: xdr.ScVal[] = [
    Address.fromString(callerAddress).toScVal(),
    nativeToScVal(BigInt(projectIdOnChain), { type: 'u64' }),
    nativeToScVal(BigInt(Math.round(clientRefundAmount * 10_000_000)), { type: 'i128' }),
    nativeToScVal(BigInt(Math.round(freelancerCompensation * 10_000_000)), { type: 'i128' }),
  ];

  return invokeSorobanMethod({
    callerAddress,
    contractAddress,
    functionName: 'mutual_cancel',
    args,
    onStatusUpdate,
  });
}

/**
 * Verified open-source repository hosting the audited Soroban contract source.
 */
export const OFFICIAL_CONTRACT_REPO_URL =
  'https://github.com/trustpay-escrow/trustpay-escrow/tree/main/contracts';

/**
 * Expected SHA-256 (WASM hash) of the official release build artifact.
 * Configure via NEXT_PUBLIC_ESCROW_WASM_SHA256 once a release is published.
 */
export const EXPECTED_WASM_SHA256 = (
  process.env.NEXT_PUBLIC_ESCROW_WASM_SHA256 || ''
).toLowerCase();

function xdrBufferToHex(buf: Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Queries the Soroban RPC for the deployed contract instance's WASM bytecode
 * hash (the SHA-256 digest of the compiled contract WASM) via ledger entries.
 */
export async function getContractWasmHash(
  contractAddress: string = DEFAULT_ESCROW_CONTRACT_ID
): Promise<string> {
  const server = getSorobanRpcServer();

  const result = await server.getContractData(
    contractAddress,
    xdr.ScVal.scvSymbol('ContractInstance'),
    rpc.Durability.Persistent
  );

  const data = result.val;
  if (data.switch().name !== 'contractData') {
    throw new Error('Contract instance ledger entry not found.');
  }

  const instanceVal = data.contractData().val();
  if (instanceVal.switch().name !== 'scvContractInstance') {
    throw new Error('Contract has no instance data on ledger.');
  }

  const executable = instanceVal.instance().executable();
  if (executable.switch().name !== 'contractExecutableWasm') {
    throw new Error('Contract executable is not an inline WASM hash.');
  }

  return xdrBufferToHex(executable.wasmHash());
}

import { decodeSorobanError, DecodedSorobanError } from './soroban-error-decoder';
import { showSorobanErrorToast } from '@/components/SorobanErrorToast';
export type FeeSpeedTier = 'standard' | 'fast' | 'urgent';

export interface FeeTierDetails {
  feeStroops: number;
  multiplier: number;
  estimatedTimeSec: number;
}

export interface NetworkFeeStats {
  baseFeeStroops: number;
  surgeMultiplier: number;
  isSurgeActive: boolean;
  ledgerCapacityUsage: number;
  tiers: {
    standard: FeeTierDetails;
    fast: FeeTierDetails;
    urgent: FeeTierDetails;
  };
}

export function calculateFeeTiers(baseFeeStroops: number, surgeMultiplier: number = 1.0): NetworkFeeStats['tiers'] {
  const effectiveBase = Math.max(100, Math.round(baseFeeStroops * surgeMultiplier));
  return {
    standard: {
      feeStroops: effectiveBase,
      multiplier: 1.0,
      estimatedTimeSec: 3,
    },
    fast: {
      feeStroops: Math.round(effectiveBase * 1.5),
      multiplier: 1.5,
      estimatedTimeSec: 2,
    },
    urgent: {
      feeStroops: Math.round(effectiveBase * 2.0),
      multiplier: 2.0,
      estimatedTimeSec: 1,
    },
  };
}

export async function fetchStellarFeeStats(): Promise<NetworkFeeStats> {
  const fallbackBase = 100;
  try {
    const res = await fetch(`${HORIZON_URL}/fee_stats`);
    if (!res.ok) {
      return {
        baseFeeStroops: fallbackBase,
        surgeMultiplier: 1.0,
        isSurgeActive: false,
        ledgerCapacityUsage: 0.1,
        tiers: calculateFeeTiers(fallbackBase),
      };
    }
    const data = await res.json();
    const modeFee = Number(data?.fee_charged?.mode || data?.min_accepted_fee || fallbackBase);
    const capacityUsage = Number(data?.ledger_capacity_usage || 0);
    const isSurge = capacityUsage > 0.85;
    const surgeMultiplier = isSurge ? 1.3 : 1.0;
    return {
      baseFeeStroops: modeFee,
      surgeMultiplier,
      isSurgeActive: isSurge,
      ledgerCapacityUsage: capacityUsage,
      tiers: calculateFeeTiers(modeFee, surgeMultiplier),
    };
  } catch {
    return {
      baseFeeStroops: fallbackBase,
      surgeMultiplier: 1.0,
      isSurgeActive: false,
      ledgerCapacityUsage: 0.1,
      tiers: calculateFeeTiers(fallbackBase),
    };
  }
}



export interface PathPaymentSwapResult {
  success: boolean;
  txHash: string;
  /** Minimum destination amount that was enforced on-chain. */
  destMin: string;
}

/**
 * Swaps `sendAmount` of `sendAsset` into `destAsset` through the Stellar DEX with a
 * `pathPaymentStrictSend` operation paid back to the caller. The `destMin` bound makes the
 * swap revert atomically if slippage exceeds the user's tolerance.
 *
 * Note: Soroban contract invocations must be the only operation in their transaction, so
 * funding the escrow with the swapped USDC is a second transaction (`lockEscrowOnChain`).
 */
export async function swapViaPathPayment(options: {
  callerAddress: string;
  sendAsset: { code: string; issuer?: string };
  sendAmount: string;
  destAsset: { code: string; issuer?: string };
  destMin: string;
  path?: Array<{ code: string; issuer?: string }>;
  onStatusUpdate?: TxStatusCallback;
}): Promise<PathPaymentSwapResult> {
  const { callerAddress, sendAsset, sendAmount, destAsset, destMin, path = [], onStatusUpdate } = options;
  const toAsset = (a: { code: string; issuer?: string }) =>
    a.issuer ? new Asset(a.code, a.issuer) : Asset.native();

  onStatusUpdate?.('preparing', 'Validating wallet connection and account status...');
  if (!(await isConnected())) {
    throw new Error('Freighter wallet extension is not detected. Please install and unlock Freighter.');
  }
  await ensureAccountExists(callerAddress);

  const horizon = new Horizon.Server(HORIZON_URL);
  const account = await horizon.loadAccount(callerAddress);

  const tx = new TransactionBuilder(account, {
    fee: '10000',
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset: toAsset(sendAsset),
        sendAmount,
        destination: callerAddress,
        destAsset: toAsset(destAsset),
        destMin,
        path: path.map(toAsset),
      })
    )
    .setTimeout(180)
    .build();

  onStatusUpdate?.('signing', 'Awaiting swap authorization in Freighter wallet...');
  let signResult: any;
  try {
    signResult = await signTransaction(tx.toXDR(), { networkPassphrase: STELLAR_NETWORK_PASSPHRASE });
  } catch (err: any) {
    throw new Error(`Wallet signing cancelled or rejected: ${err.message || err}`);
  }
  if (signResult?.error) {
    throw new Error(typeof signResult.error === 'string' ? signResult.error : signResult.error.message || 'Freighter rejected signature');
  }
  const signedXdr = typeof signResult === 'string' ? signResult : signResult?.signedTxXdr || '';
  if (!signedXdr) throw new Error('Transaction signing was rejected or returned empty XDR.');

  onStatusUpdate?.('submitting', 'Broadcasting swap to the Stellar DEX...');
  try {
    const res = await horizon.submitTransaction(TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE));
    onStatusUpdate?.('success', 'Swap confirmed on Stellar!');
    return { success: true, txHash: res.hash, destMin };
  } catch (err: any) {
    const codes = err?.response?.data?.extras?.result_codes?.operations as string[] | undefined;
    if (codes?.includes('op_under_dest_min')) {
      throw new Error('Price moved beyond your slippage tolerance. Refresh the quote or raise the tolerance.');
    }
    if (codes?.includes('op_no_trust')) {
      throw new Error(`Your account needs a trustline for ${destAsset.code} before it can receive the swap.`);
    }
    throw new Error(`Swap failed: ${codes?.join(', ') || err?.message || err}`);
  }
}

// ---------------------------------------------------------------------------
// Multi-signature (enterprise treasury) support
// ---------------------------------------------------------------------------

export interface StellarSigner {
  /** Signer public key (G...) or other signer key type (hash / pre-auth). */
  key: string;
  weight: number;
  type: string;
}

export interface AccountThresholds {
  low: number;
  med: number;
  high: number;
}

export interface MultisigAccountInfo {
  address: string;
  signers: StellarSigner[];
  thresholds: AccountThresholds;
}

/** Soroban contract invocations (milestone release) are medium-threshold operations. */
export type ThresholdCategory = keyof AccountThresholds;

/**
 * Loads the signer set and low/medium/high thresholds of a Stellar account from Horizon.
 */
export async function fetchMultisigAccountInfo(accountAddress: string): Promise<MultisigAccountInfo> {
  const res = await fetch(`${HORIZON_URL}/accounts/${encodeURIComponent(accountAddress)}`);
  if (res.status === 404) {
    throw new Error('Account was not found on the Stellar network. Fund it before using multi-sig.');
  }
  if (!res.ok) {
    throw new Error(`Could not load account signers (${res.status})`);
  }
  const data = await res.json();
  return {
    address: accountAddress,
    signers: ((data.signers || []) as Array<{ key: string; weight: number; type: string }>)
      .filter((s) => Number(s.weight) > 0)
      .map((s) => ({ key: s.key, weight: Number(s.weight), type: s.type })),
    thresholds: {
      low: Number(data.thresholds?.low_threshold ?? 0),
      med: Number(data.thresholds?.med_threshold ?? 0),
      high: Number(data.thresholds?.high_threshold ?? 0),
    },
  };
}

/** True when a single signature is not enough to authorize a medium-threshold operation. */
export function isMultisigAccount(info: MultisigAccountInfo | null | undefined): boolean {
  if (!info) return false;
  const maxSingle = info.signers.reduce((max, s) => Math.max(max, s.weight), 0);
  return info.signers.length > 1 && maxSingle < Math.max(info.thresholds.med, 1);
}

export function getRequiredThreshold(
  thresholds: AccountThresholds,
  category: ThresholdCategory = 'med'
): number {
  return thresholds[category];
}

export function calculateCollectedWeight(signers: StellarSigner[], signedKeys: string[]): number {
  const signed = new Set(signedKeys);
  return signers.reduce((sum, s) => (signed.has(s.key) ? sum + s.weight : sum), 0);
}

/**
 * Resolves which of the account's signers already signed a transaction envelope by matching the
 * 4-byte signature hints against each signer's public key.
 */
export function getSignedKeysFromXdr(txXdr: string, signers: StellarSigner[]): string[] {
  if (!txXdr) return [];
  try {
    const tx: any = TransactionBuilder.fromXDR(txXdr, STELLAR_NETWORK_PASSPHRASE);
    const hints = new Set<string>(
      (tx.signatures || []).map((sig: any) => Buffer.from(sig.hint()).toString('hex'))
    );
    return signers
      .filter((s) => {
        if (!s.key.startsWith('G')) return false;
        try {
          const raw = StrKey.decodeEd25519PublicKey(s.key);
          return hints.has(Buffer.from(raw.subarray(raw.length - 4)).toString('hex'));
        } catch {
          return false;
        }
      })
      .map((s) => s.key);
  } catch {
    return [];
  }
}

/**
 * Adds the connected signer's signature to a pending transaction envelope via Freighter and
 * returns the updated XDR so it can be passed on to the next co-signer.
 */
export async function cosignTransactionXdr(txXdr: string, signerAddress: string): Promise<string> {
  if (!(await isConnected())) {
    throw new Error('Freighter wallet extension is not detected. Please install and unlock Freighter.');
  }
  let signResult: any;
  try {
    signResult = await signTransaction(txXdr, {
      networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
      address: signerAddress,
    });
  } catch (err: any) {
    throw new Error(`Wallet signing cancelled or rejected: ${err.message || err}`);
  }
  if (signResult?.error) {
    throw new Error(
      typeof signResult.error === 'string' ? signResult.error : signResult.error.message || 'Freighter rejected signature'
    );
  }
  const signed = typeof signResult === 'string' ? signResult : signResult?.signedTxXdr || '';
  if (!signed) throw new Error('Transaction signing was rejected or returned empty XDR.');
  return signed;
}

/**
 * Broadcasts a fully co-signed transaction and waits for ledger finality.
 */
export async function submitCoSignedTransaction(
  txXdr: string,
  onStatusUpdate?: TxStatusCallback
): Promise<SorobanTxResult> {
  const server = getSorobanRpcServer();
  onStatusUpdate?.('submitting', 'Broadcasting co-signed transaction to Stellar network...');
  const sendRes = await server.sendTransaction(TransactionBuilder.fromXDR(txXdr, STELLAR_NETWORK_PASSPHRASE));
  if (sendRes.status === 'ERROR') {
    const detail = sendRes.errorResult ? JSON.stringify(sendRes.errorResult) : sendRes.status;
    throw new Error(`Transaction rejected by Stellar RPC: ${detail}`);
  }
  const txHash = sendRes.hash;
  onStatusUpdate?.('polling', `Transaction submitted (tx: ${txHash.slice(0, 8)}...). Awaiting confirmation...`);
  for (let attempt = 0; attempt < 35; attempt++) {
    await new Promise((r) => setTimeout(r, 1500));
    const status = await server.getTransaction(txHash);
    if (status.status === 'SUCCESS') {
      onStatusUpdate?.('success', 'Transaction successfully confirmed on Stellar!');
      return { success: true, txHash, returnValue: null };
    }
    if (status.status === 'FAILED') {
      throw new Error(`Soroban transaction failed during ledger execution (tx: ${txHash})`);
    }
  }
  throw new Error(`Transaction timed out while awaiting ledger inclusion (tx: ${txHash}).`);
}
