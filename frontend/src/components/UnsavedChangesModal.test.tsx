import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UnsavedChangesModal } from './UnsavedChangesModal';

describe('UnsavedChangesModal', () => {
  it('does not render when isOpen is false', () => {
    render(<UnsavedChangesModal isOpen={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByTestId('unsaved-changes-dialog')).toBeNull();
  });

  it('renders modal dialog when isOpen is true with title and message', () => {
    render(
      <UnsavedChangesModal
        isOpen={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        title="Leave Page?"
        message="Your milestone data will be lost."
      />
    );
    expect(screen.getByTestId('unsaved-changes-dialog')).toBeDefined();
    expect(screen.getByText('Leave Page?')).toBeDefined();
    expect(screen.getByText('Your milestone data will be lost.')).toBeDefined();
  });

  it('calls onCancel when Stay on Page button is clicked', () => {
    const onCancel = vi.fn();
    render(<UnsavedChangesModal isOpen={true} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('unsaved-modal-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Discard Changes button is clicked', () => {
    const onConfirm = vi.fn();
    render(<UnsavedChangesModal isOpen={true} onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByTestId('unsaved-modal-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
