'use client';

import React from 'react';

/** Visible badge shown at the left edge of numeric amount inputs. */
export function currencyPrefix(token: string): string {
  switch (token.toUpperCase()) {
    case 'USDC':
    case 'PYUSD':
      return '$';
    case 'EURC':
      return '€';
    case 'XLM':
      return 'XLM';
    default:
      return token.toUpperCase();
  }
}

type CurrencyAmountInputProps = {
  token: string;
  value: string | number;
  onChange: (raw: string) => void;
  placeholder?: string;
  label?: string;
  id?: string;
  min?: number | string;
  step?: number | string;
};

/**
 * Numeric amount field with a fixed, dynamic currency prefix.
 * The prefix is decorative (aria-hidden) so the submitted value never
 * contains a currency symbol.
 */
export function CurrencyAmountInput({
  token,
  value,
  onChange,
  placeholder = '0.00',
  label,
  id,
  min = 0,
  step = 'any',
}: CurrencyAmountInputProps) {
  const prefix = currencyPrefix(token);

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        data-testid="currency-prefix"
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-xs font-semibold text-[#a1a1aa]"
      >
        {prefix}
      </span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? `Amount in ${token}`}
        data-testid="currency-amount-input"
        className="w-full py-3 pl-16 pr-4 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-blue-500 transition-colors"
      />
    </div>
  );
}

export default CurrencyAmountInput;
