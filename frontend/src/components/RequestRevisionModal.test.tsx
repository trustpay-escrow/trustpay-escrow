import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RequestRevisionModal, formatRevisionNote } from './RequestRevisionModal';
import type { Milestone } from '@/types';

const milestone: Milestone = {
  id: 'ms-1',
  milestone_index: 0,
  title: 'Soroban escrow contract',
  amount: 2500,
  status: 'submitted',
  revision_limit: 2,
  revisions_remaining: 2,
};

function renderModal(overrides: Partial<React.ComponentProps<typeof RequestRevisionModal>> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(
    <RequestRevisionModal
      isOpen
      milestone={milestone}
      onSubmit={onSubmit}
      onClose={onClose}
      {...overrides}
    />
  );
  return { onSubmit, onClose };
}

describe('RequestRevisionModal', () => {
  it('adds and deletes revision checklist items', () => {
    renderModal();

    const input = screen.getByLabelText(/revision checklist/i);
    fireEvent.change(input, { target: { value: 'Add unit tests for dispute resolution' } });
    fireEvent.click(screen.getByTestId('revision-add-checklist'));

    fireEvent.change(input, { target: { value: 'Fix mobile layout overflow' } });
    fireEvent.click(screen.getByTestId('revision-add-checklist'));

    expect(screen.getAllByTestId('revision-checklist-item')).toHaveLength(2);
    expect(screen.getByText('Add unit tests for dispute resolution')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Remove checklist item Fix mobile layout overflow'));
    expect(screen.getAllByTestId('revision-checklist-item')).toHaveLength(1);
    expect(screen.queryByText('Fix mobile layout overflow')).not.toBeInTheDocument();
  });

  it('submits the note, checklist, and formatted feedback', async () => {
    const { onSubmit } = renderModal();

    fireEvent.change(screen.getByLabelText(/revision feedback/i), {
      target: { value: 'Please fix the failing tests before resubmitting.' },
    });
    fireEvent.change(screen.getByLabelText(/revision checklist/i), {
      target: { value: 'Add docstrings to new endpoints' },
    });
    fireEvent.click(screen.getByTestId('revision-add-checklist'));
    fireEvent.click(screen.getByRole('button', { name: /request revision/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.milestoneId).toBe('ms-1');
    expect(payload.note).toBe('Please fix the failing tests before resubmitting.');
    expect(payload.checklist).toEqual(['Add docstrings to new endpoints']);
    expect(payload.formattedNote).toContain('Revision checklist:');
    expect(payload.formattedNote).toContain('- Add docstrings to new endpoints');
  });

  it('shows the orange revision-requested badge and paused timelock', () => {
    renderModal({ revisionsRemaining: 1 });

    expect(screen.getByText('Revision Requested')).toBeInTheDocument();
    expect(screen.getByText('Timelock paused')).toBeInTheDocument();
    expect(screen.getByTestId('request-revision-modal')).toHaveTextContent(
      '1 revision will remain after this request'
    );
  });

  it('validates that feedback is present', async () => {
    const { onSubmit } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /request revision/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 3 characters/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('attaches screenshot files to the revision request', async () => {
    renderModal();

    const file = new File(['annotation'], 'annotation.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('revision-screenshot-input'), {
      target: { files: [file] },
    });

    await waitFor(() => expect(screen.getByAltText('annotation.png')).toBeInTheDocument());
  });

  it('formats a note with a checklist block', () => {
    expect(formatRevisionNote('Needs work', ['Fix A', ' Fix B '])).toBe(
      'Needs work\n\nRevision checklist:\n- Fix A\n- Fix B'
    );
    expect(formatRevisionNote('Only a note', [])).toBe('Only a note');
  });
});
