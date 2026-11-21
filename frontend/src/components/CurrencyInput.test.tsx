import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CurrencyInput } from './CurrencyInput';
import { getCurrencySymbol } from '@/hooks/useCreateProjectForm';

describe('CurrencyInput Component & getCurrencySymbol', () => {
  describe('getCurrencySymbol Helper', () => {
    it('returns "$" for USDC and PYUSD', () => {
      expect(getCurrencySymbol('USDC')).toBe('$');
      expect(getCurrencySymbol('PYUSD')).toBe('$');
    });

    it('returns "€" for EURC', () => {
      expect(getCurrencySymbol('EURC')).toBe('€');
    });

    it('returns "XLM" for XLM', () => {
      expect(getCurrencySymbol('XLM')).toBe('XLM');
    });

    it('defaults to "$" for unknown tokens', () => {
      expect(getCurrencySymbol('UNKNOWN')).toBe('$');
    });
  });

  describe('CurrencyInput Component', () => {
    it('renders the fixed currency badge on the left edge with correct symbol', () => {
      render(<CurrencyInput value={500} onChange={vi.fn()} token="USDC" />);
      const badge = screen.getByTestId('currency-symbol-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toBe('$');
    });

    it('updates currency symbol badge dynamically when token prop changes', () => {
      const { rerender } = render(<CurrencyInput value={500} onChange={vi.fn()} token="USDC" />);
      expect(screen.getByTestId('currency-symbol-badge').textContent).toBe('$');

      rerender(<CurrencyInput value={500} onChange={vi.fn()} token="EURC" />);
      expect(screen.getByTestId('currency-symbol-badge').textContent).toBe('€');

      rerender(<CurrencyInput value={500} onChange={vi.fn()} token="XLM" />);
      expect(screen.getByTestId('currency-symbol-badge').textContent).toBe('XLM');
    });

    it('applies pl-16 padding for multi-character currency symbols (XLM) to prevent overlap', () => {
      const { rerender } = render(<CurrencyInput value={100} onChange={vi.fn()} token="XLM" />);
      const input = screen.getByTestId('currency-input');
      expect(input.className).toContain('pl-16');
      expect(input.className).toContain('text-right');

      rerender(<CurrencyInput value={100} onChange={vi.fn()} token="USDC" />);
      expect(input.className).toContain('pl-12');
    });

    it('calls onChange with parsed numeric value when user types numbers', () => {
      const handleChange = vi.fn();
      render(<CurrencyInput value="" onChange={handleChange} token="USDC" />);
      const input = screen.getByTestId('currency-input');

      fireEvent.change(input, { target: { value: '750' } });
      expect(handleChange).toHaveBeenCalledWith(750);
    });

    it('calls onChange with empty string when input is cleared', () => {
      const handleChange = vi.fn();
      render(<CurrencyInput value={250} onChange={handleChange} token="USDC" />);
      const input = screen.getByTestId('currency-input');

      fireEvent.change(input, { target: { value: '' } });
      expect(handleChange).toHaveBeenCalledWith('');
    });

    it('ensures numeric values are clean without currency symbol contamination', () => {
      const handleChange = vi.fn();
      render(<CurrencyInput value={1250.5} onChange={handleChange} token="EURC" />);
      const input = screen.getByTestId('currency-input') as HTMLInputElement;

      expect(input.value).toBe('1250.5');
      expect(input.value).not.toContain('€');
    });
  });
});
