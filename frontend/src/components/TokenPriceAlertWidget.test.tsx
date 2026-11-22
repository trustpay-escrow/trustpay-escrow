import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TokenPriceAlertWidget } from './TokenPriceAlertWidget';
import { PRICE_ALERTS_STORAGE_KEY } from '@/lib/price-alerts';

const priceState = vi.hoisted(() => ({ prices: {} as Record<string, number> }));

vi.mock('@/hooks/useTokenRates', () => ({
  useTokenPrices: () => ({ prices: priceState.prices, loading: false, error: null, lastUpdated: 1 }),
}));

function addAlert(token: string, direction: string, target: string) {
  fireEvent.change(screen.getByTestId('price-alert-token'), { target: { value: token } });
  fireEvent.change(screen.getByTestId('price-alert-direction'), { target: { value: direction } });
  fireEvent.change(screen.getByTestId('price-alert-target'), { target: { value: target } });
  fireEvent.click(screen.getByTestId('price-alert-add'));
}

beforeEach(() => {
  window.localStorage.clear();
  priceState.prices = { XLM: 0.1, USDC: 1 };
});

afterEach(() => vi.unstubAllGlobals());

describe('TokenPriceAlertWidget (#253)', () => {
  it('adds an alert to the list and persists it', async () => {
    render(<TokenPriceAlertWidget />);
    expect(screen.getByTestId('price-alert-empty')).toBeInTheDocument();

    addAlert('XLM', 'above', '0.15');

    expect(screen.getByTestId('price-alert-list')).toHaveTextContent('XLM > $0.15');
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(PRICE_ALERTS_STORAGE_KEY) ?? '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ token: 'XLM', direction: 'above', target: 0.15 });
    });
  });

  it('deletes an alert from the list and from storage', async () => {
    render(<TokenPriceAlertWidget />);
    addAlert('XLM', 'above', '0.15');
    addAlert('USDC', 'below', '0.98');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    fireEvent.click(screen.getByLabelText('Delete alert XLM > $0.15'));

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText('XLM > $0.15')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem(PRICE_ALERTS_STORAGE_KEY) ?? '[]')).toHaveLength(1);
    });
  });

  it('rejects an invalid target with an error', () => {
    render(<TokenPriceAlertWidget />);
    addAlert('XLM', 'above', '0');
    expect(screen.getByRole('alert')).toHaveTextContent('greater than 0');
    expect(screen.getByTestId('price-alert-empty')).toBeInTheDocument();
  });

  it('restores saved alerts on load', () => {
    window.localStorage.setItem(
      PRICE_ALERTS_STORAGE_KEY,
      JSON.stringify([{ id: 's1', token: 'XLM', direction: 'above', target: 0.2, createdAt: 1 }])
    );
    render(<TokenPriceAlertWidget />);
    expect(screen.getByTestId('price-alert-list')).toHaveTextContent('XLM > $0.20');
  });

  it('fires a browser notification once on a breach and offers Fund Escrow Now', async () => {
    const created: Array<[string, NotificationOptions | undefined]> = [];
    class FakeNotification {
      static permission = 'granted';
      static requestPermission = vi.fn();
      constructor(title: string, options?: NotificationOptions) {
        created.push([title, options]);
      }
    }
    vi.stubGlobal('Notification', FakeNotification);
    priceState.prices = { XLM: 0.2, USDC: 1 };

    const onFundNow = vi.fn();
    render(<TokenPriceAlertWidget onFundNow={onFundNow} />);
    addAlert('XLM', 'above', '0.15');

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0][1]?.body).toContain('XLM > $0.15');

    const fund = await screen.findByText('Fund Escrow Now');
    fireEvent.click(fund);
    expect(onFundNow).toHaveBeenCalledWith(expect.objectContaining({ token: 'XLM' }), 0.2);
    expect(created).toHaveLength(1); // not re-fired on later renders
  });
});
