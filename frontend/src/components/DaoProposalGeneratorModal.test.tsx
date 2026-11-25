import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StrKey } from '@stellar/stellar-sdk';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import { SUPPORTED_TOKENS } from '@/config/tokens';
import { DaoProposalGeneratorModal, DaoProposalGeneratorModalProps } from './DaoProposalGeneratorModal';

const account = (byte: number) => StrKey.encodeEd25519PublicKey(Buffer.alloc(32, byte));
const TREASURY = account(1);

// Stable reference: the modal memoises on `defaults`.
const DEFAULTS: DaoProposalGeneratorModalProps['defaults'] = {
  projectTitle: 'Landing page redesign',
  description: 'Redesign the marketing site.',
  category: 'Design',
  token: 'USDC',
  tokenAddress: SUPPORTED_TOKENS.USDC.issuerOrContractAddress,
  milestones: [
    { title: 'Wireframes', amount: 400 },
    { title: 'Final design', amount: 850.5 },
  ],
  yieldEnabled: false,
};

const renderModal = (over: Partial<DaoProposalGeneratorModalProps> = {}) =>
  render(<DaoProposalGeneratorModal isOpen onClose={() => {}} defaults={DEFAULTS} {...over} />);

const setTreasury = (value: string) =>
  fireEvent.change(screen.getByLabelText(/DAO treasury address/), { target: { value } });

