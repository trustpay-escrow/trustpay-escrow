import { describe, it, expect } from 'vitest';
import { SUPPORTED_TOKENS, DEFAULT_TOKEN } from './tokens';

describe('Supported Tokens Configuration', () => {
  it('includes USDC as the default token', () => {
    expect(DEFAULT_TOKEN.symbol).toBe('USDC');
    expect(DEFAULT_TOKEN.decimals).toBe(7);
  });

  it('configures EURC, XLM, and PYUSD assets with valid 7 decimal precision', () => {
    expect(SUPPORTED_TOKENS.EURC).toBeDefined();
    expect(SUPPORTED_TOKENS.EURC.symbol).toBe('EURC');
    expect(SUPPORTED_TOKENS.EURC.decimals).toBe(7);

    expect(SUPPORTED_TOKENS.XLM).toBeDefined();
    expect(SUPPORTED_TOKENS.XLM.symbol).toBe('XLM');
    expect(SUPPORTED_TOKENS.XLM.decimals).toBe(7);

    expect(SUPPORTED_TOKENS.PYUSD).toBeDefined();
    expect(SUPPORTED_TOKENS.PYUSD.symbol).toBe('PYUSD');
    expect(SUPPORTED_TOKENS.PYUSD.decimals).toBe(7);
  });

  it('ensures each supported token has a non-empty contract address', () => {
    Object.values(SUPPORTED_TOKENS).forEach((token) => {
      expect(token.issuerOrContractAddress).toBeDefined();
      expect(token.issuerOrContractAddress.length).toBeGreaterThan(10);
    });
  });
});
