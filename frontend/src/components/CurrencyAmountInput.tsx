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

export type CurrencyAmountInputProps = {
  token: string;
  value: string | number;
  onChange?: (raw: string) => void;
  onValueChange?: (parsed: number | '') => void;
  placeholder?: string;
  label?: string;
  id?: string;
  name?: string;
  min?: number | string;
  step?: number | string;
  inputClassName?: string;
  badgeTestId?: string;
  'data-testid'?: string;
  'aria-label'?: string;
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
  onValueChange,
  placeholder = '0.00',
  label,
  id,
  name,
  min = 0,
  step = 'any',
  inputClassName,
  badgeTestId = 'currency-prefix',
  'data-testid': dataTestId = 'currency-amount-input',
  'aria-label': ariaLabel,
}: CurrencyAmountInputProps) {
  const prefix = currencyPrefix(token);

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        data-testid={badgeTestId}
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-xs font-semibold text-[#a1a1aa]"
      >
        {prefix}
      </span>
      <input
        id={id}
        name={name}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          onChange?.(raw);
          if (onValueChange) {
            const trimmed = raw.trim();
            const parsed = trimmed === '' ? '' : Number(trimmed);
            onValueChange(parsed === '' || Number.isNaN(parsed) ? '' : parsed);
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel ?? label ?? `Amount in ${token}`}
        data-testid={dataTestId}
        className={
          inputClassName ||
          'w-full py-3 pl-16 pr-4 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-blue-500 transition-colors'
        }
      />
    </div>
  );
}

export default CurrencyAmountInput;
