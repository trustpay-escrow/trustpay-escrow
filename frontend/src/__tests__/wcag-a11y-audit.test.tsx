import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { expectNoA11yViolations } from '@/test/a11y';
import { LiveAnnouncerProvider } from '@/components/a11y/LiveAnnouncer';
import { Button } from '@/components/ui/button';
import WalletConnect from '@/components/WalletConnect';
import { ApplicantCard, type ApplicantCardData } from '@/components/ApplicantCard';
import Header from '@/components/Header';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AddressBadge } from '@/components/AddressBadge';
import { SearchInput } from '@/components/SearchInput';
import { ProjectFilterBar } from '@/components/ProjectFilterBar';
import { CalendarExportButton } from '@/components/CalendarExportButton';
import { MessageReactionBar } from '@/components/MessageReactionBar';
import { OrgWalletSwitcher } from '@/components/OrgWalletSwitcher';
import { NotificationCenter } from '@/components/NotificationCenter';
import { ProjectReviewModal } from '@/components/ProjectReviewModal';
import { ProjectChatModal } from '@/components/ProjectChatModal';
import { ImageLightboxModal } from '@/components/ImageLightboxModal';
import { MilestoneSubmitModal } from '@/components/MilestoneSubmitModal';
import { AccountsPayableExportModal } from '@/components/AccountsPayableExportModal';
import { ContractSecurityModal } from '@/components/ContractSecurityModal';
import { MutualCancellationModal } from '@/components/MutualCancellationModal';
import { NotificationScheduleModal } from '@/components/NotificationScheduleModal';
import { FreelancerProfileModal } from '@/components/FreelancerProfileModal';
import { DaoProposalGeneratorModal } from '@/components/DaoProposalGeneratorModal';
import { PerformanceTelemetryModal } from '@/components/PerformanceTelemetryModal';
import { SuccessCheckmark } from '@/components/SuccessCheckmark';
import { DownloadReceiptButton } from '@/components/DownloadReceiptButton';
import { EmbeddedDemoSandbox } from '@/components/EmbeddedDemoSandbox';
import NotFound from '@/app/not-found';
import { useWalletStore } from '@/store/walletStore';
import type { Milestone, Project } from '@/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/projects',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: vi.fn(),
    resolvedTheme: 'dark',
  }),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: [],
    filteredNotifications: [],
    unreadCount: 2,
    unreadCountsByCategory: { all: 2, escrow: 1, proposals: 1, disputes: 0, system: 0 },
    activeTab: 'all',
    setActiveTab: vi.fn(),
    loading: false,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    removeNotification: vi.fn(),
    refresh: vi.fn(),
    preferences: {
      intervals: { '7d': true, '3d': true, '24h': true, '2h': false },
      channels: { in_app: true, browser_push: false, telegram: false },
      telegramChatId: '',
    },
    savePreferences: vi.fn().mockResolvedValue(true),
    preferencesLoading: false,
  }),
}));

