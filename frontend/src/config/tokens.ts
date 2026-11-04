export interface TokenConfig {
  symbol: 'USDC' | 'EURC' | 'XLM' | 'PYUSD';
  name: string;
  issuerOrContractAddress: string;
  icon: string;
  decimals: number;
}

export const SUPPORTED_TOKENS: Record<string, TokenConfig> = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    issuerOrContractAddress: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    icon: '$',
    decimals: 7,
  },
  EURC: {
    symbol: 'EURC',
    name: 'Euro Coin',
    issuerOrContractAddress: process.env.NEXT_PUBLIC_EURC_TOKEN_ADDRESS || 'CDOIV56NSBNVNZN4XPTOT7JVRK6AW4RUISEPYUZYIIKMVIY7X3OH4S5X',
    icon: '€',
    decimals: 7,
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
