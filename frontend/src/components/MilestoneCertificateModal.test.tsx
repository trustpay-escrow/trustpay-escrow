import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Milestone, Project } from '@/types';
import { MilestoneCertificateModal } from './MilestoneCertificateModal';

const downloadCertificatePdf = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/receipt-generator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/receipt-generator')>();
  return {
    ...actual,
    downloadCertificatePdf: (...args: unknown[]) => downloadCertificatePdf(...args),
  };
});

const project: Project = {
  id: 'project-1',
  title: 'Soroban Escrow Audit',
  description: '',
  category: 'Security',
  budget: 2500,
  token: 'USDC',
  status: 'completed',
  project_id_onchain: 12,
  freelancer_address: 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5',
  client_address: 'GDFLMVB4TWEBF3EXD66IYLCZE2G75JWZ5ICPKBWPEW7EE5CCLJQGFHAX',
  tx_hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
};

const milestone: Milestone = {
  id: 'milestone-1',
  milestone_index: 1,
  title: 'Final security report',
  amount: 2500,
  status: 'approved',
};

describe('MilestoneCertificateModal (#310)', () => {
  beforeEach(() => {
    downloadCertificatePdf.mockClear();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    (URL as unknown as { createObjectURL: (blob: Blob) => string }).createObjectURL = vi.fn(
      () => 'blob:certificate'
    );
    (URL as unknown as { revokeObjectURL: (url: string) => void }).revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the certificate preview inside an accessible dialog', () => {
    render(
      <MilestoneCertificateModal
        isOpen
        onClose={() => {}}
        project={project}
        milestone={milestone}
        txHash={project.tx_hash}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /milestone completion certificate/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const preview = screen.getByTestId('certificate-preview');
    expect(preview.querySelector('svg')).not.toBeNull();
    expect(preview.innerHTML).toContain('Certificate of Completion');
    expect(preview.innerHTML).toContain('2,500.00 USDC');
    expect(preview.innerHTML).toContain('Final security report');
    expect(screen.getByTestId('certificate-filename').textContent).toMatch(/\.svg$/);
  });

  it('triggers an SVG download from the one-click button', () => {
    render(
      <MilestoneCertificateModal isOpen onClose={() => {}} project={project} milestone={milestone} />
    );

    fireEvent.click(screen.getByTestId('download-certificate-svg'));

    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('exports the PDF through the generator', async () => {
    render(
      <MilestoneCertificateModal isOpen onClose={() => {}} project={project} milestone={milestone} />
    );

    fireEvent.click(screen.getByTestId('export-certificate-pdf'));

    await waitFor(() => expect(downloadCertificatePdf).toHaveBeenCalledTimes(1));
    expect(downloadCertificatePdf.mock.calls[0][0]).toMatchObject({
      projectTitle: 'Soroban Escrow Audit',
      milestoneTitle: 'Final security report',
      amount: 2500,
      token: 'USDC',
    });
  });

  it('copies a shareable certificate link', async () => {
    render(
      <MilestoneCertificateModal isOpen onClose={() => {}} project={project} milestone={milestone} />
    );

    fireEvent.click(screen.getByTestId('copy-certificate-link'));

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/projects/project-1?certificate=milestone-1')
      )
    );
  });
});