vi.mock('@/hooks/useNotificationSounds', () => ({
  useNotificationSounds: () => ({
    isMuted: false,
    toggleMute: vi.fn(),
    volume: 70,
    setNotificationVolume: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCreateProjectForm', () => ({
  useTokenBalance: () => ({ balance: 1500, loading: false, error: null }),
  getBalanceShortfall: () => 0,
}));

vi.mock('@/lib/soroban', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/soroban')>();
  return {
    ...actual,
    getContractWasmHash: vi.fn().mockResolvedValue('a'.repeat(64)),
  };
});

const SAMPLE_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7';
const SAMPLE_FREELANCER = 'GBDEVU63Y6NTHJQQZIKVTC23NWLQVP3WJ2RI2OTSJTNYOIGICST6DUXR';

const SAMPLE_MILESTONE: Milestone = {
  id: 'ms-1',
  project_id: 'proj-1',
  milestone_index: 0,
  title: 'Smart Contract Integration',
  description: 'Integrate Soroban escrow methods with frontend signing.',
  amount: 500,
  status: 'pending',
  due_date: '2026-12-15T00:00:00.000Z',
};

const SAMPLE_PROJECT: Project = {
  id: 'proj-1',
  project_id_onchain: 42,
  title: 'Stellar DeFi Escrow Portal',
  description: 'Milestone escrow web application.',
  budget: 1000,
  token: 'USDC',
  category: 'Development',
  status: 'in_progress',
  client_address: SAMPLE_ADDRESS,
  freelancer_address: SAMPLE_FREELANCER,
  milestones: [SAMPLE_MILESTONE],
};

const SAMPLE_APPLICANT: ApplicantCardData = {
  id: 'prop-1',
  project_id: 'proj-1',
  freelancer_address: SAMPLE_FREELANCER,
  stellar_address: SAMPLE_FREELANCER,
  cover_note: 'Experienced Soroban and React engineer ready to deliver on schedule.',
  status: 'pending',
  created_at: '2026-11-20T12:00:00.000Z',
};

function assertTabTrappedInside(dialog: HTMLElement) {
  const active = document.activeElement;
  expect(active).not.toBeNull();
  expect(dialog.contains(active)).toBe(true);

  for (let i = 0; i < 12; i += 1) {
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
  }
  for (let i = 0; i < 6; i += 1) {
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  }
}

describe('WCAG 2.1 AA Automated Accessibility Audit (#148)', () => {
  beforeEach(() => {
    useWalletStore.setState({
      address: null,
      activeRole: 'client',
      walletName: null,
      token: null,
      orgAccounts: [
        {
          id: 'org-1',
          label: 'Main Treasury',
          address: SAMPLE_ADDRESS,
          isPrimary: true,
          addedAt: '2026-11-20T00:00:00.000Z',
        },
      ],
      activeOrgAccountId: 'org-1',
    });
  });

  it('Button defaults to type="button", includes visible focus-visible styles, and has 0 axe violations', async () => {
    const { baseElement } = render(
      <div>
        <Button>Primary Action</Button>
        <Button variant="outline">Secondary Action</Button>
        <Button variant="ghost" size="icon" aria-label="Settings">
          <span aria-hidden="true">⚙</span>
        </Button>
      </div>
    );
    const primary = screen.getByRole('button', { name: 'Primary Action' });
    expect(primary).toHaveAttribute('type', 'button');
    expect(primary.className).toContain('focus-visible:ring-2');
    await expectNoA11yViolations(baseElement);
  });

  it('WalletConnect passes axe-core and traps focus inside its portaled xBull modal before restoring focus', async () => {
    const { baseElement } = render(
      <LiveAnnouncerProvider>
        <WalletConnect />
      </LiveAnnouncerProvider>
    );

    await expectNoA11yViolations(baseElement);

    const xBullBtn = screen.getByRole('button', { name: /xBull Wallet/i });
    xBullBtn.focus();
    fireEvent.click(xBullBtn);

    const dialog = screen.getByRole('dialog', { name: /xBull Wallet Options/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    assertTabTrappedInside(dialog);
    await expectNoA11yViolations(baseElement);

    // Escape closes modal and returns focus to trigger button
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(xBullBtn).toHaveFocus();
  });

  it('ApplicantCard passes axe-core and exposes aria-live="polite" status announcements', async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined);
    const { baseElement, rerender } = render(
      <LiveAnnouncerProvider>
        <ApplicantCard
          applicant={SAMPLE_APPLICANT}
          onAccept={onAccept}
          onDeny={vi.fn()}
        />
      </LiveAnnouncerProvider>
    );

    await expectNoA11yViolations(baseElement);

    rerender(
      <LiveAnnouncerProvider>
        <ApplicantCard
          applicant={{ ...SAMPLE_APPLICANT, status: 'accepted' }}
          onAccept={onAccept}
          onDeny={vi.fn()}
        />
      </LiveAnnouncerProvider>
    );

    const statusRegions = screen.getAllByRole('status');
    expect(statusRegions.some((el) => /accepted/i.test(el.textContent || ''))).toBe(true);
    await expectNoA11yViolations(baseElement);
  });

  it('Header, NotFound landmark, RoleSwitcher, ThemeToggle, LanguageSelector, and AddressBadge pass axe-core', async () => {
    const { baseElement } = render(
      <LiveAnnouncerProvider>
        <Header />
        <NotFound />
        <RoleSwitcher showDescriptions />
        <ThemeToggle />
        <AddressBadge value={SAMPLE_ADDRESS} label="Copy Stellar Address" />
      </LiveAnnouncerProvider>
    );

    expect(document.getElementById('main-content')).not.toBeNull();
    expect(screen.getByRole('navigation', { name: /Primary navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: /Unified Wallet Role Switcher/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Color theme/i })).toBeInTheDocument();

    // Verify RoleSwitcher roving tabindex keyboard navigation
    const clientTab = screen.getByRole('tab', { name: /Client/i });
    const freelancerTab = screen.getByRole('tab', { name: /Freelancer/i });
    clientTab.focus();
    fireEvent.keyDown(clientTab, { key: 'ArrowRight' });
    expect(freelancerTab).toHaveFocus();

    // Open LanguageSelector listbox and audit it too
    const langTrigger = screen.getByRole('button', { name: /Select Language/i });
    fireEvent.click(langTrigger);
    expect(screen.getByRole('listbox', { name: /Language options/i })).toBeInTheDocument();

    await expectNoA11yViolations(baseElement);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(langTrigger).toHaveFocus();
  });

  it('SearchInput, ProjectFilterBar, CalendarExportButton, MessageReactionBar, and OrgWalletSwitcher pass axe-core', async () => {
    const { baseElement } = render(
      <div>
        <SearchInput value="escrow" onChange={vi.fn()} />
        <ProjectFilterBar
          searchQuery=""
          onSearchChange={vi.fn()}
          selectedCategory="All"
          onCategoryChange={vi.fn()}
        />
        <CalendarExportButton project={SAMPLE_PROJECT} />
        <MessageReactionBar
          messageId="msg-1"
          currentUserAddress={SAMPLE_ADDRESS}
          initialReactions={[{ emoji: '👍', count: 1, users: [SAMPLE_ADDRESS] }]}
        />
        <OrgWalletSwitcher />
      </div>
    );

    // Open CalendarExportButton menu and OrgWalletSwitcher dialog
    fireEvent.click(screen.getByTestId('calendar-export-button'));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Organization wallet switcher/i }));
    const orgDialog = screen.getByRole('dialog', { name: /Organization wallets/i });
    assertTabTrappedInside(orgDialog);

    await expectNoA11yViolations(baseElement);
  });

  it('NotificationCenter drawer traps focus and passes axe-core', async () => {
    const { baseElement } = render(
      <LiveAnnouncerProvider>
        <NotificationCenter isOpen={true} onClose={vi.fn()} />
      </LiveAnnouncerProvider>
    );
    const dialog = screen.getByRole('dialog', { name: /Notification Center/i });
    assertTabTrappedInside(dialog);
    await expectNoA11yViolations(baseElement);
  });

  it('ProjectReviewModal traps focus, supports keyboard star radiogroups, and passes axe-core', async () => {
    const { baseElement } = render(
      <LiveAnnouncerProvider>
        <ProjectReviewModal
          isOpen={true}
          onClose={vi.fn()}
          projectId="proj-1"
          projectTitle="Stellar DeFi Escrow Portal"
          reviewerAddress={SAMPLE_ADDRESS}
          reviewerRole="client"
        />
      </LiveAnnouncerProvider>
    );
    const dialog = screen.getByRole('dialog', { name: /Leave Feedback & Review/i });
    assertTabTrappedInside(dialog);
    expect(screen.getAllByRole('radiogroup')).toHaveLength(3);
    await expectNoA11yViolations(baseElement);
  });

  it('ProjectChatModal traps focus, exposes role="log" aria-live="polite", and passes axe-core', async () => {
    const { baseElement } = render(
      <LiveAnnouncerProvider>
        <ProjectChatModal
          isOpen={true}
          onClose={vi.fn()}
          projectId="proj-1"
          projectTitle="Stellar DeFi Escrow Portal"
          senderAddress={SAMPLE_ADDRESS}
          receiverAddress={SAMPLE_FREELANCER}
        />
      </LiveAnnouncerProvider>
    );
    const dialog = screen.getByRole('dialog');
    assertTabTrappedInside(dialog);
    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
    await expectNoA11yViolations(baseElement);
  });

  it('ImageLightboxModal traps focus inside portal and passes axe-core', async () => {
    const { baseElement } = render(
      <ImageLightboxModal
        imageUrl="https://example.com/proof.png"
        imageAlt="Milestone deliverable screenshot"
        onClose={vi.fn()}
      />
    );
    const dialog = screen.getByRole('dialog');
    assertTabTrappedInside(dialog);
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close lightbox' })).toBeInTheDocument();
    await expectNoA11yViolations(baseElement);
  });

  it('MilestoneSubmitModal traps focus and passes axe-core', async () => {
    const { baseElement } = render(
      <LiveAnnouncerProvider>
        <MilestoneSubmitModal
          isOpen={true}
          onClose={vi.fn()}
          project={SAMPLE_PROJECT}
          milestone={SAMPLE_MILESTONE}
        />
      </LiveAnnouncerProvider>
    );
    const dialog = screen.getByRole('dialog', { name: /Submit Milestone Deliverable/i });
    assertTabTrappedInside(dialog);
    await expectNoA11yViolations(baseElement);
  });

  it('AccountsPayableExportModal, ContractSecurityModal, MutualCancellationModal, and NotificationScheduleModal pass axe-core and trap focus', async () => {
    const modals = [
      <AccountsPayableExportModal key="ap" isOpen={true} onClose={vi.fn()} projects={[SAMPLE_PROJECT]} />,
      <ContractSecurityModal key="sec" isOpen={true} onClose={vi.fn()} />,
      <MutualCancellationModal key="mc" isOpen={true} onClose={vi.fn()} project={SAMPLE_PROJECT} />,
      <NotificationScheduleModal key="ns" isOpen={true} onClose={vi.fn()} project={SAMPLE_PROJECT} />,
    ];

    for (const modal of modals) {
      const { baseElement, unmount } = render(<LiveAnnouncerProvider>{modal}</LiveAnnouncerProvider>);
      const dialog = screen.getByRole('dialog');
      assertTabTrappedInside(dialog);
      await expectNoA11yViolations(baseElement);
      unmount();
    }
  });

  it('FreelancerProfileModal, DaoProposalGeneratorModal, PerformanceTelemetryModal, SuccessCheckmark, DownloadReceiptButton, and EmbeddedDemoSandbox pass axe-core and trap focus', async () => {
    const staticModals = [
      <FreelancerProfileModal key="fp" applicant={SAMPLE_APPLICANT} onClose={vi.fn()} />,
      <DaoProposalGeneratorModal
        key="dao"
        isOpen={true}
        onClose={vi.fn()}
        defaults={{
          projectTitle: SAMPLE_PROJECT.title,
          description: SAMPLE_PROJECT.description || 'Escrow scope',
          token: 'USDC',
          tokenAddress: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
          milestones: [{ title: 'M1', amount: 500 }],
          yieldEnabled: false,
        }}
      />,
      <PerformanceTelemetryModal key="perf" isOpen={true} onClose={vi.fn()} />,
      <SuccessCheckmark key="ok" isOpen={true} onClose={vi.fn()} amount={500} autoDismissDelay={0} playSound={false} />,
    ];

    for (const modal of staticModals) {
      const { baseElement, unmount } = render(<LiveAnnouncerProvider>{modal}</LiveAnnouncerProvider>);
      const dialog = screen.getByRole('dialog');
      assertTabTrappedInside(dialog);
      await expectNoA11yViolations(baseElement);
      unmount();
    }

    // DownloadReceiptButton opens a focus-trapped dialog
    const receiptRender = render(<DownloadReceiptButton project={SAMPLE_PROJECT} />);
    fireEvent.click(screen.getByTestId('download-receipt-button'));
    assertTabTrappedInside(screen.getByRole('dialog'));
    await expectNoA11yViolations(receiptRender.baseElement);
    receiptRender.unmount();

    // EmbeddedDemoSandbox toolbar buttons + fullscreen dialog
    const sandboxRender = render(<EmbeddedDemoSandbox url="https://codepen.io/team/pen/abcdef" title="Demo Widget" />);
    await expectNoA11yViolations(sandboxRender.baseElement);
    fireEvent.click(screen.getByRole('button', { name: /Expand sandbox to full screen/i }));
    assertTabTrappedInside(screen.getByRole('dialog'));
    await expectNoA11yViolations(sandboxRender.baseElement);
    sandboxRender.unmount();
  });
});
