export type TokenNetwork = 'TESTNET' | 'PUBLIC';
export type CryptoCurrency = 'USDC' | 'EURC' | 'XLM' | 'PYUSD';

export interface TokenConfig {
  symbol: CryptoCurrency;
  name: string;
  issuerOrContractAddress: string;
  icon: string;
  decimals: number;
  /** Classic Stellar asset issuer (G...) used for Horizon path finding and DEX swaps. Native XLM has none. */
  classicIssuer?: string;
  /**
   * Soroban token contract IDs per network. Testnet defaults to the configured contract; mainnet IDs
   * must be supplied through NEXT_PUBLIC_<SYMBOL>_MAINNET_TOKEN_ADDRESS so they are never guessed.
   */
  contractAddresses: Record<TokenNetwork, string>;
}

export const SUPPORTED_TOKENS: Record<string, TokenConfig> = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    issuerOrContractAddress: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    icon: '$',
    decimals: 7,
    contractAddresses: {
      TESTNET: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
      PUBLIC: process.env.NEXT_PUBLIC_USDC_MAINNET_TOKEN_ADDRESS || '',
    },
    classicIssuer: process.env.NEXT_PUBLIC_USDC_ISSUER || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  },
  EURC: {
    symbol: 'EURC',
    name: 'Euro Coin',
    issuerOrContractAddress: process.env.NEXT_PUBLIC_EURC_TOKEN_ADDRESS || 'CDOIV56NSBNVNZN4XPTOT7JVRK6AW4RUISEPYUZYIIKMVIY7X3OH4S5X',
    icon: '€',
    decimals: 7,
    contractAddresses: {
      TESTNET: process.env.NEXT_PUBLIC_EURC_TOKEN_ADDRESS || 'CDOIV56NSBNVNZN4XPTOT7JVRK6AW4RUISEPYUZYIIKMVIY7X3OH4S5X',
      PUBLIC: process.env.NEXT_PUBLIC_EURC_MAINNET_TOKEN_ADDRESS || '',
    },
    classicIssuer: process.env.NEXT_PUBLIC_EURC_ISSUER || 'GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO',
  },
  XLM: {
    symbol: 'XLM',
    name: 'Stellar Lumens',
    issuerOrContractAddress: process.env.NEXT_PUBLIC_XLM_TOKEN_ADDRESS || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    icon: '✦',
    decimals: 7,
    contractAddresses: {
      TESTNET: process.env.NEXT_PUBLIC_XLM_TOKEN_ADDRESS || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      PUBLIC: process.env.NEXT_PUBLIC_XLM_MAINNET_TOKEN_ADDRESS || '',
    },
  },
  PYUSD: {
    symbol: 'PYUSD',
    name: 'PayPal USD',
    issuerOrContractAddress: process.env.NEXT_PUBLIC_PYUSD_TOKEN_ADDRESS || 'CDITO57E37A4Y44JCD2IYASZKFYIANQBKNRRL436VJIIZBYQRKW37OX5',
    icon: '₱',
    decimals: 7,
    contractAddresses: {
      TESTNET: process.env.NEXT_PUBLIC_PYUSD_TOKEN_ADDRESS || 'CDITO57E37A4Y44JCD2IYASZKFYIANQBKNRRL436VJIIZBYQRKW37OX5',
      PUBLIC: process.env.NEXT_PUBLIC_PYUSD_MAINNET_TOKEN_ADDRESS || '',
    },
  },
};

export const DEFAULT_TOKEN = SUPPORTED_TOKENS.USDC;

/** Returns the Soroban contract ID of a token on the given network, or null when not configured. */
export function getTokenContractAddress(token: TokenConfig, network: string | null | undefined): string | null {
  const key: TokenNetwork = network === 'PUBLIC' || network === 'MAINNET' ? 'PUBLIC' : 'TESTNET';
  return token.contractAddresses[key] || null;
}

export interface LiquidityPoolConfig {
  contractAddress: string;
  feeBps: number;
  reserveDecimals: number;
}

export const LIQUIDITY_POOLS: Record<string, LiquidityPoolConfig> = {
  'USDC/EURC': {
    contractAddress: process.env.NEXT_PUBLIC_USDC_EURC_POOL_ADDRESS || '',
    feeBps: Number(process.env.NEXT_PUBLIC_USDC_EURC_POOL_FEE_BPS || 30),
    reserveDecimals: 7,
  },
  'EURC/USDC': {
    contractAddress: process.env.NEXT_PUBLIC_EURC_USDC_POOL_ADDRESS || '',
    feeBps: Number(process.env.NEXT_PUBLIC_EURC_USDC_POOL_FEE_BPS || 30),
    reserveDecimals: 7,
  },
  'USDC/XLM': {
    contractAddress: process.env.NEXT_PUBLIC_USDC_XLM_POOL_ADDRESS || '',
    feeBps: Number(process.env.NEXT_PUBLIC_USDC_XLM_POOL_FEE_BPS || 30),
    reserveDecimals: 7,
  },
  'XLM/USDC': {
    contractAddress: process.env.NEXT_PUBLIC_XLM_USDC_POOL_ADDRESS || '',
    feeBps: Number(process.env.NEXT_PUBLIC_XLM_USDC_POOL_FEE_BPS || 30),
    reserveDecimals: 7,
  },
  'USDC/PYUSD': {
    contractAddress: process.env.NEXT_PUBLIC_USDC_PYUSD_POOL_ADDRESS || '',
    feeBps: Number(process.env.NEXT_PUBLIC_USDC_PYUSD_POOL_FEE_BPS || 30),
    reserveDecimals: 7,
  },
  'PYUSD/USDC': {
    contractAddress: process.env.NEXT_PUBLIC_PYUSD_USDC_POOL_ADDRESS || '',
    feeBps: Number(process.env.NEXT_PUBLIC_PYUSD_USDC_POOL_FEE_BPS || 30),
    reserveDecimals: 7,
  },
};

export function getLiquidityPoolConfig(baseToken: string, quoteToken: string): LiquidityPoolConfig | null {
  return LIQUIDITY_POOLS[`${baseToken}/${quoteToken}`] || null;
}

export function getLiquidityPoolKey(baseToken: string, quoteToken: string): string {
  return `${baseToken}/${quoteToken}`;
}
