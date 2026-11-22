import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FiatOnRampModal } from './FiatOnRampModal';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/soroban', () => ({ HORIZON_URL: 'https://h.test' }));
vi.mock('@stellar/freighter-api', () => ({ signTransaction: vi.fn() }));

const resolveAnchor = vi.fn();
const fetchDepositInfo = vi.fn();
const fetchUsdcBalance = vi.fn();
const waitForUsdcDeposit = vi.fn();

vi.mock('@/lib/anchor-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/anchor-client')>('@/lib/anchor-client');
  return {
    ...actual,
    resolveAnchor: (...a: unknown[]) => resolveAnchor(...a),
    fetchDepositInfo: (...a: unknown[]) => fetchDepositInfo(...a),
    fetchUsdcBalance: (...a: unknown[]) => fetchUsdcBalance(...a),
    waitForUsdcDeposit: (...a: unknown[]) => waitForUsdcDeposit(...a),
  };
});

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  walletAddress: 'GABC',
  onDepositDetected: vi.fn(),
};

describe('FiatOnRampModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAnchor.mockResolvedValue({ transferServer: 'https://a.test', webAuthEndpoint: 'https://a.test/auth' });
    fetchDepositInfo.mockResolvedValue({ enabled: true, fee: { percent: 1, fixed: 2 } });
    fetchUsdcBalance.mockResolvedValue(0);
  });

  it('offers card and cash/bank options', () => {
    render(<FiatOnRampModal {...baseProps} />);
    expect(screen.getByRole('radio', { name: /Credit \/ debit card/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Cash or bank/ })).toBeInTheDocument();
  });

  it('shows a transparent MoonPay fee breakdown before confirming', () => {
    render(<FiatOnRampModal {...baseProps} suggestedAmount={100} />);
    fireEvent.click(screen.getByRole('radio', { name: /Credit \/ debit card/ }));
    // 4.5% of 100 + 3.99 fixed = 8.49
    expect(screen.getByTestId('fee-total')).toHaveTextContent('8.49');
    expect(screen.getByTestId('fee-net')).toHaveTextContent('91.51');
    expect(screen.getByTestId('fee-breakdown')).toHaveTextContent('estimate');
  });

  it("loads the anchor's published fees for MoneyGram", async () => {
    render(<FiatOnRampModal {...baseProps} suggestedAmount={100} />);
    fireEvent.click(screen.getByRole('radio', { name: /Cash or bank/ }));
    await waitFor(() => expect(screen.getByTestId('fee-total')).toHaveTextContent('3.00'));
    expect(screen.getByTestId('fee-net')).toHaveTextContent('97.00');
  });

  it('opens the MoonPay widget, auto-detects the deposit and triggers funding', async () => {
    let resolveDeposit: (n: number) => void = () => {};
    waitForUsdcDeposit.mockReturnValue(new Promise<number>((r) => (resolveDeposit = r)));
    render(<FiatOnRampModal {...baseProps} suggestedAmount={100} />);
    fireEvent.click(screen.getByRole('radio', { name: /Credit \/ debit card/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and continue' }));
    const frame = await screen.findByTestId('onramp-frame');
    expect(frame.getAttribute('src')).toContain('currencyCode=usdc_xlm');
    resolveDeposit(95);
    await waitFor(() =>
      expect(baseProps.onDepositDetected).toHaveBeenCalledWith({ amount: 95, provider: 'moonpay' })
    );
  });

  it('surfaces an anchor that has USDC deposits disabled', async () => {
    fetchDepositInfo.mockResolvedValue({ enabled: false, fee: { percent: 0, fixed: 0 } });
    render(<FiatOnRampModal {...baseProps} />);
    fireEvent.click(screen.getByRole('radio', { name: /Cash or bank/ }));
    await waitFor(() => expect(screen.getByTestId('fee-error')).toHaveTextContent('not accepting USDC'));
  });

  it('renders nothing when closed', () => {
    render(<FiatOnRampModal {...baseProps} isOpen={false} />);
    expect(screen.queryByTestId('fiat-onramp-modal')).not.toBeInTheDocument();
  });
});
