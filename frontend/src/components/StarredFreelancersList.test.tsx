import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  StarredFreelancersList,
  StarButton,
  getStarredFreelancers,
  saveStarredFreelancers,
  toggleStarFreelancer,
  isFreelancerStarred,
  updateFreelancerNotes,
} from './StarredFreelancersList';

describe('StarredFreelancersList and Bookmark Utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Storage and Helper Functions', () => {
    it('returns empty array when no freelancers are starred', () => {
      expect(getStarredFreelancers()).toEqual([]);
      expect(isFreelancerStarred('GAUBK123')).toBe(false);
    });

    it('toggles star state and persists into localStorage', () => {
      const added = toggleStarFreelancer({
        address: 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5',
        name: 'Rajnish Dev',
        portfolioUrl: 'https://github.com/givemehat',
      });
      expect(added).toBe(true);
      expect(isFreelancerStarred('GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5')).toBe(true);

      const list = getStarredFreelancers();
      expect(list.length).toBe(1);
      expect(list[0].name).toBe('Rajnish Dev');

      // Toggle off
      const removed = toggleStarFreelancer({
        address: 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5',
      });
      expect(removed).toBe(false);
      expect(isFreelancerStarred('GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5')).toBe(false);
    });

    it('updates private notes for a bookmarked freelancer', () => {
      toggleStarFreelancer({ address: 'GXYZ12345' });
      updateFreelancerNotes('GXYZ12345', 'Great Soroban smart contract auditor');

      const list = getStarredFreelancers();
      expect(list[0].notes).toBe('Great Soroban smart contract auditor');
    });
  });

  describe('StarButton Component', () => {
    it('renders star button and toggles state on click', () => {
      const onToggle = vi.fn();
      render(<StarButton address="GSTAR123" onToggle={onToggle} />);

      const btn = screen.getByTestId('star-btn-GSTAR123');
      expect(btn).toHaveAttribute('aria-label', 'Star freelancer');

      fireEvent.click(btn);
      expect(onToggle).toHaveBeenCalledWith(true);
      expect(btn).toHaveAttribute('aria-label', 'Unstar freelancer');
    });
  });

  describe('StarredFreelancersList Component', () => {
    it('renders empty state when no contractors are bookmarked', () => {
      render(<StarredFreelancersList />);
      expect(screen.getByTestId('empty-starred-state')).toBeInTheDocument();
      expect(screen.getByText('No contractors bookmarked yet')).toBeInTheDocument();
    });

    it('renders contractor cards when contractors exist in storage', () => {
      saveStarredFreelancers([
        {
          address: 'GCONTR1',
          name: 'Alice Developer',
          notes: 'Specialist in Soroban Rust contracts',
          starredAt: Date.now(),
        },
        {
          address: 'GCONTR2',
          name: 'Bob Frontend',
          notes: 'Next.js and Tailwind expert',
          starredAt: Date.now(),
        },
      ]);

      render(<StarredFreelancersList />);

      expect(screen.getByText('Alice Developer')).toBeInTheDocument();
      expect(screen.getByText('Bob Frontend')).toBeInTheDocument();
      expect(screen.getByText('2 Bookmarked')).toBeInTheDocument();
    });

    it('updates notes and calls onInviteToProject when invite button is clicked', () => {
      const onInvite = vi.fn();
      saveStarredFreelancers([
        {
          address: 'GCONTR1',
          name: 'Alice Developer',
          notes: '',
          starredAt: Date.now(),
        },
      ]);

      render(<StarredFreelancersList onInviteToProject={onInvite} />);

      const textarea = screen.getByTestId('notes-textarea-GCONTR1');
      fireEvent.change(textarea, { target: { value: 'Fast turnaround on milestone 1' } });

      const saveBtn = screen.getByTestId('save-note-btn-GCONTR1');
      fireEvent.click(saveBtn);

      const updated = getStarredFreelancers();
      expect(updated[0].notes).toBe('Fast turnaround on milestone 1');

      const inviteBtn = screen.getByTestId('invite-btn-GCONTR1');
      fireEvent.click(inviteBtn);

      expect(onInvite).toHaveBeenCalledWith('GCONTR1');
    });

    it('filters contractors by search query', () => {
      saveStarredFreelancers([
        { address: 'GADDR_RUST', name: 'Rust Specialist', notes: '', starredAt: Date.now() },
        { address: 'GADDR_REACT', name: 'React Wizard', notes: '', starredAt: Date.now() },
      ]);

      render(<StarredFreelancersList />);

      const searchInput = screen.getByTestId('starred-search-input');
      fireEvent.change(searchInput, { target: { value: 'React' } });

      expect(screen.getByText('React Wizard')).toBeInTheDocument();
      expect(screen.queryByText('Rust Specialist')).not.toBeInTheDocument();
    });
  });
});
