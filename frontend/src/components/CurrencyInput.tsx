'use client';

import React from 'react';
import { getCurrencySymbol } from '@/hooks/useCreateProjectForm';

export interface CurrencyInputProps {
  value: number | '';
  onChange: (value: number | '') => void;
  token?: string;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number | string;
  required?: boolean;
  className?: string;
  id?: string;
  name?: string;
  'data-testid'?: string;
}

export function CurrencyInput({
  value,
  onChange,
  token = 'USDC',
  placeholder = '0.00',
  disabled = false,
  min,
  max,
  step = 'any',
  required = false,
  className = '',
  id,
  name,
  'data-testid': testId = 'currency-input',
}: CurrencyInputProps) {
  const symbol = getCurrencySymbol(token);
  const isMultiChar = symbol.length > 1;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (rawVal === '') {
      onChange('');
      return;
    }
    const parsed = Number(rawVal);
    if (!Number.isNaN(parsed)) {
      onChange(parsed);
    }
  };

  return (
    <div className="relative w-full">
      {/* Fixed Currency Badge on the left edge */}
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
        <span
          data-testid="currency-symbol-badge"
          className={`font-bold text-xs uppercase px-2 py-0.5 rounded border border-[#3f3f46] bg-[#27272a] text-[#a1a1aa] select-none ${
            isMultiChar ? 'tracking-wider text-[11px]' : 'text-xs'
          }`}
        >
          {symbol}
        </span>
      </div>

      {/* Right-aligned numeric input with padding preventing badge overlap */}
      <input
        type="number"
        id={id}
        name={name}
        data-testid={testId}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        required={required}
        className={`w-full ${
          isMultiChar ? 'pl-16' : 'pl-12'
        } pr-4 py-3 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm font-mono placeholder-[#71717a] focus:outline-none focus:border-blue-500 transition-colors text-right ${className}`}
      />
    </div>
  );
}

export default CurrencyInput;
