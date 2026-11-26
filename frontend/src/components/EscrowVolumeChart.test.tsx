import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { EscrowVolumeChart, settlementRange } from './EscrowVolumeChart';
import type { EscrowAnalytics } from '@/lib/api';

vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>();
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: ReactNode }) =>
      <original.ResponsiveContainer width={560} height={230}>{children}</original.ResponsiveContainer>,
  };
});

afterEach(cleanup);

const now = new Date('2026-11-23T12:00:00Z');
const analytics: EscrowAnalytics = {
  capital: [{ token: 'USDC', locked: 250, contracts: 3 }, { token: 'XLM', locked: 800, contracts: 2 }],
  settlements: [
    { token: 'USDC', date: '2026-10-28', volume: 90, transactions: 1, averageBudget: 120 },
    { token: 'USDC', date: '2026-11-20', volume: 30, transactions: 2, averageBudget: 60 },
    { token: 'XLM', date: '2026-11-20', volume: 200, transactions: 1, averageBudget: 500 },
  ],
};

it('renders real SVG paths and updates the date domain when changing range', () => {
  const { container } = render(<EscrowVolumeChart analytics={analytics} now={now} />);
  const path = () => container.querySelector('.recharts-area-curve')?.getAttribute('d');
  const initialPath = path();
  expect(initialPath).toMatch(/^M/);
  expect(container.querySelectorAll('.recharts-pie-sector path').length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText(/2026-10-25 to 2026-11-23/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '7D' }));
  expect(screen.getByText(/2026-11-17 to 2026-11-23/)).toBeInTheDocument();
  expect(path()).not.toBe(initialPath);
  expect(path()).toMatch(/^M/);
});

it('fills missing dates and excludes other tokens and settlements outside the range', () => {
  const rows = settlementRange(analytics.settlements, '7D', 'USDC', now);
  expect(rows).toHaveLength(7);
  expect(rows.map((row) => row.volume)).toEqual([0, 0, 0, 30, 0, 0, 0]);
});
