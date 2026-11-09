import {
  rpc,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
  TransactionBuilder,
  Networks,
  Operation,
} from '@stellar/stellar-sdk';
import { signTransaction, isConnected } from '@stellar/freighter-api';
import { SUPPORTED_TOKENS } from '@/config/tokens';

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
export type TxStatusCallback = (stage: TxStage, message: string) => void;

export interface SorobanTxResult {
  success: boolean;
  txHash: string;
  returnValue?: any;
  error?: string;
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
}): Promise<SorobanTxResult> {
  const { callerAddress, functionName, args, onStatusUpdate } = options;
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
    fee: '100000',
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
  onStatusUpdate?.('polling', `Transaction submitted (tx: ${txHash.slice(0, 8)}...). Awaiting confirmation...`);

  // 7. Poll for ledger finality
  let attempts = 0;
  const maxAttempts = 35; // 35 * 1.5s ~ 50 seconds
  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 1500));
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
      return {
        success: true,
        txHash,
        returnValue: parsedReturn,
      };
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

