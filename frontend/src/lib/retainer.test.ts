import { describe, expect, it } from 'vitest';
import {
  addRetainerInterval,
  generateRetainerSchedule,
  getRetainerTerminationDate,
  parseRetainerDate,
  validateRetainerConfig,
} from './retainer';

describe('addRetainerInterval', () => {
  it('adds weekly and bi-weekly intervals', () => {
    const start = parseRetainerDate('2026-01-01')!;
    expect(addRetainerInterval(start, 'weekly', 2).toISOString().slice(0, 10)).toBe('2026-01-15');
    expect(addRetainerInterval(start, 'biweekly', 2).toISOString().slice(0, 10)).toBe('2026-01-29');
  });

  it('clamps monthly recurrences to the last day of short months', () => {
    const start = parseRetainerDate('2026-01-31')!;
    expect(addRetainerInterval(start, 'monthly', 1).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(addRetainerInterval(start, 'monthly', 2).toISOString().slice(0, 10)).toBe('2026-03-31');
  });

  it('handles leap-year February', () => {
    const start = parseRetainerDate('2028-01-31')!;
    expect(addRetainerInterval(start, 'monthly', 1).toISOString().slice(0, 10)).toBe('2028-02-29');
  });
});

describe('generateRetainerSchedule', () => {
  it('generates a weekly funding schedule with the total obligation', () => {
    const schedule = generateRetainerSchedule(
      {
        frequency: 'weekly',
        cycles: 4,
        amountPerCycle: 250,
        startDate: '2026-01-01',
      },
      '2026-01-01'
    );

    expect(schedule.entries.map((entry) => entry.date)).toEqual([
      '2026-01-01',
      '2026-01-08',
      '2026-01-15',
      '2026-01-22',
    ]);
    expect(schedule.entries.map((entry) => entry.cumulative)).toEqual([250, 500, 750, 1000]);
    expect(schedule.totalObligation).toBe(1000);
    expect(schedule.nextFundingDate).toBe('2026-01-01');
    expect(schedule.remainingCycles).toBe(4);
  });

  it('generates a monthly schedule and finds the next funding date', () => {
    const schedule = generateRetainerSchedule(
      {
        frequency: 'monthly',
        cycles: 3,
        amountPerCycle: 1500,
        startDate: '2026-01-31',
      },
      '2026-02-15'
    );

    expect(schedule.entries.map((entry) => entry.date)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
    expect(schedule.nextFundingDate).toBe('2026-02-28');
    expect(schedule.remainingCycles).toBe(2);
  });

  it('returns no next funding date after all cycles pass', () => {
    const schedule = generateRetainerSchedule(
      { frequency: 'weekly', cycles: 2, amountPerCycle: 100, startDate: '2026-01-01' },
      '2026-03-01'
    );
    expect(schedule.nextFundingDate).toBeNull();
    expect(schedule.remainingCycles).toBe(0);
  });
});

describe('retainer termination notice', () => {
  it('adds the default 7-day notice period', () => {
    expect(getRetainerTerminationDate('2026-03-01')).toBe('2026-03-08');
  });

  it('supports a custom notice period', () => {
    expect(getRetainerTerminationDate('2026-03-01', 14)).toBe('2026-03-15');
  });
});

describe('validateRetainerConfig', () => {
  it('accepts a valid retainer configuration', () => {
    const result = validateRetainerConfig({
      frequency: 'biweekly',
      cycles: 6,
      amountPerCycle: 800,
      startDate: '2099-01-01',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('rejects zero cycles, non-positive amounts, and past start dates', () => {
    const result = validateRetainerConfig({
      frequency: 'monthly',
      cycles: 0,
      amountPerCycle: 0,
      startDate: '2020-01-01',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.cycles).toBeTruthy();
    expect(result.errors.amountPerCycle).toBeTruthy();
    expect(result.errors.startDate).toBeTruthy();
  });

  it('caps the number of cycles', () => {
    const result = validateRetainerConfig({
      frequency: 'weekly',
      cycles: 61,
      amountPerCycle: 10,
      startDate: '2099-01-01',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.cycles).toContain('60');
  });
});
