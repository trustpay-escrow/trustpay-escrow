'use client';

import React, { useRef } from 'react';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search projects...',
  className = '',
  inputClassName = '',
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClear();
    }
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        ref={inputRef}
        type="text"
        role="searchbox"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`w-full sm:w-auto pr-8 px-3 py-1.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-xs placeholder-[#71717a] focus:outline-none focus:border-indigo-500 transition-colors ${inputClassName}`}
      />
      {value.length > 0 && (
        <button
          type="button"
          data-testid="clear-search-button"
          aria-label="Clear search query"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-[#71717a] hover:text-white hover:bg-[#333338] transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <span className="text-xs leading-none">✕</span>
        </button>
      )}
    </div>
  );
}

export default SearchInput;
