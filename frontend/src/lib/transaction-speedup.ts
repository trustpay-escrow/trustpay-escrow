import {
  BASE_FEE,
  FeeBumpTransaction,
  Transaction,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';

export const SPEED_UP_FEE_PRESETS = [
  { label: 'Standard', multiplier: 1.5 },
  { label: 'Fast', multiplier: 2 },
  { label: 'Urgent', multiplier: 3 },
] as const;

export type SpeedUpMultiplier = (typeof SPEED_UP_FEE_PRESETS)[number]['multiplier'];

export interface PendingSorobanTransaction {
  xdr: string;
  hash: string;
  submittedAt: number;
}

const feeBumpReplacements = new Map<string, Set<string>>();
const feeBumpRequests = new Set<string>();

export function requestFeeBump(originalHash: string): void {
  feeBumpRequests.add(originalHash);
}

export function cancelFeeBumpRequest(originalHash: string): void {
  feeBumpRequests.delete(originalHash);
}

export function isFeeBumpRequested(originalHash: string): boolean {
  return feeBumpRequests.has(originalHash);
}

export function registerFeeBumpReplacement(originalHash: string, replacementHash: string): void {
  const hashes = feeBumpReplacements.get(originalHash) ?? new Set<string>();
  hashes.add(replacementHash);
  feeBumpReplacements.set(originalHash, hashes);
}

export function getFeeBumpReplacements(originalHash: string): string[] {
  return Array.from(feeBumpReplacements.get(originalHash) ?? []);
}

export function clearFeeBumpReplacements(originalHash: string): void {
  feeBumpReplacements.delete(originalHash);
  feeBumpRequests.delete(originalHash);
}

function getSorobanResourceFee(transaction: Transaction): bigint {
  const envelope = transaction.toEnvelope();
  if (envelope.switch() !== xdr.EnvelopeType.envelopeTypeTx()) return BigInt(0);

  const transactionExt = envelope.v1().tx().ext();
  if (transactionExt.switch() !== 1) return BigInt(0);
  return BigInt(transactionExt.sorobanData().resourceFee().toString());
}

export function buildFeeBumpTransaction(
  innerTransactionXdr: string,
  feeSource: string,
  multiplier: SpeedUpMultiplier,
  networkPassphrase: string
): FeeBumpTransaction {
  if (!SPEED_UP_FEE_PRESETS.some((preset) => preset.multiplier === multiplier)) {
    throw new Error('Choose a supported fee-bump multiplier.');
  }

  const innerTransaction = TransactionBuilder.fromXDR(innerTransactionXdr, networkPassphrase);
  if (!(innerTransaction instanceof Transaction)) {
    throw new Error('Only a standard transaction can be accelerated with a fee bump.');
  }

  const operationCount = innerTransaction.operations.length;
  if (operationCount === 0) {
    throw new Error('The pending transaction does not contain any operations.');
  }

  const innerFee = BigInt(innerTransaction.fee);
  const resourceFee = getSorobanResourceFee(innerTransaction);
  const inclusionFee = innerFee - resourceFee;
  if (inclusionFee < BigInt(0)) {
    throw new Error('The pending transaction contains invalid fee data.');
  }

  const divisor = BigInt(operationCount);
  const originalBaseFee = (inclusionFee + divisor - BigInt(1)) / divisor;
  const [multiplierNumerator, multiplierDenominator] =
    multiplier === 1.5
      ? [BigInt(3), BigInt(2)]
      : multiplier === 2
        ? [BigInt(2), BigInt(1)]
        : [BigInt(3), BigInt(1)];
  const multipliedBaseFee =
    (originalBaseFee * multiplierNumerator + multiplierDenominator - BigInt(1)) /
    multiplierDenominator;
  const baseFee = multipliedBaseFee > BigInt(BASE_FEE)
    ? multipliedBaseFee
    : BigInt(BASE_FEE);

  return TransactionBuilder.buildFeeBumpTransaction(
    feeSource,
    baseFee.toString(),
    innerTransaction,
    networkPassphrase
  );
}
