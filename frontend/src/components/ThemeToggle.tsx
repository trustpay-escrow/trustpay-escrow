/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // Prevent hydration mismatch - standard Next.js pattern
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2 bg-var(--card-bg) p-1 rounded-lg border border-var(--card-border)">
      <button
        onClick={() => setTheme('light')}
        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
          theme === 'light'
            ? 'bg-var(--card-border) text-var(--foreground) shadow-sm'
            : 'text-var(--foreground)/60 hover:text-var(--foreground)'
        }`}
        aria-label="Light theme"
        title="Light"
      >
        ☀️
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
          theme === 'dark'
            ? 'bg-var(--card-border) text-var(--foreground) shadow-sm'
            : 'text-var(--foreground)/60 hover:text-var(--foreground)'
        }`}
        aria-label="Dark theme"
        title="Dark"
      >
        🌙
      </button>
      <button
        onClick={() => setTheme('oled')}
        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
          theme === 'oled'
            ? 'bg-var(--card-border) text-var(--foreground) shadow-sm'
            : 'text-var(--foreground)/60 hover:text-var(--foreground)'
        }`}
        aria-label="OLED Black theme"
        title="OLED Black"
      >
        OLED
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
          theme === 'system'
            ? 'bg-var(--card-border) text-var(--foreground) shadow-sm'
            : 'text-var(--foreground)/60 hover:text-var(--foreground)'
        }`}
        aria-label="System theme"
        title="System"
      >
        ⚙️
      </button>
    </div>
  );
}
