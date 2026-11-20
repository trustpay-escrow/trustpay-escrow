import { describe, it, expect, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { CryptoId, CRYPTO_ID_CLASS, truncateMiddle } from './CryptoId';

const ADDRESS = 'GAUBK6P5Z7I7ZXZZ6D7XQWJ7M2U3H7T5W7O6X7Y8Z9A1B2C3D4E5F6G7';
const TX_HASH = 'a3f1c9e2b7d4058f6e1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f70';

describe('truncateMiddle', () => {
  it('keeps the requested head and tail', () => {
    expect(truncateMiddle(ADDRESS, 6, 4)).toBe('GAUBK6...F6G7');
    expect(truncateMiddle(ADDRESS, 8, 6)).toBe('GAUBK6P5...E5F6G7');
  });

  it('supports a head-only form', () => {
    expect(truncateMiddle(TX_HASH, 8, 0)).toBe('a3f1c9e2...');
  });

  it('leaves values that would not get shorter unchanged', () => {
    expect(truncateMiddle('GABCDEFGHIJ', 4, 4)).toBe('GABCDEFGHIJ');
    expect(truncateMiddle('GABCDEFGHIJK', 4, 4)).toBe('GABC...HIJK');
  });

  it('ignores negative lengths', () => {
    expect(truncateMiddle(ADDRESS, -1, 4)).toBe(ADDRESS);
  });
});

describe('CryptoId', () => {
  afterEach(() => {
    document.head.querySelectorAll('style[data-test-mono]').forEach((el) => el.remove());
  });

  it('renders the full value in the shared monospace style at text-xs by default', () => {
    render(<CryptoId value={ADDRESS} />);

    const el = screen.getByText(ADDRESS);
    expect(el).toHaveAttribute('data-crypto-id');
    expect(el).toHaveClass('font-mono', 'tracking-tight', 'text-xs');
    expect(el).not.toHaveAttribute('title');
  });

  it('switches to text-sm when asked', () => {
    render(<CryptoId value={ADDRESS} size="sm" />);

    const el = screen.getByText(ADDRESS);
    expect(el).toHaveClass('text-sm');
    expect(el).not.toHaveClass('text-xs');
  });

  it('truncates and exposes the full value as the tooltip', () => {
    render(<CryptoId value={ADDRESS} head={6} tail={4} />);

    const el = screen.getByText('GAUBK6...F6G7');
    expect(el).toHaveAttribute('title', ADDRESS);
  });

  it('keeps a caller-supplied title', () => {
    render(<CryptoId value={TX_HASH} head={8} tail={0} title="View transaction" />);

    expect(screen.getByText('a3f1c9e2...')).toHaveAttribute('title', 'View transaction');
  });

  it('renders a prefix inside the monospace span and merges extra classes', () => {
    render(<CryptoId value={TX_HASH} prefix="🔒 " className="text-indigo-300 truncate" />);

    const el = screen.getByText(`🔒 ${TX_HASH}`);
    expect(el).toHaveClass('font-mono', 'tracking-tight', 'text-indigo-300', 'truncate');
  });

  it('exports the class string it applies', () => {
    expect(CRYPTO_ID_CLASS).toBe('font-mono tracking-tight');
  });

  it('resolves to a monospace font-family once the font-mono utility is styled', () => {
    // jsdom does not load Tailwind, so register the utility the way Tailwind's
    // default theme defines it and check the element picks it up.
    const style = document.createElement('style');
    style.setAttribute('data-test-mono', '');
    style.textContent =
      '.font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }' +
      '.tracking-tight { letter-spacing: -0.025em; }';
    document.head.appendChild(style);

    render(<CryptoId value={ADDRESS} />);

    const computed = window.getComputedStyle(screen.getByText(ADDRESS));
    expect(computed.fontFamily).toContain('monospace');
    // Tight tracking resolves to a negative letter-spacing (-0.025em of the font size).
    expect(parseFloat(computed.letterSpacing)).toBeLessThan(0);
  });
});
