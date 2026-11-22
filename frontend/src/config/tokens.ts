export interface TokenConfig {
  symbol: 'USDC' | 'EURC' | 'XLM' | 'PYUSD';
  name: string;
  issuerOrContractAddress: string;
  icon: string;
  decimals: number;
  /** Classic Stellar asset issuer (G...) used for Horizon path finding and DEX swaps. Native XLM has none. */
  classicIssuer?: string;
}

export const SUPPORTED_TOKENS: Record<string, TokenConfig> = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    issuerOrContractAddress: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    icon: '$',
    decimals: 7,
    classicIssuer: process.env.NEXT_PUBLIC_USDC_ISSUER || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  },
  EURC: {
    symbol: 'EURC',
    name: 'Euro Coin',
    issuerOrContractAddress: process.env.NEXT_PUBLIC_EURC_TOKEN_ADDRESS || 'CDOIV56NSBNVNZN4XPTOT7JVRK6AW4RUISEPYUZYIIKMVIY7X3OH4S5X',
    icon: '€',
    decimals: 7,
    classicIssuer: process.env.NEXT_PUBLIC_EURC_ISSUER || 'GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO',
  },
  XLM: {
    symbol: 'XLM',
    name: 'Stellar Lumens',
    issuerOrContractAddress: process.env.NEXT_PUBLIC_XLM_TOKEN_ADDRESS || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    icon: '✦',
    decimals: 7,
  },
  PYUSD: {
    symbol: 'PYUSD',
    name: 'PayPal USD',
    issuerOrContractAddress: process.env.NEXT_PUBLIC_PYUSD_TOKEN_ADDRESS || 'CDITO57E37A4Y44JCD2IYASZKFYIANQBKNRRL436VJIIZBYQRKW37OX5',
    icon: '₱',
    decimals: 7,
  },
};

export const DEFAULT_TOKEN = SUPPORTED_TOKENS.USDC;

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
