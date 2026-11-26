import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { StrKey } from '@stellar/stellar-sdk';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/store/walletStore', () => {
  const address = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 9));
  return {
    useWalletStore: () => ({ address }),
    useActiveWalletAddress: () => address,
    canRaiseDispute: () => true,
  };
});
vi.mock('@/lib/api', () => ({
  authFetch: vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ projects: [], pagination: { page: 1, limit: 6, totalProjects: 0, totalPages: 1 } }),
  }),
}));

import { ClientDashboard } from './ClientDashboard';

const TREASURY = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 1));

describe('ClientDashboard create form: DAO proposal', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ balances: [] }) })
    );
  });

  it('keeps Generate DAO Proposal disabled until the project has a title and a budget', () => {
    render(<ClientDashboard defaultTab="create" />);
    const button = screen.getByRole('button', { name: /Generate DAO Proposal/ });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Landing page redesign'), { target: { value: 'My Project' } });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('900'), { target: { value: '900' } });
    expect(button).toBeEnabled();
  });

  it('opens the generator seeded from the form and produces calldata for the entered budget', async () => {
    render(<ClientDashboard defaultTab="create" />);
    fireEvent.change(screen.getByPlaceholderText('Landing page redesign'), { target: { value: 'My Project' } });
    fireEvent.change(screen.getByPlaceholderText('900'), { target: { value: '900' } });

    fireEvent.click(screen.getByRole('button', { name: /Generate DAO Proposal/ }));

    const dialog = await screen.findByRole('dialog', { name: 'DAO proposal generator' });
    expect(within(dialog).getByLabelText('Proposal title')).toHaveValue('Fund escrow: My Project');
    expect(within(dialog).getByText(/900 USDC/)).toBeInTheDocument();
    // No milestones were added, so the whole budget becomes one tranche.
    expect(within(dialog).getByText(/across 1 milestone$/)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/DAO treasury address/), { target: { value: TREASURY } });
    const md = (within(dialog).getByRole('textbox', { name: 'Proposal markdown' }) as HTMLTextAreaElement).value;
    expect(md).toContain('| 1 | Full project | 900 USDC | n/a |');
    expect(md).toContain(`\`${TREASURY}\``);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close DAO proposal generator' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'DAO proposal generator' })).not.toBeInTheDocument());
  });
});
