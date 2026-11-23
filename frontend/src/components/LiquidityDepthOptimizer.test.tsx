import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { LiquidityDepthOptimizerPanel } from './LiquidityDepthOptimizer';
import type { LiquidityPoolSnapshot } from '@/hooks/useTokenRates';

const shallowPool: LiquidityPoolSnapshot = {
  baseToken: 'USDC',
  quoteToken: 'EURC',
  reserveBase: 100_000,
  reserveQuote: 90_000,
  feeBps: 30,
  source: 'demo',
  fetchedAt: 0,
};

const deepPool: LiquidityPoolSnapshot = {
  ...shallowPool,
  reserveBase: 10_000_000,
  reserveQuote: 9_000_000,
  source: 'live',
};

describe('LiquidityDepthOptimizer', () => {
  it('renders constant-product reserves and spot price for the requested pair', () => {
    render(<LiquidityDepthOptimizerPanel amount={1_000} pool={shallowPool} />);

    expect(screen.getByTestId('liquidity-pair')).toHaveTextContent('USDC → EURC');
    expect(screen.getByTestId('pool-reserves')).toBeInTheDocument();
    expect(screen.getByTestId('reserve-base')).toHaveTextContent('100K');
    expect(screen.getByTestId('reserve-quote')).toHaveTextContent('90K');
    expect(screen.getByTestId('constant-product')).toHaveTextContent('k =');
    expect(screen.getByTestId('spot-price')).toHaveTextContent('0.9000');
  });

  it('shows a warning alert and tranche recommendation when the swap exceeds pool liquidity', () => {
    render(<LiquidityDepthOptimizerPanel amount={50_000} pool={shallowPool} />);

    const warning = screen.getByTestId('slippage-warning');
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveAttribute('role', 'alert');
    expect(warning).toHaveTextContent('Slippage risk detected');
    expect(screen.getByTestId('price-impact')).toHaveTextContent('%');
    expect(screen.getByTestId('tranche-recommendation')).toBeInTheDocument();
    expect(Number(screen.getByTestId('tranche-count').textContent)).toBeGreaterThan(1);
    expect(screen.getByTestId('tranche-savings')).toBeInTheDocument();
    expect(screen.getByTestId('net-cost-comparison')).toBeInTheDocument();
    expect(screen.getByTestId('path-swap-cost')).toHaveTextContent('−');
  });

  it('does not warn for a small swap against a deep pool', () => {
    render(<LiquidityDepthOptimizerPanel amount={1_000} pool={deepPool} />);

    expect(screen.queryByTestId('slippage-warning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tranche-recommendation')).not.toBeInTheDocument();
    expect(screen.getByTestId('net-cost-comparison')).toBeInTheDocument();
    expect(screen.queryByTestId('liquidity-demo-note')).not.toBeInTheDocument();
  });

  it('labels illustrative pool data and handles a missing pool gracefully', () => {
    const { unmount } = render(<LiquidityDepthOptimizerPanel amount={1_000} pool={shallowPool} />);
    expect(screen.getByTestId('liquidity-demo-note')).toBeInTheDocument();
    unmount();

    render(<LiquidityDepthOptimizerPanel amount={1_000} pool={null} error="no pool" />);
    expect(screen.getByTestId('liquidity-unavailable')).toHaveTextContent('no pool');
  });

  it('honors a custom impact threshold', () => {
    render(<LiquidityDepthOptimizerPanel amount={1_000} pool={shallowPool} maxImpactPct={50} />);
    expect(screen.queryByTestId('slippage-warning')).not.toBeInTheDocument();
  });
});
