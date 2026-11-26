import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardRouter } from './DashboardRouter';

const wallet = vi.hoisted(() => ({
  address: ('G' + 'A'.repeat(55)) as string | null,
  activeRole: 'client',
  activeAddress: null as string | null,
  walletName: 'Freighter',
  setActiveRole: vi.fn(),
  setWalletInfo: vi.fn(),
  disconnect: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/store/walletStore', () => ({ useWalletStore: () => wallet, useActiveWalletAddress: () => wallet.activeAddress || wallet.address }));
vi.mock('./RoleSwitcher', () => ({ RoleSwitcher: () => <span>Role switcher</span> }));
vi.mock('./OrgWalletSwitcher', () => ({ OrgWalletSwitcher: () => <span>Organisation wallets</span> }));
vi.mock('./ArbiterDashboard', () => ({ ArbiterDashboard: () => <main>Arbiter projects</main> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('./ClientDashboard', () => ({ ClientDashboard: () => <main>Client projects</main> }));
vi.mock('./FreelancerDashboard', () => ({ FreelancerDashboard: () => <main>Freelancer projects</main> }));
vi.mock('./NotificationBell', () => ({ default: () => null }));
vi.mock('sonner', () => ({ toast }));

const address = 'G' + 'A'.repeat(55);
const copyButton = () => screen.getByRole('button', { name: 'Copy full Stellar address' });

beforeEach(() => {
  vi.clearAllMocks();
  wallet.address = address;
  wallet.activeAddress = null;
  wallet.activeRole = 'client';
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('connected wallet in the real dashboard header', () => {
  it.each(['client', 'freelancer', 'arbiter'])('shows the copy affordance and hover tooltip for %s', role => {
    wallet.activeRole = role;
    render(<DashboardRouter />);
    const button = copyButton();
    expect(screen.getByText('Wallet:').parentElement).toContainElement(button);
    expect(button.querySelector('svg')).not.toBeNull();
    expect(button.querySelector('[data-crypto-id]')).toHaveTextContent('GAAAAA...AAAA');
    expect(button.querySelector('[data-crypto-id]')).toHaveAttribute('title', '');
    fireEvent.mouseEnter(button);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Click to copy full Stellar address');
    expect(button).toHaveAccessibleDescription('Click to copy full Stellar address');
    fireEvent.mouseLeave(button.parentElement!);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('copies the complete address and confirms only after success', async () => {
    let resolveCopy!: () => void;
    vi.mocked(navigator.clipboard.writeText).mockReturnValue(
      new Promise<void>(resolve => { resolveCopy = resolve; })
    );
    render(<DashboardRouter />);
    fireEvent.mouseEnter(copyButton());
    fireEvent.click(copyButton());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(address);
    expect(screen.getByRole('tooltip')).not.toHaveTextContent('Copied!');
    await act(async () => { resolveCopy(); });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Copied!');
    fireEvent.mouseLeave(copyButton().parentElement!);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('does not confirm a failed clipboard write', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('denied'));
    render(<DashboardRouter />);
    fireEvent.mouseEnter(copyButton());
    await act(async () => { fireEvent.click(copyButton()); });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Click to copy full Stellar address');
    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('supports keyboard focus and Escape without moving focus', () => {
    render(<DashboardRouter />);
    const button = copyButton();
    const matches = button.matches.bind(button);
    vi.spyOn(button, 'matches').mockImplementation(selector =>
      selector === ':focus-visible' ? true : matches(selector)
    );
    act(() => button.focus());
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('keeps Escape dismissed after a pending write completes', async () => {
    let resolveCopy!: () => void;
    vi.mocked(navigator.clipboard.writeText).mockReturnValue(
      new Promise<void>(resolve => { resolveCopy = resolve; })
    );
    render(<DashboardRouter />);
    fireEvent.mouseEnter(copyButton());
    fireEvent.click(copyButton());
    fireEvent.keyDown(document, { key: 'Escape' });
    await act(async () => { resolveCopy(); });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('discards the previous wallet pending result on address changes', async () => {
    let resolveCopy!: () => void;
    vi.mocked(navigator.clipboard.writeText).mockReturnValue(
      new Promise<void>(resolve => { resolveCopy = resolve; })
    );
    const view = render(<DashboardRouter />);
    fireEvent.mouseEnter(copyButton());
    fireEvent.click(copyButton());
    wallet.address = 'G' + 'B'.repeat(55);
    view.rerender(<DashboardRouter />);
    await act(async () => { resolveCopy(); });
    wallet.address = address;
    view.rerender(<DashboardRouter />);
    fireEvent.mouseEnter(copyButton());
    expect(screen.getByRole('tooltip')).toHaveTextContent('Click to copy full Stellar address');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('copies the active organisation wallet instead of the primary login wallet', async () => {
    wallet.activeAddress = 'G' + 'C'.repeat(55);
    const view = render(<DashboardRouter />);
    await act(async () => { fireEvent.click(copyButton()); });
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(wallet.activeAddress);
    wallet.activeAddress = 'G' + 'D'.repeat(55);
    view.rerender(<DashboardRouter />);
    await act(async () => { fireEvent.click(copyButton()); });
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(wallet.activeAddress);
  });

  it('removes the header copy control after disconnect', () => {
    const view = render(<DashboardRouter />);
    wallet.address = null;
    view.rerender(<DashboardRouter />);
    expect(screen.queryByRole('button', { name: 'Copy full Stellar address' })).not.toBeInTheDocument();
    expect(screen.getByText('Authentication Required')).toBeInTheDocument();
  });
});
