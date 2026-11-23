import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  TokenPriceAlertWidget,
  evaluatePriceAlert,
  PriceAlert,
  STORAGE_KEY,
} from './TokenPriceAlertWidget';

describe('TokenPriceAlertWidget & Evaluation Logic (#253)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('evaluatePriceAlert logic', () => {
    it('evaluates ABOVE condition accurately', () => {
      const alert: PriceAlert = {
        id: '1',
        token: 'XLM',
        condition: 'ABOVE',
        threshold: 0.15,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      expect(evaluatePriceAlert(alert, 0.16)).toBe(true);
      expect(evaluatePriceAlert(alert, 0.15)).toBe(true);
      expect(evaluatePriceAlert(alert, 0.14)).toBe(false);
    });

    it('evaluates BELOW condition accurately', () => {
      const alert: PriceAlert = {
        id: '2',
        token: 'XLM',
        condition: 'BELOW',
        threshold: 0.10,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      expect(evaluatePriceAlert(alert, 0.09)).toBe(true);
      expect(evaluatePriceAlert(alert, 0.10)).toBe(true);
      expect(evaluatePriceAlert(alert, 0.11)).toBe(false);
    });

    it('returns false when alert is inactive regardless of price', () => {
      const alert: PriceAlert = {
        id: '3',
        token: 'XLM',
        condition: 'ABOVE',
        threshold: 0.10,
        isActive: false,
        createdAt: new Date().toISOString(),
      };
      expect(evaluatePriceAlert(alert, 0.50)).toBe(false);
    });
  });

  describe('Widget Component Rendering & Interactions', () => {
    it('renders the alert widget and empty state message', () => {
      render(<TokenPriceAlertWidget />);
      expect(screen.getByTestId('token-price-alert-widget')).toBeInTheDocument();
      expect(screen.getByText(/Token Price & Funding Alert Trigger/i)).toBeInTheDocument();
      expect(screen.getByText(/No price alerts configured/i)).toBeInTheDocument();
    });

    it('adds a new price alert and persists to localStorage', () => {
      render(<TokenPriceAlertWidget />);
      const thresholdInput = screen.getByTestId('threshold-input');
      const addButton = screen.getByTestId('add-alert-button');

      fireEvent.change(thresholdInput, { target: { value: '0.1500' } });
      fireEvent.click(addButton);

      expect(screen.getByText(/Configured Thresholds \(1\)/i)).toBeInTheDocument();
      const list = screen.getByTestId('alerts-list');
      expect(within(list).getByText('XLM')).toBeInTheDocument();
      expect(within(list).getByText(/>= \$0.1500/i)).toBeInTheDocument();

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      expect(stored.length).toBe(1);
      expect(stored[0].threshold).toBe(0.15);
    });

    it('removes an alert when clicking Remove', () => {
      const initialAlerts: PriceAlert[] = [
        {
          id: 'test-alert-1',
          token: 'XLM',
          condition: 'ABOVE',
          threshold: 0.20,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialAlerts));

      render(<TokenPriceAlertWidget />);
      expect(screen.getByText(/>= \$0.2000/i)).toBeInTheDocument();

      const removeBtn = screen.getByTestId('delete-alert-test-alert-1');
      fireEvent.click(removeBtn);

      expect(screen.queryByText(/>= \$0.2000/i)).not.toBeInTheDocument();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      expect(stored.length).toBe(0);
    });

    it('toggles an alert between enabled and disabled', () => {
      const initialAlerts: PriceAlert[] = [
        {
          id: 'test-alert-2',
          token: 'USDC',
          condition: 'BELOW',
          threshold: 0.99,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialAlerts));

      render(<TokenPriceAlertWidget />);
      const toggleBtn = screen.getByTestId('toggle-alert-test-alert-2');
      expect(toggleBtn).toHaveTextContent('Disable');

      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveTextContent('Enable');

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      expect(stored[0].isActive).toBe(false);
    });

    it('renders the Fund Escrow Now quick action link when a threshold is breached', () => {
      // XLM default rate is ~0.1245; threshold <= 0.15 will breach for 'ABOVE' if threshold <= 0.12
      const initialAlerts: PriceAlert[] = [
        {
          id: 'breach-alert',
          token: 'XLM',
          condition: 'ABOVE',
          threshold: 0.10, // 0.1245 >= 0.10 => BREACHED
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialAlerts));

      render(<TokenPriceAlertWidget />);
      expect(screen.getByTestId('price-breach-banner')).toBeInTheDocument();
      const fundLink = screen.getByTestId('fund-escrow-now-cta');
      expect(fundLink).toBeInTheDocument();
      expect(fundLink).toHaveAttribute('href', '/projects/create');
    });
  });
});
