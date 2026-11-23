import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';

const mockSetTheme = vi.fn();
let mockTheme = 'light';

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
  }),
}));

describe('ThemeToggle component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTheme = 'light';
  });

  it('renders all theme options including OLED Black', () => {
    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: /light theme/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /dark theme/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /oled black theme/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /system theme/i })).toBeDefined();
  });

  it('calls setTheme with "oled" when OLED button is clicked', () => {
    render(<ThemeToggle />);

    const oledButton = screen.getByRole('button', { name: /oled black theme/i });
    fireEvent.click(oledButton);

    expect(mockSetTheme).toHaveBeenCalledWith('oled');
  });

  it('calls setTheme with "dark" when Dark button is clicked', () => {
    render(<ThemeToggle />);

    const darkButton = screen.getByRole('button', { name: /dark theme/i });
    fireEvent.click(darkButton);

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('calls setTheme with "light" when Light button is clicked', () => {
    render(<ThemeToggle />);

    const lightButton = screen.getByRole('button', { name: /light theme/i });
    fireEvent.click(lightButton);

    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('calls setTheme with "system" when System button is clicked', () => {
    render(<ThemeToggle />);

    const systemButton = screen.getByRole('button', { name: /system theme/i });
    fireEvent.click(systemButton);

    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });
});
