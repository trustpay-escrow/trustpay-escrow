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
    issuerOrContractAddress: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || 'CCW67TSB3SSS423DNE2B2RQLI274W2YQY35J5XEEGBB5AKWODHBB545G',
    icon: '$',
    decimals: 7,
  },
  EURC: {
    symbol: 'EURC',
    name: 'Euro Coin',
    issuerOrContractAddress: process.env.NEXT_PUBLIC_EURC_TOKEN_ADDRESS || 'CDLZFC3SYJYDVR72CC2CPEMV3N3K5ZCGKFW5R4GMLGQO6PBA3RPAV4T9',
    icon: '€',
    decimals: 7,
  },
  XLM: {
    symbol: 'XLM',
    name: 'Stellar Lumens',
    issuerOrContractAddress: process.env.NEXT_PUBLIC_XLM_TOKEN_ADDRESS || 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYZYY55COEHWY53',
    icon: '✦',
    decimals: 7,
  },
  PYUSD: {
    symbol: 'PYUSD',
    name: 'PayPal USD',
    issuerOrContractAddress: process.env.NEXT_PUBLIC_PYUSD_TOKEN_ADDRESS || 'CX7B65SS3SSS423DNE2B2RQLI274W2YQY35J5XEEGBB5AKWODHBB545G',
    icon: '₱',
    decimals: 7,
  },
};

export const DEFAULT_TOKEN = SUPPORTED_TOKENS.USDC;
