import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, renderHook, act } from '@testing-library/react';
import { StarredFreelancersList } from './StarredFreelancersList';
import { ApplicantCard } from './ApplicantCard';
import { useStarredFreelancers } from '@/hooks/useStarredFreelancers';
import { starredStorageKey, toggleStar, setNotes, loadStarred } from '@/lib/starred-freelancers';
import type { StarredFreelancer } from '@/types';

const CLIENT = 'GCLIENT';
const FREELANCER = 'GFREELANCER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ2345';

beforeEach(() => window.localStorage.clear());

describe('star toggle on applicant cards (#255)', () => {
  const applicant = { id: 'a1', stellar_address: FREELANCER, name: 'Ada', pitch: 'Hi', status: 'pending' as const };

  it('shows an unfilled star and calls onToggleStar with the applicant', () => {
    const onToggleStar = vi.fn();
    render(<ApplicantCard applicant={applicant} onAccept={vi.fn()} onDeny={vi.fn()} onToggleStar={onToggleStar} />);
    const star = screen.getByTestId('applicant-star-toggle');
    expect(star).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(star);
    expect(onToggleStar).toHaveBeenCalledWith(applicant);
  });

  it('shows a filled star when starred', () => {
    render(
      <ApplicantCard applicant={applicant} onAccept={vi.fn()} onDeny={vi.fn()} isStarred onToggleStar={vi.fn()} />
    );
    expect(screen.getByTestId('applicant-star-toggle')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows no star when the parent does not support it', () => {
    render(<ApplicantCard applicant={applicant} onAccept={vi.fn()} onDeny={vi.fn()} />);
    expect(screen.queryByTestId('applicant-star-toggle')).not.toBeInTheDocument();
  });
});

describe('bookmark state in local storage', () => {
  it('toggling stars and unstars, and persists per client wallet', () => {
    const { result } = renderHook(() => useStarredFreelancers(CLIENT));
    expect(result.current.starred).toEqual([]);

    act(() => result.current.toggle({ address: FREELANCER, name: 'Ada' }));
    expect(result.current.isStarred(FREELANCER)).toBe(true);
    expect(loadStarred(CLIENT)).toHaveLength(1);
    expect(window.localStorage.getItem(starredStorageKey('GOTHER'))).toBeNull();

    act(() => result.current.toggle({ address: FREELANCER }));
    expect(result.current.isStarred(FREELANCER)).toBe(false);
    expect(loadStarred(CLIENT)).toEqual([]);
  });

  it('reloads starred freelancers on a fresh mount', () => {
    const first = renderHook(() => useStarredFreelancers(CLIENT));
    act(() => first.result.current.toggle({ address: FREELANCER, name: 'Ada' }));
    first.unmount();

    const second = renderHook(() => useStarredFreelancers(CLIENT));
    expect(second.result.current.starred[0]).toMatchObject({ address: FREELANCER, name: 'Ada' });
  });

  it('pure helpers do not mutate their input', () => {
    const base: StarredFreelancer[] = [];
    const next = toggleStar(base, { address: FREELANCER });
    expect(base).toEqual([]);
    expect(setNotes(next, FREELANCER, 'x')[0].notes).toBe('x');
    expect(next[0].notes).toBe('');
  });
});

describe('StarredFreelancersList (#255)', () => {
  const item: StarredFreelancer = {
    address: FREELANCER,
    name: 'Ada',
    notes: 'Excellent Rust dev',
    starredAt: '2026-01-01T00:00:00.000Z',
  };

  it('shows an empty state', () => {
    render(<StarredFreelancersList starred={[]} onUnstar={vi.fn()} onSaveNotes={vi.fn()} onInvite={vi.fn()} />);
    expect(screen.getByTestId('starred-empty')).toBeInTheDocument();
  });

  it('lists saved contractors with their notes and unstars', () => {
    const onUnstar = vi.fn();
    render(<StarredFreelancersList starred={[item]} onUnstar={onUnstar} onSaveNotes={vi.fn()} onInvite={vi.fn()} />);
    expect(screen.getByTestId(`starred-notes-${FREELANCER}`)).toHaveValue('Excellent Rust dev');
    fireEvent.click(screen.getByTestId(`starred-remove-${FREELANCER}`));
    expect(onUnstar).toHaveBeenCalledWith(FREELANCER);
  });

  it('saves private notes and they reload accurately', () => {
    const { result } = renderHook(() => useStarredFreelancers(CLIENT));
    act(() => result.current.toggle({ address: FREELANCER, name: 'Ada' }));

    const view = render(
      <StarredFreelancersList
        starred={result.current.starred}
        onUnstar={vi.fn()}
        onSaveNotes={(a, n) => act(() => result.current.setNotes(a, n))}
        onInvite={vi.fn()}
      />
    );
    const box = screen.getByTestId(`starred-notes-${FREELANCER}`);
    expect(screen.getByTestId(`starred-save-${FREELANCER}`)).toBeDisabled();
    fireEvent.change(box, { target: { value: 'Fast turnaround, great comms' } });
    fireEvent.click(screen.getByTestId(`starred-save-${FREELANCER}`));
    view.unmount();

    // A fresh mount (page reload) reads the same notes back.
    const reloaded = renderHook(() => useStarredFreelancers(CLIENT));
    expect(reloaded.result.current.starred[0].notes).toBe('Fast turnaround, great comms');
    render(
      <StarredFreelancersList
        starred={reloaded.result.current.starred}
        onUnstar={vi.fn()}
        onSaveNotes={vi.fn()}
        onInvite={vi.fn()}
      />
    );
    expect(screen.getByTestId(`starred-notes-${FREELANCER}`)).toHaveValue('Fast turnaround, great comms');
  });

  it('invite action passes the freelancer to the parent', () => {
    const onInvite = vi.fn();
    render(<StarredFreelancersList starred={[item]} onUnstar={vi.fn()} onSaveNotes={vi.fn()} onInvite={onInvite} />);
    fireEvent.click(screen.getByTestId(`starred-invite-${FREELANCER}`));
    expect(onInvite).toHaveBeenCalledWith(item);
  });
});
