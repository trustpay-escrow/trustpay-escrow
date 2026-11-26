import axe, { type AxeResults, type RunOptions } from 'axe-core';

// Serialize axe-core runs because axe maintains global state and throws
// "Axe is already running" if invoked concurrently.
let axeQueue: Promise<unknown> = Promise.resolve();

export const WCAG_21_AA_OPTIONS: RunOptions = {
  iframes: false,
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  },
  rules: {
    // jsdom lacks a CSS layout/paint engine and 2D canvas, so axe cannot compute
    // rendered foreground/background contrast ratios; contrast is checked via CSS tokens.
    'color-contrast': { enabled: false },
  },
};

export function runAxe(
  target: Element | Document,
  options: RunOptions = WCAG_21_AA_OPTIONS
): Promise<AxeResults> {
  const next = axeQueue.then(() => axe.run(target, options));
  axeQueue = next.catch(() => undefined);
  return next;
}

export function formatAxeViolations(results: AxeResults): string {
  return results.violations
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => `  - ${node.target.join(' ')}: ${node.failureSummary ?? ''}`)
        .join('\n');
      return `[${violation.impact ?? 'unknown'}] ${violation.id}: ${violation.help} (${violation.helpUrl})\n${nodes}`;
    })
    .join('\n\n');
}

export async function expectNoA11yViolations(
  target: Element | Document,
  options: RunOptions = WCAG_21_AA_OPTIONS
): Promise<void> {
  const results = await runAxe(target, options);
  if (results.violations.length > 0) {
    throw new Error(`WCAG 2.1 AA violations found:\n\n${formatAxeViolations(results)}`);
  }
}
