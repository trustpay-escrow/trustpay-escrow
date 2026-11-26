/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useRovingTabIndex } from '@/hooks/useRovingTabIndex';

const THEME_OPTIONS = [
  { id: 'light', label: 'Light theme', title: 'Light', content: '☀️', isDecorative: true },
  { id: 'dark', label: 'Dark theme', title: 'Dark', content: '🌙', isDecorative: true },
  { id: 'oled', label: 'OLED Black theme', title: 'OLED Black', content: 'OLED', isDecorative: false },
  { id: 'system', label: 'System theme', title: 'System', content: '⚙️', isDecorative: true },
] as const;

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // Prevent hydration mismatch - standard Next.js pattern
  useEffect(() => {
    setMounted(true);
  }, []);

  const activeIndex = Math.max(
    0,
    THEME_OPTIONS.findIndex((option) => option.id === theme)
  );
  const { getItemProps } = useRovingTabIndex({
    count: THEME_OPTIONS.length,
    activeIndex,
    onSelect: (index) => setTheme(THEME_OPTIONS[index].id),
    orientation: 'horizontal',
  });

  if (!mounted) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="flex items-center space-x-2 bg-var(--card-bg) p-1 rounded-lg border border-var(--card-border)"
    >
      {THEME_OPTIONS.map((option, index) => {
        const isChecked = theme === option.id;
        const itemProps = getItemProps(index);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isChecked}
            ref={itemProps.ref}
            tabIndex={itemProps.tabIndex}
            onKeyDown={itemProps.onKeyDown}
            onClick={() => setTheme(option.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              isChecked
                ? 'bg-var(--card-border) text-var(--foreground) shadow-sm'
                : 'text-var(--foreground)/60 hover:text-var(--foreground)'
            }`}
            aria-label={option.label}
            title={option.title}
          >
            {option.isDecorative ? <span aria-hidden="true">{option.content}</span> : option.content}
          </button>
        );
      })}
    </div>
  );
}
