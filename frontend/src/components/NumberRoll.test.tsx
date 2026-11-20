import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import {
  NumberRoll,
  easeOutQuad,
  interpolateValue,
  formatRollingNumber,
} from './NumberRoll';

describe('NumberRoll Unit Functions', () => {
  it('easeOutQuad calculates correct quadratic deceleration curve', () => {
    expect(easeOutQuad(0)).toBe(0);
    expect(easeOutQuad(0.5)).toBe(0.75);
    expect(easeOutQuad(1)).toBe(1);
  });

  it('interpolateValue clamps progress between 0 and 1', () => {
    expect(interpolateValue(-0.5, 1000)).toBe(0);
    expect(interpolateValue(0, 1000)).toBe(0);
    expect(interpolateValue(0.5, 1000)).toBe(750);
    expect(interpolateValue(1, 1000)).toBe(1000);
    expect(interpolateValue(1.5, 1000)).toBe(1000);
  });

  it('formatRollingNumber formats integers and decimals with comma separation', () => {
    expect(formatRollingNumber(1250, 0)).toBe('1,250');
    expect(formatRollingNumber(1250.5, 2)).toBe('1,250.50');
    expect(formatRollingNumber(0, 0)).toBe('0');
    expect(formatRollingNumber(1000000, 2)).toBe('1,000,000.00');
  });
});

describe('NumberRoll Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders with prefix and suffix', () => {
    render(
      <NumberRoll value={500} prefix="$" suffix=" XLM" decimals={2} />
    );

    const element = screen.getByTestId('number-roll');
    expect(element).toBeDefined();
    expect(element.textContent).toContain('$');
    expect(element.textContent).toContain('XLM');
  });

  it('animates smoothly to final target value upon timer completion', () => {
    render(
      <NumberRoll value={2500} prefix="$" durationMs={800} decimals={0} />
    );

    const element = screen.getByTestId('number-roll');
    expect(element.textContent).toBe('$0');

    // Advance time past the 800ms animation duration
    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(element.textContent).toBe('$2,500');
  });

  it('instantly renders final value when prefers-reduced-motion is true', () => {
    // Mock prefers-reduced-motion media query
    const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    window.matchMedia = matchMediaMock;

    render(
      <NumberRoll value={7500} prefix="$" durationMs={800} />
    );

    const element = screen.getByTestId('number-roll');
    // Should immediately display the final value without animating from 0
    expect(element.textContent).toBe('$7,500');
  });

  it('has accessible aria-label with full formatted target value', () => {
    render(
      <NumberRoll value={1250.5} prefix="$" suffix=" USD" decimals={2} />
    );

    const element = screen.getByTestId('number-roll');
    expect(element.getAttribute('aria-label')).toBe('$1,250.50 USD');
  });
});
