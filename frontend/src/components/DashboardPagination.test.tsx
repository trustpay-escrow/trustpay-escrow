import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { ClientDashboard } from './ClientDashboard';
import { FreelancerDashboard } from './FreelancerDashboard';

const wallet = vi.hoisted(() => ({ address: 'GCLIENT', activeAddress: null as string | null }));
vi.mock('@/store/walletStore', () => ({
  useWalletStore: () => wallet,
  useActiveWalletAddress: () => wallet.activeAddress ?? wallet.address,
  canSubmitProposal: () => ({ allowed: true }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/api', () => ({ authFetch: (...args: Parameters<typeof fetch>) => fetch(...args) }));
vi.mock('@/hooks/useCreateProjectForm', () => ({
  useTokenBalance: () => ({ balance: null, loading: false }),
  useTokenBalances: () => ({ balances: {}, loading: false }),
  getBalanceShortfall: () => null,
}));
vi.mock('./ProjectChatModal', () => ({ ProjectChatModal: () => null }));
vi.mock('./MilestoneSubmitModal', () => ({ MilestoneSubmitModal: () => null }));
vi.mock('./DownloadReceiptButton', () => ({ DownloadReceiptButton: () => null }));
vi.mock('./ProjectAuditLog', () => ({ ProjectAuditLog: () => null }));
vi.mock('./CalendarExportButton', () => ({ CalendarExportButton: () => null }));

let total = 48;
function response(url: string) {
  if (!url.includes('/api/projects?')) return { ok: true, json: async () => ({ proposals: [] }) };
  const params = new URL(url).searchParams;
  const page = Number(params.get('page'));
  const limit = Number(params.get('limit'));
  const start = (page - 1) * limit;
  return { ok: true, json: async () => ({
    projects: Array.from({ length: Math.max(0, Math.min(limit, total - start)) }, (_, i) => ({
      id: String(start + i), title: `Project ${start + i + 1}`, description: 'Test project',
      category: 'Development', status: 'open', budget: 100,
    })),
    pagination: { page, totalProjects: total, totalPages: Math.ceil(total / limit) || 1 },
  }) };
}

beforeEach(() => {
  total = 48;
  wallet.address = 'GCLIENT';
  wallet.activeAddress = null;
  vi.stubGlobal('fetch', vi.fn(async (input) => response(String(input))));
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  Element.prototype.scrollIntoView = vi.fn();
});

describe.each([['client', ClientDashboard], ['freelancer', FreelancerDashboard]] as const)(
  '%s dashboard pagination', (_role, Dashboard) => {
    it('requests the selected page/size and recovers when the dataset shrinks', async () => {
      render(<Dashboard />);
      await screen.findByText('Showing 1-10 of 48 projects');
      expect(screen.getByText('Project 10')).toBeInTheDocument();
      expect(screen.queryByText('Project 11')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Page 5' }));
      await screen.findByText('Showing 41-48 of 48 projects');
      expect(screen.getByText('Project 48')).toBeInTheDocument();
      fireEvent.change(screen.getByRole('combobox', { name: 'Rows per page' }), { target: { value: '25' } });
      await screen.findByText('Showing 1-25 of 48 projects');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('page=1&limit=25'));
      fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
      await screen.findByText('Showing 26-48 of 48 projects');
      total = 12;
      fireEvent.click(screen.getByRole('button', { name: 'Page 1' }));
      await screen.findByText('Showing 1-12 of 12 projects');
      expect(screen.getByRole('combobox', { name: 'Rows per page' })).toHaveValue('25');
    });

    it('clamps an out-of-range response instead of leaving an empty page', async () => {
      render(<Dashboard />);
      await screen.findByText('Showing 1-10 of 48 projects');
      total = 12;
      fireEvent.click(screen.getByRole('button', { name: 'Page 5' }));
      await screen.findByText('Showing 11-12 of 12 projects');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('page=2&limit=10'));
    });

    it('ignores a response from the previous wallet', async () => {
      const originalFetch = fetch;
      let resolveOld!: (value: ReturnType<typeof response>) => void;
      vi.stubGlobal('fetch', vi.fn((input) => {
        if (String(input).includes('/api/projects?') && wallet.address === 'GCLIENT') {
          return new Promise((resolve) => { resolveOld = resolve; });
        }
        return originalFetch(input);
      }));
      const { rerender } = render(<Dashboard />);
      await waitFor(() => expect(resolveOld).toBeDefined());
      wallet.address = 'GOTHER';
      total = 3;
      rerender(<Dashboard />);
      await screen.findByText('Showing 1-3 of 3 projects');
      total = 48;
      await act(async () => { resolveOld(response('http://localhost/api/projects?page=1&limit=10')); });
      expect(screen.getByText('Showing 1-3 of 3 projects')).toBeInTheDocument();
    });
  },
);


it('resets client pagination and scopes requests when the active wallet changes', async () => {
  wallet.activeAddress = 'GORG1';
  const { rerender } = render(<ClientDashboard />);
  await screen.findByText('Showing 1-10 of 48 projects');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('client_address=GORG1'));
  fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
  await screen.findByText('Showing 11-20 of 48 projects');
  wallet.activeAddress = 'GORG2';
  rerender(<ClientDashboard />);
  await screen.findByText('Showing 1-10 of 48 projects');
  expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('page=1&limit=10&client_address=GORG2'));
});
