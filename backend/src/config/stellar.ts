import { Keypair } from '@stellar/stellar-sdk';
import { env } from './env.js';
import { logger } from '../shared/utils/logger.js';

let serverKeypair: Keypair;

if (env.stellarServerSecret && env.stellarServerSecret.startsWith('S')) {
  try {
    serverKeypair = Keypair.fromSecret(env.stellarServerSecret);
    logger.info(`Loaded server Stellar signing keypair: ${serverKeypair.publicKey()}`);
  } catch (err: any) {
    logger.warn(`Failed to parse STELLAR_SERVER_SECRET, falling back to default keypair: ${err.message}`);
    const fallbackSeed = 'SC24NW7QKHHVP6A3ID4ZNEI5R3V3VM47BEFOBVBWAFX3RXCMLMO6FD7C';
    serverKeypair = Keypair.fromSecret(fallbackSeed);
  }
} else {
  // Deterministic fallback seed for development/test stability
  const fallbackSeed = 'SC24NW7QKHHVP6A3ID4ZNEI5R3V3VM47BEFOBVBWAFX3RXCMLMO6FD7C';
  serverKeypair = Keypair.fromSecret(fallbackSeed);
  logger.info(`Initialized default server Stellar signing keypair: ${serverKeypair.publicKey()}`);
}

export { serverKeypair };
