import {
  Account,
  FeeBumpTransaction,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { buildFeeBumpTransaction } from '@/lib/transaction-speedup';

describe('buildFeeBumpTransaction', () => {
  it('wraps the inner transaction without changing its operations', () => {
    const source = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    const inner = new TransactionBuilder(new Account(source, '1'), {
      fee: '1000',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.bumpSequence({ bumpTo: '2' }))
      .setTimeout(60)
      .build();

    const feeBump = buildFeeBumpTransaction(
      inner.toXDR(),
      source,
      1.5,
      Networks.TESTNET
    );

    expect(feeBump).toBeInstanceOf(FeeBumpTransaction);
    expect(feeBump.innerTransaction.operations).toEqual(inner.operations);
    expect(BigInt(feeBump.fee)).toBeGreaterThan(BigInt(inner.fee));
  });

  it('rejects a fee-bump envelope as an inner transaction', () => {
    const source = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    const inner = new TransactionBuilder(new Account(source, '1'), {
      fee: '1000',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.bumpSequence({ bumpTo: '2' }))
      .setTimeout(60)
      .build();
    const feeBump = TransactionBuilder.buildFeeBumpTransaction(
      source,
      '1500',
      inner,
      Networks.TESTNET
    );

    expect(() =>
      buildFeeBumpTransaction(feeBump.toXDR(), source, 2, Networks.TESTNET)
    ).toThrow('Only a standard transaction can be accelerated with a fee bump.');
  });
});
