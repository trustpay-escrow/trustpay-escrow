import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import axe from 'axe-core';
import type { Project } from '@/types';
import { A11yLiveAnnouncer } from '@/components/A11yLiveAnnouncer';
import { MilestoneCertificateModal } from '@/components/MilestoneCertificateModal';
import { BulkMilestonePayoutManager } from '@/components/BulkMilestonePayoutManager';

const project: Project = {
  id: 'p1',
  title: 'Soroban Escrow Audit',
  description: '',
  category: 'Security',
  budget: 3000,
  token: 'USDC',
  status: 'in_progress',
  project_id_onchain: 7,
  freelancer_address: 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5',
  milestones: [
    { id: 'm1', milestone_index: 0, title: 'Scope review', amount: 1000, status: 'submitted' },
    { id: 'm2', milestone_index: 1, title: 'Security report', amount: 1200, status: 'approved' },
  ],
  tx_hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
};

async function audit(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    rules: {
      // jsdom cannot resolve rendered colours, so contrast is covered by visual reviews.
      'color-contrast': { enabled: false },
    },
  });

  return results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious'
  );
}

describe('WCAG 2.1 AA axe audits (#309)', () => {
  it('certificate modal has no critical or serious violations', async () => {
    const { container } = render(
      <A11yLiveAnnouncer>
        <MilestoneCertificateModal isOpen onClose={() => {}} project={project} milestone={project.milestones?.[1]} />
      </A11yLiveAnnouncer>
    );

    expect(await audit(container)).toEqual([]);
  });

  it('bulk payout manager has no critical or serious violations', async () => {
    const { container } = render(
      <A11yLiveAnnouncer>
        <BulkMilestonePayoutManager isOpen onClose={() => {}} projects={[project]} callerAddress="GCLIENT" />
      </A11yLiveAnnouncer>
    );

    expect(await audit(container)).toEqual([]);
  });
});
