import { z } from 'zod';

/**
 * Recurring retainer scheduling helpers (#149).
 *
 * Recurrence is always generated from the original anchor date rather than
 * from the previous cycle, so a 31st-of-month retainer stays on the 31st in
 * long months instead of drifting earlier after a short month.
 */

export type RetainerFrequency = 'weekly' | 'biweekly' | 'monthly';

export const RETAINER_FREQUENCIES: Record<
  RetainerFrequency,
  { label: string; days: number | null }
> = {
  weekly: { label: 'Weekly', days: 7 },
  biweekly: { label: 'Bi-weekly', days: 14 },
  monthly: { label: 'Monthly', days: null },
};

export const DEFAULT_TERMINATION_NOTICE_DAYS = 7;
export const MAX_RETAINER_CYCLES = 60;

export interface RetainerConfig {
  frequency: RetainerFrequency;
  cycles: number;
  amountPerCycle: number;
  startDate: string;
  token?: string;
}

export interface RetainerScheduleEntry {
  cycle: number;
  date: string;
  amount: number;
  cumulative: number;
}

export interface RetainerSchedule {
  entries: RetainerScheduleEntry[];
  totalObligation: number;
  nextFundingDate: string | null;
  remainingCycles: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseRetainerDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
  );
}

export function toRetainerIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Add `count` recurrence intervals to a date. Monthly intervals clamp to the
 * last day of the target month (Jan 31 + 1 month -> Feb 28/29).
 */
export function addRetainerInterval(
  date: Date,
  frequency: RetainerFrequency,
  count = 1
): Date {
  if (frequency !== 'monthly') {
    const days = RETAINER_FREQUENCIES[frequency]?.days || 7;
    return new Date(date.getTime() + days * count * DAY_MS);
  }

  const anchorDay = date.getUTCDate();
  const targetMonthStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1)
  );
  const lastDayOfTargetMonth = new Date(
    Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth() + 1,
      0
    )
  ).getUTCDate();

  return new Date(
    Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth(),
      Math.min(anchorDay, lastDayOfTargetMonth)
    )
  );
}

export function generateRetainerSchedule(
  config: Pick<RetainerConfig, 'frequency' | 'cycles' | 'amountPerCycle' | 'startDate'>,
  now: Date | string = new Date()
): RetainerSchedule {
  const anchor = parseRetainerDate(config.startDate) || parseRetainerDate(now) || new Date();
  const cycles = Math.max(0, Math.floor(Number(config.cycles) || 0));
  const amount = Math.max(0, Number(config.amountPerCycle) || 0);
  const today = parseRetainerDate(now) || anchor;

  const entries: RetainerScheduleEntry[] = [];
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    const date = addRetainerInterval(anchor, config.frequency, cycle - 1);
    entries.push({
      cycle,
      date: toRetainerIsoDate(date),
      amount,
      cumulative: Number((amount * cycle).toFixed(2)),
    });
  }

  const nextEntry = entries.find((entry) => parseRetainerDate(entry.date)! >= today);
  const remainingCycles = entries.filter(
    (entry) => parseRetainerDate(entry.date)! >= today
  ).length;

  return {
    entries,
    totalObligation: Number((amount * cycles).toFixed(2)),
    nextFundingDate: nextEntry?.date || null,
    remainingCycles,
  };
}

export function getRetainerTerminationDate(
  now: Date | string = new Date(),
  noticeDays = DEFAULT_TERMINATION_NOTICE_DAYS
): string {
  const today = parseRetainerDate(now) || new Date();
  const safeNotice = Number.isFinite(noticeDays) && noticeDays >= 0 ? noticeDays : DEFAULT_TERMINATION_NOTICE_DAYS;
  return toRetainerIsoDate(new Date(today.getTime() + safeNotice * DAY_MS));
}

export function getDaysUntil(dateIso: string, now: Date | string = new Date()): number | null {
  const target = parseRetainerDate(dateIso);
  const today = parseRetainerDate(now);
  if (!target || !today) return null;
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

export const retainerConfigSchema = z
  .object({
    frequency: z.enum(['weekly', 'biweekly', 'monthly'], {
      message: 'Choose a retainer frequency',
    }),
    cycles: z
      .number()
      .int('Cycle count must be a whole number')
      .min(1, 'At least one funding cycle is required')
      .max(MAX_RETAINER_CYCLES, `At most ${MAX_RETAINER_CYCLES} cycles are allowed`),
    amountPerCycle: z
      .number()
      .positive('Cycle amount must be greater than 0')
      .max(1_000_000, 'Cycle amount exceeds the maximum limit'),
    startDate: z
      .string()
      .refine((value) => parseRetainerDate(value) !== null, 'Enter a valid start date'),
    token: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const start = parseRetainerDate(value.startDate);
    if (!start) return;
    const today = parseRetainerDate(new Date())!;
    if (start.getTime() < today.getTime() - DAY_MS) {
      ctx.addIssue({
        code: 'custom',
        path: ['startDate'],
        message: 'Start date cannot be in the past',
      });
    }
  });

export type RetainerConfigInput = z.infer<typeof retainerConfigSchema>;

export interface RetainerValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof RetainerConfigInput, string>>;
}

export function validateRetainerConfig(input: unknown): RetainerValidationResult {
  const result = retainerConfigSchema.safeParse(input);
  if (result.success) return { valid: true, errors: {} };

  const errors: Partial<Record<keyof RetainerConfigInput, string>> = {};
  const zodError = result.error as { issues?: Array<{ path: (string | number)[]; message: string }> };
  (zodError.issues || []).forEach((issue) => {
    const key = issue.path[0] as keyof RetainerConfigInput | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  });
  return { valid: false, errors };
}