describe('DaoProposalGeneratorModal', () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    vi.mocked(navigator.clipboard.writeText).mockClear();
  });

  it('renders nothing while closed', () => {
    const { container } = renderModal({ isOpen: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('re-seeds its fields from the latest defaults every time it opens', () => {
    const { rerender } = render(
      <DaoProposalGeneratorModal isOpen={false} onClose={() => {}} defaults={{ ...DEFAULTS, projectTitle: '' }} />
    );
    // The project is named while the modal is closed...
    rerender(
      <DaoProposalGeneratorModal isOpen onClose={() => {}} defaults={{ ...DEFAULTS, projectTitle: 'Named later' }} />
    );
    expect(screen.getByLabelText('Proposal title')).toHaveValue('Fund escrow: Named later');

    // ...and an edit made in one session does not leak into the next.
    fireEvent.change(screen.getByLabelText('Proposal title'), { target: { value: 'Edited' } });
    rerender(<DaoProposalGeneratorModal isOpen={false} onClose={() => {}} defaults={DEFAULTS} />);
    rerender(<DaoProposalGeneratorModal isOpen onClose={() => {}} defaults={DEFAULTS} />);
    expect(screen.getByLabelText('Proposal title')).toHaveValue('Fund escrow: Landing page redesign');
  });

  it('prefills the proposal title and shows the milestone total', () => {
    renderModal();
    expect(screen.getByLabelText('Proposal title')).toHaveValue('Fund escrow: Landing page redesign');
    expect(screen.getByText(/1,250.5 USDC/)).toBeInTheDocument();
    expect(screen.getByText(/across 2 milestones/)).toBeInTheDocument();
  });

  it('withholds the proposal until the treasury address is valid', () => {
    renderModal();
    expect(screen.getByRole('alert')).toHaveTextContent('DAO treasury address is required');
    expect(screen.getByText('Fix the highlighted fields to generate the proposal.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Proposal markdown' })).not.toBeInTheDocument();

    setTreasury('GNOTAREALADDRESS');
    expect(screen.getByRole('alert')).toHaveTextContent('valid Stellar address');
    expect(screen.queryByRole('textbox', { name: 'Proposal markdown' })).not.toBeInTheDocument();
  });

  it('generates forum markdown once the treasury is valid', () => {
    renderModal();
    setTreasury(TREASURY);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const md = screen.getByRole('textbox', { name: 'Proposal markdown' }) as HTMLTextAreaElement;
    expect(md.value).toContain('# Fund escrow: Landing page redesign');
    expect(md.value).toContain('| 1 | Wireframes | 400 USDC | n/a |');
    expect(md.value).toContain('**1,250.5 USDC**');
    expect(md.value).toContain(`\`${TREASURY}\``);
    expect(md.value).toContain('**Voting period:** 7 days');
  });

  it('switches to Soroban calldata that encodes the same escrow terms', () => {
    renderModal();
    setTreasury(TREASURY);
    fireEvent.click(screen.getByRole('tab', { name: 'Soroban calldata' }));

    expect(screen.getByRole('tab', { name: 'Soroban calldata' })).toHaveAttribute('aria-selected', 'true');
    const raw = (screen.getByRole('textbox', { name: 'Soroban calldata' }) as HTMLTextAreaElement).value;
    const json = JSON.parse(raw);
    expect(json.function).toBe('create_project');
    expect(json.args.map((a: { name: string }) => a.name)).toEqual([
      'client',
      'freelancer',
      'arbiter',
      'token',
      'milestone_amounts',
      'yield_enabled',
    ]);
    expect(json.args[0].value).toBe(TREASURY);
    expect(json.args[4].value).toBe('[400, 850.5]');
    expect(json.totalAmount).toBe(1250.5);
    expect(json.hostFunctionXdr).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('updates the output as the proposal title and voting period change', () => {
    renderModal();
    setTreasury(TREASURY);
    fireEvent.change(screen.getByLabelText('Proposal title'), { target: { value: 'Q1 Design Grant' } });
    fireEvent.change(screen.getByLabelText('Voting period (days)'), { target: { value: '14' } });

    const md = (screen.getByRole('textbox', { name: 'Proposal markdown' }) as HTMLTextAreaElement).value;
    expect(md).toContain('# Q1 Design Grant');
    expect(md).toContain('**Voting period:** 14 days');
  });

  it('rejects an out-of-range voting period and an invalid optional address', () => {
    renderModal();
    setTreasury(TREASURY);

    fireEvent.change(screen.getByLabelText('Voting period (days)'), { target: { value: '0' } });
    expect(screen.getByRole('alert')).toHaveTextContent('between 1 and 90');
    expect(screen.queryByRole('textbox', { name: 'Proposal markdown' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Voting period (days)'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText(/Freelancer address/), { target: { value: 'bogus' } });
    expect(screen.getByRole('alert')).toHaveTextContent('valid Stellar address');
  });

  it('blocks generation when the escrow has no payable milestones', () => {
    renderModal({ defaults: { ...DEFAULTS, milestones: [] } });
    setTreasury(TREASURY);
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one milestone');
    expect(screen.queryByRole('textbox', { name: 'Proposal markdown' })).not.toBeInTheDocument();
  });

  it('copies the active tab to the clipboard', async () => {
    renderModal();
    setTreasury(TREASURY);

    fireEvent.click(screen.getByRole('button', { name: 'Copy Markdown' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
    expect(vi.mocked(navigator.clipboard.writeText).mock.calls[0][0]).toContain('# Fund escrow');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Proposal markdown copied'));

    fireEvent.click(screen.getByRole('tab', { name: 'Soroban calldata' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Calldata' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2));
    expect(JSON.parse(vi.mocked(navigator.clipboard.writeText).mock.calls[1][0]).function).toBe('create_project');
  });

  it('reports a clipboard failure instead of throwing', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
    renderModal();
    setTreasury(TREASURY);
    fireEvent.click(screen.getByRole('button', { name: 'Copy Markdown' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  describe('download', () => {
    let click: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() }));
      click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    });
    afterEach(() => {
      click.mockRestore();
      vi.unstubAllGlobals();
    });

    it('saves markdown as .md and calldata as .json', () => {
      renderModal();
      setTreasury(TREASURY);

      fireEvent.click(screen.getByRole('button', { name: 'Download' }));
      expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('dao-escrow-proposal.md');

      fireEvent.click(screen.getByRole('tab', { name: 'Soroban calldata' }));
      fireEvent.click(screen.getByRole('button', { name: 'Download' }));
      expect((click.mock.contexts[1] as HTMLAnchorElement).download).toBe('dao-escrow-calldata.json');
    });
  });

  it('closes on Escape, the close button and the backdrop, but not on inside clicks', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Close DAO proposal generator' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
