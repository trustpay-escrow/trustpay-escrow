import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PathPaymentSwapWidget } from './PathPaymentSwapWidget';
import type { PathQuote } from '@/lib/path-payment';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/soroban', () => ({ HORIZON_URL: 'https://h.test', swapViaPathPayment: vi.fn() }));

const quote = (impact = 0.5): PathQuote => ({
  route: { sourceAmount: 100, destinationAmount: 20, path: [{ code: 'EURC', issuer: 'GX' }] },
  sourceAmount: 100,
  destinationAmount: 20,
  effectiveRate: 0.2,
  spotRate: 0.201,
  priceImpactPct: impact,
  hops: 1,
});

async function enterAmount(value: string) {
  fireEvent.change(screen.getByLabelText('Amount to swap'), { target: { value } });
  await waitFor(() => expect(screen.getByTestId('quote-output')).toBeInTheDocument(), { timeout: 2000 });
}

describe('PathPaymentSwapWidget', () => {
  it('shows input, estimated output, rate, impact and route', async () => {
    const quoteFetcher = vi.fn().mockResolvedValue(quote());
    render(<PathPaymentSwapWidget walletAddress="GABC" quoteFetcher={quoteFetcher} />);
    await enterAmount('100');
    expect(quoteFetcher).toHaveBeenCalledWith(expect.objectContaining({ source: 'XLM', destination: 'USDC', amount: 100 }));
    expect(screen.getByTestId('quote-input')).toHaveTextContent('100.00 XLM');
    expect(screen.getByTestId('quote-output')).toHaveTextContent('20.00 USDC');
    expect(screen.getByTestId('quote-rate')).toHaveTextContent('0.200000');
    expect(screen.getByTestId('quote-impact')).toHaveTextContent('0.50%');
    expect(screen.getByTestId('quote-route')).toHaveTextContent('XLM → EURC → USDC');
  });

  it('recomputes the minimum when slippage tolerance changes', async () => {
    render(<PathPaymentSwapWidget walletAddress="GABC" quoteFetcher={vi.fn().mockResolvedValue(quote())} />);
    await enterAmount('100');
    expect(screen.getByTestId('quote-min')).toHaveTextContent('19.80 USDC');
    fireEvent.click(screen.getByRole('radio', { name: '2.5%' }));
    expect(screen.getByTestId('quote-min')).toHaveTextContent('19.50 USDC');
    fireEvent.click(screen.getByRole('radio', { name: '0.5%' }));
    expect(screen.getByTestId('quote-min')).toHaveTextContent('19.90 USDC');
  });

  it('warns on high price impact and on falling short of the required amount', async () => {
    render(<PathPaymentSwapWidget walletAddress="GABC" requiredAmount={25} quoteFetcher={vi.fn().mockResolvedValue(quote(6))} />);
    await enterAmount('100');
    expect(screen.getByTestId('impact-warning')).toBeInTheDocument();
    expect(screen.getByTestId('shortfall-warning')).toBeInTheDocument();
  });

  it('shows an error when no route exists', async () => {
    render(<PathPaymentSwapWidget walletAddress="GABC" quoteFetcher={vi.fn().mockResolvedValue(null)} />);
    fireEvent.change(screen.getByLabelText('Amount to swap'), { target: { value: '5' } });
    await waitFor(() => expect(screen.getByTestId('quote-error')).toHaveTextContent('No route found'), { timeout: 2000 });
  });

  it('executes the swap with the slippage-protected minimum', async () => {
    const swapExecutor = vi.fn().mockResolvedValue({ success: true, txHash: 'abc', destMin: '19.8000000' });
    const onSwapComplete = vi.fn();
    render(
      <PathPaymentSwapWidget
        walletAddress="GABC"
        quoteFetcher={vi.fn().mockResolvedValue(quote())}
        swapExecutor={swapExecutor}
        onSwapComplete={onSwapComplete}
      />
    );
    await enterAmount('100');
    fireEvent.click(screen.getByRole('button', { name: 'Swap to USDC' }));
    await waitFor(() => expect(swapExecutor).toHaveBeenCalled());
    expect(swapExecutor.mock.calls[0][0]).toMatchObject({
      callerAddress: 'GABC',
      sendAmount: '100.0000000',
      destMin: '19.8000000',
    });
    await waitFor(() => expect(onSwapComplete).toHaveBeenCalledWith({ txHash: 'abc', received: 19.8, token: 'USDC' }));
  });

  it('disables swapping without a connected wallet', async () => {
    render(<PathPaymentSwapWidget walletAddress={null} quoteFetcher={vi.fn().mockResolvedValue(quote())} />);
    await enterAmount('100');
    expect(screen.getByRole('button', { name: 'Connect wallet to swap' })).toBeDisabled();
  });
});
